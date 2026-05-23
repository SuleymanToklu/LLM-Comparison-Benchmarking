// ─── Primitives ──────────────────────────────────────────────────────────────

export type ExposureLevel = 'none' | 'low' | 'medium' | 'high'

export type ErrorCode =
  | 'USER_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'NO_PUBLIC_REPOS'
  | 'GEMINI_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'INVALID_USERNAME'
  | 'INTERNAL_ERROR'

// ─── Raw GitHub API shapes ────────────────────────────────────────────────────

export interface GitHubUser {
  login: string
  id: number
  avatar_url: string
  name: string | null
  bio: string | null
  public_repos: number
  followers: number
  following: number
  created_at: string
  html_url: string
  location: string | null
  company: string | null
  blog: string | null
  email: string | null
  twitter_username: string | null
  hireable: boolean | null
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  fork: boolean
  private: boolean
  owner: { login: string; avatar_url: string }
  language: string | null
  stargazers_count: number
  forks_count: number
  watchers_count: number
  open_issues_count: number
  size: number
  created_at: string
  updated_at: string
  pushed_at: string | null
  html_url: string
  topics: string[]
  has_wiki: boolean
  has_pages: boolean
  default_branch: string
  license: { spdx_id: string; name: string } | null
}

export interface GitHubEvent {
  id: string
  type: string
  created_at: string
  actor: { login: string; avatar_url: string }
  repo: { id: number; name: string; url: string }
  payload: {
    /**
     * distinct_size is the number of unique commits in a PushEvent.
     * Prefer this over commits.length for accurate counting.
     */
    distinct_size?: number
    commits?: Array<{
      sha: string
      message: string
      author: { name: string; email: string }
    }>
    ref?: string
    ref_type?: string
    action?: string
    issue?: { title: string; number: number }
    pull_request?: { title: string; number: number; merged: boolean }
  }
}

export interface GitHubContent {
  name: string
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  path: string
  size: number
  sha: string
}

// ─── Analyzer output types ────────────────────────────────────────────────────

export interface LanguageEntry {
  /** Display name, e.g. "TypeScript" */
  name: string
  /** Percentage of repos using this language (0-100) */
  percentage: number
  /** Raw repo count */
  repoCount: number
}

export interface ActivityMetrics {
  /** Average push-event commits per calendar week over the last 90 days */
  avgCommitsPerWeek: number
  /** Number of owned repos that received a push in the last 90 days */
  activeReposLast90Days: number
  /**
   * 0-100: fraction of weeks in the last 90 days that had at least one push.
   * 100 = active every week, 0 = no activity.
   */
  consistencyScore: number
  /** Raw count of PushEvents in the last 90 days */
  totalPushEventsLast90Days: number
  /** Number of distinct calendar weeks with at least one push */
  activeWeeksLast90Days: number
}

export interface EngineeringSignals {
  /** Any analysed repo contains a test directory or config */
  hasTests: boolean
  /** Any analysed repo contains a Dockerfile / docker-compose */
  hasDockerfile: boolean
  /** Any analysed repo has .github/workflows, .travis.yml, .circleci, etc. */
  hasCICD: boolean
  /** Any analysed repo has a README file */
  hasReadme: boolean
  /** Any analysed repo has a deployment config (Vercel, Fly, Render …) */
  hasDeployment: boolean
  /** How many repos were actually checked (API calls made) */
  reposAnalyzed: number
  /** How many checked repos have test signals */
  reposWithTests: number
  /** How many checked repos have a README */
  reposWithReadme: number
}

// Re-export for legacy compatibility
export type RepoDetails = EngineeringSignals

// ─── Normalised profile ───────────────────────────────────────────────────────

export interface NormalizedProfile {
  // Identity
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string
  profileUrl: string
  location: string | null
  company: string | null
  websiteUrl: string | null

  // Account stats
  followers: number
  following: number
  /** Calendar days since account was created */
  accountAgeDays: number

  // Repository portfolio
  totalPublicRepos: number
  /** Repos owned by this user (forks excluded) */
  ownedRepos: number
  forkedRepos: number
  totalStars: number
  /** Average kilobyte size of owned repos */
  avgRepoSize: number

  // Language distribution
  topLanguages: LanguageEntry[]

  // Activity
  avgCommitsPerWeek: number
  activeReposLast90Days: number
  /** 0-100 consistency score from activity analysis */
  consistencyScore: number

  // Engineering maturity signals
  hasTests: boolean
  hasDockerfile: boolean
  hasCICD: boolean
  hasReadme: boolean
  hasDeployment: boolean
  reposWithTests: number
  reposWithReadme: number
  reposAnalyzed: number

  // Tech-domain exposure
  frontendExposure: ExposureLevel
  backendExposure: ExposureLevel
  devopsExposure: ExposureLevel
  mlExposure: ExposureLevel

  // Detected frameworks / tools (used by AI layer for specificity)
  detectedFrontendFrameworks: string[]
  detectedBackendFrameworks: string[]
  detectedDevOpsTools: string[]
  detectedMLFrameworks: string[]

  /** Composite 0-100 score from engineering signals */
  repoQualityScore: number
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface DeveloperScores {
  /** Strength in backend/server-side development (0-100) */
  backend: number
  /** Strength in frontend/UI development (0-100) */
  frontend: number
  /** DevOps, containerisation, and CI/CD maturity (0-100) */
  devops: number
  /** Testing culture and automated quality gates (0-100) */
  testing: number
  /** Commit frequency regularity over the last 90 days (0-100) */
  consistency: number
  /** Portfolio depth: stars, size, tenure, breadth (0-100) */
  projectDepth: number
  /** Weighted average of all dimensions (0-100) */
  overallScore: number
}

// ─── AI insights ─────────────────────────────────────────────────────────────

export interface CareerFitEntry {
  role: string
  /** 0-100 fit confidence, evidence-based */
  confidence: number
}

export interface AIInsights {
  /** 3-4 sentence overall assessment referencing actual metrics */
  summary: string
  /** Specific strengths, each citing data */
  strengths: string[]
  /** Honest weaknesses, each citing what is missing */
  weaknesses: string[]
  /** Actionable next steps tied to evidenced gaps */
  recommendations: string[]
  /** Sorted by confidence descending */
  careerFit: CareerFitEntry[]
}

// ─── API contract ─────────────────────────────────────────────────────────────

export interface AnalyzeRequest {
  username: string
}

export interface AnalysisResult {
  profile: NormalizedProfile
  scores: DeveloperScores
  insights: AIInsights
  analyzedAt: string
  /** True when result came from server-side cache */
  cached?: boolean
}

export interface AnalysisError {
  error: string
  code: ErrorCode
  /** Optional extra context, omitted in production client responses */
  details?: string
}
