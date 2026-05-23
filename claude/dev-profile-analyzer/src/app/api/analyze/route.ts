import { NextRequest, NextResponse } from 'next/server'
import {
  fetchUserProfile,
  fetchUserRepos,
  fetchUserEvents,
  GitHubAPIError,
} from '@/lib/github/fetcher'
import {
  computeLanguageDistribution,
  analyzeExposure,
} from '@/lib/analyzers/languageAnalyzer'
import { analyzeActivity }           from '@/lib/analyzers/activityAnalyzer'
import { analyzeEngineeringSignals } from '@/lib/analyzers/engineeringAnalyzer'
import { computeScores }             from '@/lib/scoring/scoreEngine'
import { generateInsights }          from '@/lib/ai/insightGenerator'
import {
  NormalizedProfile,
  AnalysisResult,
  AnalysisError,
  AnalyzeRequest,
  EngineeringSignals,
  ErrorCode,
} from '@/types'

// ─── Result cache ─────────────────────────────────────────────────────────────

interface ResultEntry {
  result: AnalysisResult
  expiresAt: number
}

const resultCache = new Map<string, ResultEntry>()
const RESULT_TTL  = 10 * 60 * 1000 // 10 minutes

function getCache(username: string): AnalysisResult | null {
  const entry = resultCache.get(username)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    resultCache.delete(username)
    return null
  }
  return entry.result
}

function setCache(username: string, result: AnalysisResult): void {
  resultCache.set(username, { result, expiresAt: Date.now() + RESULT_TTL })
}

// ─── Input validation ─────────────────────────────────────────────────────────

/**
 * Validate and normalise a raw username string.
 *
 * GitHub username rules:
 * - 1–39 characters
 * - Alphanumeric or hyphens
 * - Cannot start or end with a hyphen
 * - No consecutive hyphens
 *
 * Returns the lowercased username, or `null` if invalid.
 */
function validateUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > 39) return null
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(trimmed)) return null
  if (/--/.test(trimmed)) return null
  return trimmed.toLowerCase()
}

// ─── Error response helpers ───────────────────────────────────────────────────

const HTTP_STATUS: Partial<Record<ErrorCode, number>> = {
  USER_NOT_FOUND:    404,
  RATE_LIMITED:      429,
  NO_PUBLIC_REPOS:   422,
  INVALID_USERNAME:  400,
  NETWORK_ERROR:     502,
  INTERNAL_ERROR:    500,
}

function errorResponse(
  code: ErrorCode,
  message: string,
  status?: number
): NextResponse<AnalysisError> {
  return NextResponse.json<AnalysisError>(
    { error: message, code },
    { status: status ?? HTTP_STATUS[code] ?? 500 }
  )
}

// ─── Quality score helper ─────────────────────────────────────────────────────

function computeRepoQualityScore(signals: EngineeringSignals): number {
  let score = 0
  if (signals.hasReadme)     score += 25
  if (signals.hasTests)      score += 25
  if (signals.hasCICD)       score += 20
  if (signals.hasDockerfile) score += 15
  if (signals.hasDeployment) score += 10

  // Bonus: >30% of analysed repos have tests
  if (signals.reposAnalyzed > 0 && signals.reposWithTests / signals.reposAnalyzed > 0.3) {
    score += 5
  }

  return Math.min(100, score)
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/**
 * POST /api/analyze
 * Body: { username: string }
 *
 * Orchestrates the full analysis pipeline:
 *   GitHub fetch → normalise → deterministic scores → AI insights
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: AnalyzeRequest
  try {
    body = (await request.json()) as AnalyzeRequest
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Request body must be valid JSON', 400)
  }

  const username = validateUsername(body?.username)
  if (!username) {
    return errorResponse(
      'INVALID_USERNAME',
      'Invalid GitHub username. Must be 1–39 characters, alphanumeric and hyphens, no leading/trailing/consecutive hyphens.',
      400
    )
  }

  // ── Cache hit ──────────────────────────────────────────────────────────────
  const cached = getCache(username)
  if (cached) {
    return NextResponse.json<AnalysisResult>({ ...cached, cached: true })
  }

  try {
    // ── Stage 1: Parallel fetch ──────────────────────────────────────────────
    const [user, ownedRepos, events] = await Promise.all([
      fetchUserProfile(username),
      fetchUserRepos(username),   // already filtered: no forks, owner === username
      fetchUserEvents(username),
    ])

    if (ownedRepos.length === 0) {
      return errorResponse(
        'NO_PUBLIC_REPOS',
        `@${username} has no public owned repositories to analyse.`,
        422
      )
    }

    // ── Stage 2: Parallel analysis ───────────────────────────────────────────
    // Language + exposure are synchronous; engineering signals are async (file tree API calls)
    const languageDistribution = computeLanguageDistribution(ownedRepos)
    const exposure             = analyzeExposure(ownedRepos)
    const activity             = analyzeActivity(events, ownedRepos)

    const engineeringSignals = await analyzeEngineeringSignals(ownedRepos, username)

    // ── Stage 3: Build NormalizedProfile ────────────────────────────────────
    const accountCreated = new Date(user.created_at)
    const accountAgeDays = Math.floor(
      (Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24)
    )

    const totalStars  = ownedRepos.reduce((acc, r) => acc + r.stargazers_count, 0)
    const avgRepoSize = ownedRepos.length > 0
      ? Math.round(ownedRepos.reduce((acc, r) => acc + r.size, 0) / ownedRepos.length)
      : 0

    const repoQualityScore = computeRepoQualityScore(engineeringSignals)

    const profile: NormalizedProfile = {
      // Identity
      username:    user.login,
      displayName: user.name,
      bio:         user.bio,
      avatarUrl:   user.avatar_url,
      profileUrl:  user.html_url,
      location:    user.location,
      company:     user.company ? user.company.replace(/^@/, '') : null,
      websiteUrl:  user.blog?.startsWith('http') ? user.blog : user.blog ? `https://${user.blog}` : null,

      // Account
      followers:     user.followers,
      following:     user.following,
      accountAgeDays,

      // Repositories
      totalPublicRepos: user.public_repos,
      ownedRepos:       ownedRepos.length,
      forkedRepos:      user.public_repos - ownedRepos.length,
      totalStars,
      avgRepoSize,

      // Language
      topLanguages: languageDistribution,

      // Activity
      avgCommitsPerWeek:     activity.avgCommitsPerWeek,
      activeReposLast90Days: activity.activeReposLast90Days,
      consistencyScore:      activity.consistencyScore,

      // Engineering maturity
      hasTests:      engineeringSignals.hasTests,
      hasDockerfile: engineeringSignals.hasDockerfile,
      hasCICD:       engineeringSignals.hasCICD,
      hasReadme:     engineeringSignals.hasReadme,
      hasDeployment: engineeringSignals.hasDeployment,
      reposWithTests:  engineeringSignals.reposWithTests,
      reposWithReadme: engineeringSignals.reposWithReadme,
      reposAnalyzed:   engineeringSignals.reposAnalyzed,

      // Tech domain
      frontendExposure: exposure.frontendExposure,
      backendExposure:  exposure.backendExposure,
      devopsExposure:   exposure.devopsExposure,
      mlExposure:       exposure.mlExposure,

      detectedFrontendFrameworks: exposure.detectedFrontendFrameworks,
      detectedBackendFrameworks:  exposure.detectedBackendFrameworks,
      detectedDevOpsTools:        exposure.detectedDevOpsTools,
      detectedMLFrameworks:       exposure.detectedMLFrameworks,

      repoQualityScore,
    }

    // ── Stage 4: Deterministic scoring ──────────────────────────────────────
    const scores = computeScores(profile)

    // ── Stage 5: AI insights ─────────────────────────────────────────────────
    const insights = await generateInsights(profile, scores)

    // ── Stage 6: Assemble, cache, and return ─────────────────────────────────
    const result: AnalysisResult = {
      profile,
      scores,
      insights,
      analyzedAt: new Date().toISOString(),
    }

    setCache(username, result)
    return NextResponse.json<AnalysisResult>(result)

  } catch (err) {
    // ── Known GitHub API errors ──────────────────────────────────────────────
    if (err instanceof GitHubAPIError) {
      return errorResponse(err.code, err.message)
    }

    // ── Unexpected errors ────────────────────────────────────────────────────
    console.error('[POST /api/analyze] Unexpected error:', err)
    return errorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred during analysis. Please try again.'
    )
  }
}

/**
 * GET /api/analyze?username=<username>
 *
 * Convenience alias for clients that cannot issue POST requests (e.g. curl tests,
 * browser address-bar).  Delegates directly to the POST handler.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const username = request.nextUrl.searchParams.get('username')
  if (!username) {
    return errorResponse('INVALID_USERNAME', 'Missing required query parameter: username', 400)
  }

  // Re-use POST logic by creating a synthetic request with the same URL but a JSON body
  const syntheticPost = new NextRequest(request.url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username }),
  })

  return POST(syntheticPost)
}
