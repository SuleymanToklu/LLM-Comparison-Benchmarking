import { analyzeActivity } from "@/lib/analyzers/activityAnalyzer"
import { analyzeEngineering } from "@/lib/analyzers/engineeringAnalyzer"
import { analyzeLanguages } from "@/lib/analyzers/languageAnalyzer"
import { generateInsights } from "@/lib/ai/insightGenerator"
import { FetcherError, fetchUserEvents, fetchUserProfile, fetchUserRepos } from "@/lib/github/fetcher"
import { computeScores } from "@/lib/scoring/scoreEngine"
import type {
  AIInsights,
  AnalysisResult,
  ExposureLevel,
  GitHubRepo,
  LanguageShare,
  NormalizedProfile
} from "@/types"
import { NextRequest, NextResponse } from "next/server"

const CACHE_TTL_MS = 1000 * 60 * 10
const responseCache = new Map<string, { data: AnalysisResult; expiresAt: number }>()

const FRONTEND_STACK = ["react", "vue", "next", "tailwind", "angular", "svelte"]
const BACKEND_STACK = ["express", "fastapi", "django", "nestjs", "spring", "laravel"]
const DEVOPS_STACK = ["docker", "kubernetes", "terraform", "ansible", "helm", "github-actions"]
const ML_STACK = ["tensorflow", "pytorch", "scikit", "machine-learning", "llm"]

function detectExposure(repos: GitHubRepo[], keywords: string[]): ExposureLevel {
  let hits = 0

  for (const repo of repos) {
    const text = [repo.name, repo.description ?? "", ...(repo.topics ?? []), repo.language ?? ""]
      .join(" ")
      .toLowerCase()

    if (keywords.some((keyword) => text.includes(keyword))) {
      hits += 1
    }
  }

  const ratio = repos.length === 0 ? 0 : hits / repos.length
  if (ratio === 0) return "none"
  if (ratio < 0.25) return "low"
  if (ratio < 0.6) return "medium"
  return "high"
}

function computeRepoQualityScore(signals: {
  testRepoRatio: number
  reposWithReadmeRatio: number
  reposWithCICDRatio: number
  reposWithDockerRatio: number
}) {
  const score =
    signals.testRepoRatio * 30 +
    signals.reposWithReadmeRatio * 30 +
    signals.reposWithCICDRatio * 20 +
    signals.reposWithDockerRatio * 20

  return Number(Math.min(100, Math.max(0, score)).toFixed(2))
}

function emptyInsightsFallback(): AIInsights {
  return {
    summary: "AI insights unavailable. Deterministic profile analysis is shown.",
    strengths: [],
    weaknesses: [],
    recommendations: [],
    careerFit: []
  }
}

export async function POST(req: NextRequest) {
  let username = ""

  try {
    const body = (await req.json()) as { username?: string }
    username = (body.username ?? "").trim()
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
  }

  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 })
  }

  const cacheKey = username.toLowerCase()
  const cached = responseCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data)
  }

  try {
    const [user, repos, events] = await Promise.all([
      fetchUserProfile(username),
      fetchUserRepos(username),
      fetchUserEvents(username)
    ])

    if (repos.length === 0) {
      return NextResponse.json({ error: "No public repositories available for analysis" }, { status: 422 })
    }

    const topLanguages: LanguageShare[] = analyzeLanguages(repos)
    const activity = analyzeActivity(events)
    const engineering = await analyzeEngineering(repos)

    const normalized: NormalizedProfile = {
      username: user.login,
      totalRepos: user.public_repos,
      ownedRepos: repos.length,
      activeReposLast90Days: activity.activeReposLast90Days,
      topLanguages,
      avgCommitsPerWeek: activity.avgCommitsPerWeek,
      hasTests: engineering.hasTests,
      hasDockerfile: engineering.hasDockerfile,
      hasCICD: engineering.hasCICD,
      hasReadme: engineering.hasReadme,
      hasDeployment: engineering.hasDeployment,
      frontendExposure: detectExposure(repos, FRONTEND_STACK),
      backendExposure: detectExposure(repos, BACKEND_STACK),
      devopsExposure: detectExposure(repos, DEVOPS_STACK),
      mlExposure: detectExposure(repos, ML_STACK),
      repoQualityScore: computeRepoQualityScore(engineering),
      consistencyScore: activity.consistencyScore
    }

    const scores = computeScores(normalized)
    const warnings: string[] = []

    let insights: AIInsights | null
    try {
      insights = await generateInsights(normalized, scores)
    } catch {
      warnings.push("Gemini insights unavailable. Returning deterministic analysis only.")
      insights = emptyInsightsFallback()
    }

    const result: AnalysisResult = {
      user,
      normalized,
      scores,
      insights,
      warnings,
      fetchedAt: new Date().toISOString()
    }

    responseCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof FetcherError) {
      if (error.code === "NOT_FOUND") {
        return NextResponse.json({ error: "GitHub user not found" }, { status: 404 })
      }

      if (error.code === "RATE_LIMIT") {
        return NextResponse.json({ error: "GitHub rate limit exceeded or access forbidden" }, { status: 403 })
      }

      if (error.code === "NETWORK") {
        return NextResponse.json({ error: "Network error while contacting GitHub" }, { status: 503 })
      }
    }

    return NextResponse.json({ error: "Failed to analyze developer profile" }, { status: 500 })
  }
}
