import type {
  GitHubContentEntry,
  GitHubEvent,
  GitHubRateLimit,
  GitHubRepo,
  GitHubUser,
  RepoFileSnapshot,
  RepoManifest
} from "@/types";

const GITHUB_API_BASE = "https://api.github.com";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_REPO_PAGE_LIMIT = 5;
const DEFAULT_CONTENT_DEPTH = 4;
const DEFAULT_CONTENT_FILE_LIMIT = 1_500;
const MAX_MANIFEST_BYTES = 200_000;

type GitHubErrorCode = "not_found" | "rate_limited" | "forbidden" | "network" | "api_error";

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

interface RequestOptions {
  cacheTtlMs?: number;
  allowNotFoundAsNull?: boolean;
}

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();
let latestRateLimit: GitHubRateLimit | undefined;

export class GitHubApiError extends Error {
  status: number;
  code: GitHubErrorCode;
  rateLimit?: GitHubRateLimit;

  constructor(message: string, status: number, code: GitHubErrorCode, rateLimit?: GitHubRateLimit) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.code = code;
    this.rateLimit = rateLimit;
  }
}

export async function fetchUserProfile(username: string): Promise<GitHubUser> {
  const safeUsername = encodeURIComponent(normalizeUsername(username));
  return githubRequest<GitHubUser>(`/users/${safeUsername}`);
}

export async function fetchUserRepos(username: string): Promise<GitHubRepo[]> {
  const normalizedUsername = normalizeUsername(username).toLowerCase();
  const repos: GitHubRepo[] = [];
  const pageLimit = readBoundedInteger(process.env.GITHUB_REPO_PAGE_LIMIT, DEFAULT_REPO_PAGE_LIMIT, 1, 10);

  for (let page = 1; page <= pageLimit; page += 1) {
    const pageRepos = await githubRequest<GitHubRepo[]>(
      `/users/${encodeURIComponent(normalizedUsername)}/repos?per_page=100&sort=updated&direction=desc&page=${page}`
    );
    repos.push(...pageRepos);

    if (pageRepos.length < 100) {
      break;
    }
  }

  return repos.filter((repo) => !repo.fork && repo.owner.login.toLowerCase() === normalizedUsername);
}

export async function fetchUserEvents(username: string): Promise<GitHubEvent[]> {
  const safeUsername = encodeURIComponent(normalizeUsername(username));
  return githubRequest<GitHubEvent[]>(`/users/${safeUsername}/events/public?per_page=100`);
}

export async function fetchRepoFileSnapshot(repo: GitHubRepo): Promise<RepoFileSnapshot> {
  if (!repo.default_branch) {
    return {
      repoFullName: repo.full_name,
      defaultBranch: null,
      analyzed: false,
      truncated: false,
      paths: [],
      manifests: [],
      error: "Repository has no default branch."
    };
  }

  const [owner, repoName] = repo.full_name.split("/");
  if (!owner || !repoName) {
    return {
      repoFullName: repo.full_name,
      defaultBranch: repo.default_branch,
      analyzed: false,
      truncated: false,
      paths: [],
      manifests: [],
      error: "Repository full_name is invalid."
    };
  }

  const state = {
    paths: [] as string[],
    manifests: [] as RepoManifest[],
    truncated: false,
    visitedDirectories: 0,
    fileLimit: readBoundedInteger(process.env.GITHUB_CONTENT_FILE_LIMIT, DEFAULT_CONTENT_FILE_LIMIT, 100, 10_000),
    maxDepth: readBoundedInteger(process.env.GITHUB_CONTENT_DEPTH, DEFAULT_CONTENT_DEPTH, 1, 8)
  };

  try {
    await walkRepositoryContents(owner, repoName, repo.default_branch, "", 0, state);
  } catch (error) {
    if (error instanceof GitHubApiError && (error.status === 404 || error.status === 409)) {
      return {
        repoFullName: repo.full_name,
        defaultBranch: repo.default_branch,
        analyzed: true,
        truncated: false,
        paths: [],
        manifests: [],
        error: "Repository contents are unavailable or empty."
      };
    }

    throw error;
  }

  return {
    repoFullName: repo.full_name,
    defaultBranch: repo.default_branch,
    analyzed: true,
    truncated: state.truncated,
    paths: state.paths,
    manifests: state.manifests
  };
}

export function getLatestGitHubRateLimit(): GitHubRateLimit | undefined {
  return latestRateLimit;
}

export function clearGitHubCache(): void {
  responseCache.clear();
  inFlightRequests.clear();
}

async function walkRepositoryContents(
  owner: string,
  repo: string,
  ref: string,
  path: string,
  depth: number,
  state: {
    paths: string[];
    manifests: RepoManifest[];
    truncated: boolean;
    visitedDirectories: number;
    fileLimit: number;
    maxDepth: number;
  }
): Promise<void> {
  if (state.paths.length >= state.fileLimit || depth > state.maxDepth) {
    state.truncated = true;
    return;
  }

  state.visitedDirectories += 1;
  const entries = await fetchContents(owner, repo, path, ref);

  const childDirectories: string[] = [];
  const manifestFiles: string[] = [];

  for (const entry of entries) {
    if (state.paths.length >= state.fileLimit) {
      state.truncated = true;
      break;
    }

    state.paths.push(entry.path);

    if (entry.type === "dir" && !shouldSkipDirectory(entry.path)) {
      childDirectories.push(entry.path);
    } else if (entry.type === "file" && isManifestPath(entry.path) && entry.size <= MAX_MANIFEST_BYTES) {
      manifestFiles.push(entry.path);
    }
  }

  const manifests = await mapWithConcurrency(manifestFiles.slice(0, 12), 3, async (manifestPath) => {
    return fetchTextFile(owner, repo, manifestPath, ref);
  });
  state.manifests.push(...manifests.filter((manifest): manifest is RepoManifest => Boolean(manifest)));

  if (depth >= state.maxDepth) {
    if (childDirectories.length > 0) {
      state.truncated = true;
    }
    return;
  }

  await mapWithConcurrency(childDirectories, 3, async (childPath) => {
    await walkRepositoryContents(owner, repo, ref, childPath, depth + 1, state);
  });
}

async function fetchContents(owner: string, repo: string, path: string, ref: string): Promise<GitHubContentEntry[]> {
  const endpointPath = path
    ? `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`
    : `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`;
  const result = await githubRequest<GitHubContentEntry[] | GitHubContentEntry>(
    `${endpointPath}?ref=${encodeURIComponent(ref)}`
  );

  return Array.isArray(result) ? result : [result];
}

async function fetchTextFile(owner: string, repo: string, path: string, ref: string): Promise<RepoManifest | null> {
  try {
    const file = await githubRequest<GitHubContentEntry>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`
    );

    if (file.type !== "file" || file.encoding !== "base64" || !file.content || file.size > MAX_MANIFEST_BYTES) {
      return null;
    }

    return {
      path: file.path,
      content: Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8")
    };
  } catch {
    return null;
  }
}

async function githubRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const cacheKey = `github:${path}`;
  const ttl = options.cacheTtlMs ?? CACHE_TTL_MS;
  const cached = responseCache.get(cacheKey) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inFlight = inFlightRequests.get(cacheKey) as Promise<T> | undefined;
  if (inFlight) {
    return inFlight;
  }

  const requestPromise = githubRequestUncached<T>(path, options).then((value) => {
    responseCache.set(cacheKey, {
      expiresAt: Date.now() + ttl,
      value
    });
    pruneCache();
    return value;
  });

  inFlightRequests.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

async function githubRequestUncached<T>(path: string, options: RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${GITHUB_API_BASE}${path}`, {
      headers: githubHeaders(),
      signal: controller.signal,
      cache: "no-store"
    });
    latestRateLimit = readRateLimit(response.headers) ?? latestRateLimit;

    if (response.status === 404 && options.allowNotFoundAsNull) {
      return null as T;
    }

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new GitHubApiError(message, response.status, classifyGitHubError(response, message), latestRateLimit);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof GitHubApiError) {
      throw error;
    }

    const message = error instanceof Error && error.name === "AbortError"
      ? "GitHub request timed out."
      : "Network error while calling GitHub.";
    throw new GitHubApiError(message, 0, "network", latestRateLimit);
  } finally {
    clearTimeout(timeout);
  }
}

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "developer-profile-analyzer"
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

function classifyGitHubError(response: Response, message: string): GitHubErrorCode {
  const remaining = latestRateLimit?.remaining;

  if (response.status === 404) {
    return "not_found";
  }
  if (response.status === 403 && (remaining === 0 || /rate limit/i.test(message))) {
    return "rate_limited";
  }
  if (response.status === 403) {
    return "forbidden";
  }

  return "api_error";
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown };
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    // Fall through to generic status message.
  }

  return `GitHub request failed with status ${response.status}.`;
}

function readRateLimit(headers: Headers): GitHubRateLimit | undefined {
  const limit = Number(headers.get("x-ratelimit-limit"));
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const reset = Number(headers.get("x-ratelimit-reset"));

  if (!Number.isFinite(limit) || !Number.isFinite(remaining)) {
    return undefined;
  }

  return {
    limit,
    remaining,
    resetAt: Number.isFinite(reset) ? new Date(reset * 1000).toISOString() : null
  };
}

function normalizeUsername(username: string): string {
  return username.trim();
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function shouldSkipDirectory(path: string): boolean {
  const normalized = path.toLowerCase();
  return /(^|\/)(node_modules|vendor|dist|build|coverage|\.next|\.nuxt|\.git|target|bin|obj)(\/|$)/.test(normalized);
}

function isManifestPath(path: string): boolean {
  const fileName = path.toLowerCase().split("/").pop() ?? "";
  return (
    fileName === "package.json" ||
    fileName === "requirements.txt" ||
    fileName === "pyproject.toml" ||
    fileName === "pipfile" ||
    fileName === "composer.json" ||
    fileName === "pom.xml" ||
    fileName === "build.gradle" ||
    fileName === "build.gradle.kts" ||
    fileName === "go.mod" ||
    fileName === "gemfile"
  );
}

function readBoundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(parsed), min), max);
}

function pruneCache(): void {
  if (responseCache.size <= 1_000) {
    return;
  }

  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (entry.expiresAt <= now || responseCache.size > 900) {
      responseCache.delete(key);
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
