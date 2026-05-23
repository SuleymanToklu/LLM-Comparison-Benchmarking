import { NextRequest, NextResponse } from "next/server";
import { fetchUserProfile, fetchUserEvents, fetchUserRepos } from "../../../lib/github/fetcher";
import { analyzeActivity } from "../../../lib/analyzers/activityAnalyzer";
import { analyzeLanguages, evaluateExposure } from "../../../lib/analyzers/languageAnalyzer";
import { checkEngineeringSignals } from "../../../lib/analyzers/engineeringAnalyzer";
import { calculateScores } from "../../../lib/scoring/scoreEngine";
import { generateInsights } from "../../../lib/ai/insightGenerator";
import { NormalizedProfile, AnalysisResult, GitHubUser } from "../../../types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username } = body;

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const [user, repos, events] = await Promise.all([
      fetchUserProfile(username),
      fetchUserRepos(username),
      fetchUserEvents(username)
    ]);

    const activity = analyzeActivity(events, repos);
    const topLanguages = analyzeLanguages(repos);
    const engineeringSignals = await checkEngineeringSignals(username, repos);

    const frontendExposure = evaluateExposure(repos, ["react", "vue", "next.js", "tailwind", "angular", "svelte", "css", "html", "frontend"]);
    const backendExposure = evaluateExposure(repos, ["express", "fastapi", "django", "nestjs", "spring", "laravel", "backend", "node", "sql"]);
    const devopsExposure = evaluateExposure(repos, ["docker", "github actions", "ci/cd", "deployment", "kubernetes", "aws", "terraform"]);
    const mlExposure = evaluateExposure(repos, ["python", "jupyter", "tensorflow", "pytorch", "scikit-learn", "machine learning", "ai", "data"]);

    const profile: NormalizedProfile = {
      username: user.login,
      totalRepos: user.public_repos || repos.length,
      ownedRepos: repos.length,
      activeReposLast90Days: activity.activeReposLast90Days,
      avgCommitsPerWeek: activity.avgCommitsPerWeek,
      topLanguages,
      hasTests: engineeringSignals.hasTests,
      hasDockerfile: engineeringSignals.hasDockerfile,
      hasCICD: engineeringSignals.hasCICD,
      hasReadme: engineeringSignals.hasReadme,
      hasDeployment: engineeringSignals.hasDeployment,
      frontendExposure,
      backendExposure,
      devopsExposure,
      mlExposure,
      repoQualityScore: engineeringSignals.hasTests ? 100 : 0,
      consistencyScore: activity.consistencyScore,
    };

    const scores = calculateScores(profile, repos);
    
    let insights;
    try {
      insights = await generateInsights(profile, scores);
    } catch (e) {
      console.error("AI Generation failed:", e);
      insights = {
        summary: "AI analysis currently unavailable.",
        strengths: [],
        weaknesses: [],
        recommendations: [],
        careerFit: []
      };
    }

    const githubUser: GitHubUser = {
      name: user.name || user.login,
      avatar_url: user.avatar_url,
      bio: user.bio || "No bio available.",
      location: user.location || "Unknown location",
      followers: user.followers,
      following: user.following,
      public_repos: user.public_repos
    };

    const result: AnalysisResult = { profile, scores, insights, user: githubUser };
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API Error:", error);
    if (error.message === 'User not found') {
      return NextResponse.json({ error: "GitHub user not found" }, { status: 404 });
    }
    if (error.message === 'Rate limit exceeded') {
      return NextResponse.json({ error: "GitHub API rate limit exceeded" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
