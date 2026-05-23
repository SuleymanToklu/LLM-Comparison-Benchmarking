import { NextRequest, NextResponse } from "next/server";
import { buildFallbackInsights, generateAIInsights } from "@/lib/ai/insightGenerator";
import { analyzeActivity } from "@/lib/analyzers/activityAnalyzer";
import { analyzeEngineeringSignals } from "@/lib/analyzers/engineeringAnalyzer";
import { analyzeLanguages, sumLanguagePercentages, toLanguagePercentageMap } from "@/lib/analyzers/languageAnalyzer";
import {
  fetchUserEvents,
  fetchUserProfile,
  fetchUserRepos,
  getLatestGitHubRateLimit,
  GitHubApiError
} from "@/lib/github/fetcher";
import { calculateDeveloperScores } from "@/lib/scoring/scoreEngine";
import type {
  ActivityAnalysis,
  AIInsights,
  AnalysisResponse,
  AnalyzedRepository,
  DeveloperScores,
  EngineeringSignals,
  ErrorResponse,
  ExposureLevel,
  GitHubProfileSummary,
  GitHubRepo,
  GitHubUser,
  LanguageShare,
  NormalizedProfile,
  ScoringContext
} from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USERNAME_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const FRONTEND_LANGUAGES = ["JavaScript", "TypeScript", "HTML", "CSS", "SCSS", "Vue", "Svelte"];
const BACKEND_LANGUAGES = ["Python", "JavaScript", "TypeScript", "Java", "Go", "PHP", "Ruby", "C#", "Kotlin", "Rust"];
const ML_LANGUAGES = ["Python", "Jupyter Notebook", "R", "Julia"];

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const validationError = validateUsername(username);

  if (validationError) {
    return NextResponse.json<ErrorResponse>({ error: "Invalid GitHub username", detail: validationError }, { status: 400 });
  }

  try {
    const user = await fetchUserProfile(username);
    const [repos, events] = await Promise.all([fetchUserRepos(user.login), fetchUserEvents(user.login)]);

    if (user.public_repos === 0) {
      return NextResponse.json<ErrorResponse>(
        {
          error: "No public repositories",
          detail: `@${user.login} does not have public repositories available for analysis.`
        },
        { status: 422 }
      );
    }

    if (repos.length === 0) {
      return NextResponse.json<ErrorResponse>(
        {
          error: "No owned repositories",
          detail: "After excluding forked repositories, there are no owned repositories to analyze."
        },
        { status: 422 }
      );
    }

    const [languages, activity, engineering] = await Promise.all([
      Promise.resolve(analyzeLanguages(repos)),
      Promise.resolve(analyzeActivity(events)),
      analyzeEngineeringSignals(repos)
    ]);
    const normalized = buildNormalizedProfile(user, repos, languages, activity, engineering);
    const scoringContext = buildScoringContext(repos, engineering);
    const scores = calculateDeveloperScores(normalized, scoringContext);
    const aiResult = await buildInsights(normalized, scores);
    const response: AnalysisResponse = {
      profile: toProfileSummary(user),
      normalized,
      scores,
      insights: aiResult.insights,
      aiStatus: aiResult.status,
      activity,
      quality: engineering,
      repositories: toAnalyzedRepositories(repos, engineering),
      warnings: engineering.warnings,
      rateLimit: getLatestGitHubRateLimit(),
      cached: false,
      generatedAt: new Date().toISOString()
    };

    return NextResponse.json<AnalysisResponse>(response);
  } catch (error) {
    return handleRouteError(error);
  }
}

async function readBody(request: NextRequest): Promise<{ username?: unknown }> {
  try {
    return (await request.json()) as { username?: unknown };
  } catch {
    return {};
  }
}

function buildNormalizedProfile(
  user: GitHubUser,
  repos: GitHubRepo[],
  languages: LanguageShare[],
  activity: ActivityAnalysis,
  engineering: EngineeringSignals
): NormalizedProfile {
  const languagePercentages = toLanguagePercentageMap(languages);
  return {
    username: user.login,
    totalRepos: user.public_repos,
    ownedRepos: repos.length,
    activeReposLast90Days: activity.activeReposLast90Days,
    topLanguages: languages,
    avgCommitsPerWeek: activity.avgCommitsPerWeek,
    hasTests: engineering.hasTests,
    hasDockerfile: engineering.hasDockerfile,
    hasCICD: engineering.hasCICD,
    hasReadme: engineering.hasReadme,
    hasDeployment: engineering.hasDeployment,
    frontendExposure: calculateFrontendExposure(repos.length, engineering, languagePercentages),
    backendExposure: calculateBackendExposure(repos.length, engineering, languagePercentages),
    devopsExposure: calculateDevopsExposure(repos.length, engineering),
    mlExposure: calculateMlExposure(repos.length, engineering, languagePercentages),
    repoQualityScore: engineering.repoQualityScore,
    consistencyScore: activity.consistencyScore
  };
}

function buildScoringContext(repos: GitHubRepo[], engineering: EngineeringSignals): ScoringContext {
  return {
    reposWithTests: engineering.reposWithTests,
    avgRepoSizeKb: repos.length > 0 ? roundToOne(repos.reduce((sum, repo) => sum + repo.size, 0) / repos.length) : 0,
    totalStars: repos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
    frontendTechnologyCount: engineering.frontendTechnologies.length,
    backendTechnologyCount: engineering.backendTechnologies.length,
    devopsTechnologyCount: engineering.devopsTechnologies.length
  };
}

async function buildInsights(
  normalized: NormalizedProfile,
  scores: DeveloperScores
): Promise<{ insights: AIInsights; status: AnalysisResponse["aiStatus"] }> {
  try {
    return {
      insights: await generateAIInsights(normalized, scores),
      status: { ok: true }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini insight generation failed.";
    return {
      insights: buildFallbackInsights(normalized, scores),
      status: {
        ok: false,
        error: message
      }
    };
  }
}

function calculateFrontendExposure(
  repoCount: number,
  engineering: EngineeringSignals,
  languagePercentages: Record<string, number>
): ExposureLevel {
  const score =
    ratio(engineering.frontendRepoCount, repoCount) * 58 +
    sumLanguagePercentages(languagePercentages, FRONTEND_LANGUAGES) * 0.32 +
    Math.min(engineering.frontendTechnologies.length * 4, 10);
  return scoreToExposure(score);
}

function calculateBackendExposure(
  repoCount: number,
  engineering: EngineeringSignals,
  languagePercentages: Record<string, number>
): ExposureLevel {
  const score =
    ratio(engineering.backendRepoCount, repoCount) * 58 +
    sumLanguagePercentages(languagePercentages, BACKEND_LANGUAGES) * 0.28 +
    Math.min(engineering.backendTechnologies.length * 4, 14);
  return scoreToExposure(score);
}

function calculateDevopsExposure(repoCount: number, engineering: EngineeringSignals): ExposureLevel {
  const score =
    ratio(engineering.devopsRepoCount, repoCount) * 54 +
    ratio(engineering.reposWithDockerfile, repoCount) * 16 +
    ratio(engineering.reposWithCICD, repoCount) * 18 +
    ratio(engineering.reposWithDeployment, repoCount) * 12;
  return scoreToExposure(score);
}

function calculateMlExposure(
  repoCount: number,
  engineering: EngineeringSignals,
  languagePercentages: Record<string, number>
): ExposureLevel {
  const score =
    ratio(engineering.mlRepoCount, repoCount) * 66 +
    sumLanguagePercentages(languagePercentages, ML_LANGUAGES) * 0.24 +
    Math.min(engineering.mlTechnologies.length * 5, 10);
  return scoreToExposure(score);
}

function toProfileSummary(user: GitHubUser): GitHubProfileSummary {
  return {
    username: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    htmlUrl: user.html_url,
    bio: user.bio,
    location: user.location,
    company: user.company,
    blog: user.blog,
    publicRepos: user.public_repos,
    followers: user.followers,
    following: user.following,
    createdAt: user.created_at
  };
}

function toAnalyzedRepositories(repos: GitHubRepo[], engineering: EngineeringSignals): AnalyzedRepository[] {
  const signalByRepo = new Map(engineering.repoSignals.map((signal) => [signal.repoFullName.toLowerCase(), signal]));

  return repos.map((repo) => ({
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    description: repo.description,
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    size: repo.size,
    pushedAt: repo.pushed_at,
    updatedAt: repo.updated_at,
    topics: repo.topics ?? [],
    signals: signalByRepo.get(repo.full_name.toLowerCase()) ?? null
  }));
}

function validateUsername(username: string): string | null {
  if (!username) {
    return "Enter a username before running analysis.";
  }

  if (!USERNAME_PATTERN.test(username)) {
    return "GitHub usernames are 1-39 characters and may contain letters, numbers, or hyphens, but cannot start or end with a hyphen.";
  }

  return null;
}

function handleRouteError(error: unknown) {
  if (error instanceof GitHubApiError) {
    if (error.code === "not_found") {
      return NextResponse.json<ErrorResponse>(
        {
          error: "GitHub user not found",
          detail: "Check the username and try again."
        },
        { status: 404 }
      );
    }

    if (error.code === "rate_limited") {
      return NextResponse.json<ErrorResponse>(
        {
          error: "GitHub rate limit exceeded",
          detail: rateLimitDetail(error)
        },
        { status: 403 }
      );
    }

    if (error.code === "forbidden") {
      return NextResponse.json<ErrorResponse>(
        {
          error: "GitHub request forbidden",
          detail: error.message
        },
        { status: 403 }
      );
    }

    if (error.code === "network") {
      return NextResponse.json<ErrorResponse>(
        {
          error: "GitHub network error",
          detail: error.message
        },
        { status: 503 }
      );
    }

    return NextResponse.json<ErrorResponse>(
      {
        error: "GitHub API error",
        detail: error.message
      },
      { status: error.status || 502 }
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json<ErrorResponse>(
    {
      error: "Analysis failed",
      detail: message
    },
    { status: 500 }
  );
}

function rateLimitDetail(error: GitHubApiError): string {
  if (!error.rateLimit?.resetAt) {
    return "GitHub rejected the request due to rate limiting. Add GITHUB_TOKEN or retry later.";
  }

  return `GitHub API limit is exhausted. Add GITHUB_TOKEN or retry after ${error.rateLimit.resetAt}.`;
}

function scoreToExposure(score: number): ExposureLevel {
  if (score <= 0) {
    return "none";
  }
  if (score < 24) {
    return "low";
  }
  if (score < 55) {
    return "medium";
  }

  return "high";
}

function ratio(value: number, total: number): number {
  return total > 0 ? value / total : 0;
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}
