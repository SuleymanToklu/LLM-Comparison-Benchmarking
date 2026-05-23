import type { GitHubContentItem, GitHubEvent, GitHubRepo, GitHubUser } from "@/types"

const GITHUB_API_BASE = "https://api.github.com"
const CACHE_TTL_MS = 1000 * 60 * 60 * 24
const cache = new Map<string, { data: unknown; expiresAt: number }>()

type FetchErrorCode = "NOT_FOUND" | "RATE_LIMIT" | "NETWORK" | "UNKNOWN"

export class FetcherError extends Error {
  code: FetchErrorCode
  status: number

  constructor(message: string, code: FetchErrorCode, status = 500) {
    super(message)
    this.code = code
    this.status = status
  }
}

function getGitHubHeaders() {
  const token = process.env.GITHUB_TOKEN
  return {
    Accept: "application/vnd.github+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

function toError(response: Response) {
  if (response.status === 404) {
    return new FetcherError("GitHub user or resource not found", "NOT_FOUND", 404)
  }

  if (response.status === 403) {
    const remaining = response.headers.get("x-ratelimit-remaining")
    if (remaining === "0") {
      return new FetcherError("GitHub rate limit exceeded", "RATE_LIMIT", 403)
    }
    return new FetcherError("GitHub access forbidden", "RATE_LIMIT", 403)
  }

  return new FetcherError("GitHub request failed", "UNKNOWN", response.status)
}

async function fetchJSON<T>(url: string, cacheKey: string): Promise<T> {
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: "GET",
      headers: getGitHubHeaders(),
      next: { revalidate: 0 }
    })
  } catch {
    throw new FetcherError("Network error while contacting GitHub", "NETWORK", 503)
  }

  if (!response.ok) {
    throw toError(response)
  }

  const data = (await response.json()) as T
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS })
  return data
}

export async function fetchUserProfile(username: string): Promise<GitHubUser> {
  const clean = username.trim()
  return fetchJSON<GitHubUser>(`${GITHUB_API_BASE}/users/${clean}`, `profile:${clean.toLowerCase()}`)
}

export async function fetchUserRepos(username: string): Promise<GitHubRepo[]> {
  const clean = username.trim()
  const repos = await fetchJSON<GitHubRepo[]>(
    `${GITHUB_API_BASE}/users/${clean}/repos?per_page=100&sort=updated`,
    `repos:${clean.toLowerCase()}`
  )

  return repos.filter((repo) => !repo.fork && repo.owner.login.toLowerCase() === clean.toLowerCase())
}

export async function fetchUserEvents(username: string): Promise<GitHubEvent[]> {
  const clean = username.trim()
  return fetchJSON<GitHubEvent[]>(
    `${GITHUB_API_BASE}/users/${clean}/events/public?per_page=100`,
    `events:${clean.toLowerCase()}`
  )
}

export async function fetchRepoContents(
  owner: string,
  repo: string,
  path = ""
): Promise<GitHubContentItem[]> {
  const normalizedPath = path.replace(/^\/+|\/+$/g, "")
  const endpoint = normalizedPath
    ? `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${normalizedPath}`
    : `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents`
  const key = `contents:${owner.toLowerCase()}:${repo.toLowerCase()}:${normalizedPath || "root"}`

  const data = await fetchJSON<GitHubContentItem | GitHubContentItem[]>(endpoint, key)
  return Array.isArray(data) ? data : [data]
}
