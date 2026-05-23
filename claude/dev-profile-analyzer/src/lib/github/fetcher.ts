import {
  GitHubUser,
  GitHubRepo,
  GitHubEvent,
  GitHubContent,
  ErrorCode,
} from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const GITHUB_API = 'https://api.github.com'

const TTL = {
  USER: 24 * 60 * 60 * 1000,      // 24 h — user profiles change rarely
  REPOS: 24 * 60 * 60 * 1000,     // 24 h — repo list
  EVENTS: 60 * 60 * 1000,         // 1 h  — events are time-sensitive
  CONTENTS: 24 * 60 * 60 * 1000,  // 24 h — file trees are stable
} as const

const MAX_RETRIES = 2
const BASE_RETRY_DELAY_MS = 600

// ─── Typed error ─────────────────────────────────────────────────────────────

export class GitHubAPIError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode?: number
  ) {
    super(message)
    this.name = 'GitHubAPIError'
  }
}

// ─── Generic TTL cache ────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class TTLCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>()

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.data
  }

  set(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs })
  }

  /** Remove stale entries to prevent unbounded growth in long-running processes */
  prune(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key)
    }
  }

  get size(): number {
    return this.store.size
  }
}

// Module-level caches (shared across all requests in the same process / worker)
const userCache     = new TTLCache<GitHubUser>()
const reposCache    = new TTLCache<GitHubRepo[]>()
const eventsCache   = new TTLCache<GitHubEvent[]>()
const contentsCache = new TTLCache<GitHubContent[]>()

// ─── Request helpers ──────────────────────────────────────────────────────────

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'DevProfileAnalyzer/2.0',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  return headers
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Core fetch wrapper with retry + exponential back-off.
 *
 * Throws `GitHubAPIError` on known error conditions; retries on transient
 * 5xx errors (up to MAX_RETRIES). Never retries 4xx errors.
 */
async function githubFetch<T>(url: string): Promise<T> {
  let lastError: GitHubAPIError | undefined

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1))
    }

    let res: Response
    try {
      res = await fetch(url, {
        headers: buildHeaders(),
        // Opt out of Next.js built-in fetch cache; our TTL cache handles caching
        cache: 'no-store',
      })
    } catch (networkErr) {
      lastError = new GitHubAPIError(
        'NETWORK_ERROR',
        `Network request failed for ${url}: ${String(networkErr)}`
      )
      continue // retry
    }

    // Rate-limit check via header (can trigger before HTTP 403)
    const remaining = res.headers.get('X-RateLimit-Remaining')
    if (remaining !== null && Number(remaining) === 0) {
      const resetEpoch = res.headers.get('X-RateLimit-Reset')
      const resetAt = resetEpoch
        ? new Date(Number(resetEpoch) * 1000).toUTCString()
        : 'unknown'
      throw new GitHubAPIError(
        'RATE_LIMITED',
        `GitHub API rate limit exhausted. Resets at ${resetAt}`,
        429
      )
    }

    switch (res.status) {
      case 200:
      case 204:
        break
      case 404:
        throw new GitHubAPIError('USER_NOT_FOUND', `Not found: ${url}`, 404)
      case 403:
        throw new GitHubAPIError(
          'RATE_LIMITED',
          'GitHub API rate limit exceeded or access denied',
          403
        )
      case 422: {
        const body = await res.json().catch(() => ({})) as { message?: string }
        throw new GitHubAPIError(
          'USER_NOT_FOUND',
          body.message ?? 'Unprocessable entity',
          422
        )
      }
      default:
        if (res.status >= 400 && res.status < 500) {
          // Other 4xx: no retry
          throw new GitHubAPIError(
            'NETWORK_ERROR',
            `GitHub API client error ${res.status} for ${url}`,
            res.status
          )
        }
        // 5xx: retry
        lastError = new GitHubAPIError(
          'NETWORK_ERROR',
          `GitHub API server error ${res.status}`,
          res.status
        )
        continue
    }

    try {
      return (await res.json()) as T
    } catch {
      lastError = new GitHubAPIError(
        'NETWORK_ERROR',
        'Failed to parse GitHub API JSON response'
      )
      continue
    }
  }

  throw (
    lastError ??
    new GitHubAPIError('NETWORK_ERROR', 'GitHub API request failed after retries')
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a GitHub user profile.
 * Cached for 24 h.
 */
export async function fetchUserProfile(username: string): Promise<GitHubUser> {
  const key = `user:${username}`
  const hit = userCache.get(key)
  if (hit) return hit

  const user = await githubFetch<GitHubUser>(`${GITHUB_API}/users/${username}`)
  userCache.set(key, user, TTL.USER)
  return user
}

/**
 * Fetch all public repos owned by a user (forks excluded).
 * Sorted by `updated` to surface recently active repos first.
 * Cached for 24 h.
 */
export async function fetchUserRepos(username: string): Promise<GitHubRepo[]> {
  const key = `repos:${username}`
  const hit = reposCache.get(key)
  if (hit) return hit

  // type=owner excludes repos the user is only a collaborator on
  const all = await githubFetch<GitHubRepo[]>(
    `${GITHUB_API}/users/${username}/repos?per_page=100&sort=updated&type=owner`
  )

  const owned = all.filter(
    r => !r.fork && r.owner.login.toLowerCase() === username.toLowerCase()
  )

  reposCache.set(key, owned, TTL.REPOS)
  return owned
}

/**
 * Fetch the most recent 100 public events for a user.
 * Returns an empty array gracefully if the user's event feed is inaccessible.
 * Cached for 1 h.
 */
export async function fetchUserEvents(username: string): Promise<GitHubEvent[]> {
  const key = `events:${username}`
  const hit = eventsCache.get(key)
  if (hit) return hit

  try {
    const events = await githubFetch<GitHubEvent[]>(
      `${GITHUB_API}/users/${username}/events/public?per_page=100`
    )
    eventsCache.set(key, events, TTL.EVENTS)
    return events
  } catch (err) {
    // Private profiles or empty event streams return 404 — non-fatal
    if (err instanceof GitHubAPIError && err.statusCode === 404) {
      return []
    }
    throw err
  }
}

/**
 * Fetch the file tree of a repository path (defaults to root).
 * Returns an empty array if the path does not exist or the repo is empty.
 * Cached for 24 h.
 */
export async function fetchRepoContents(
  owner: string,
  repo: string,
  path = ''
): Promise<GitHubContent[]> {
  const key = `contents:${owner}/${repo}/${path}`
  const hit = contentsCache.get(key)
  if (hit) return hit

  const endpoint = path
    ? `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`
    : `${GITHUB_API}/repos/${owner}/${repo}/contents`

  try {
    const data = await githubFetch<GitHubContent | GitHubContent[]>(endpoint)
    // A single-file path returns an object, not an array
    const contents = Array.isArray(data) ? data : [data]
    contentsCache.set(key, contents, TTL.CONTENTS)
    return contents
  } catch (err) {
    if (err instanceof GitHubAPIError) {
      const safe = err.statusCode === 404 || err.statusCode === 403
      if (safe) return [] // empty repo, private repo, or non-existent path
    }
    throw err
  }
}

/**
 * Evict expired entries from all caches.
 * Call this from a periodic job if the process runs long-term.
 */
export function pruneCaches(): void {
  userCache.prune()
  reposCache.prune()
  eventsCache.prune()
  contentsCache.prune()
}

/** Diagnostic: total live entries across all caches */
export function getCacheStats(): Record<string, number> {
  return {
    users: userCache.size,
    repos: reposCache.size,
    events: eventsCache.size,
    contents: contentsCache.size,
  }
}
