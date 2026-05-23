# prompt 2

Now implement Prompt 2 — Backend Layer only.
Refine and improve the backend files you already created.
Focus on making them production-ready and bug-free.

---

Build only the backend layer of a Developer Profile Analyzer.

Tech: Next.js 14 API routes, TypeScript, Gemini 2.0 Flash API, GitHub REST API.

Create these files:

1. src/lib/github/fetcher.ts
- fetchUserProfile(username): calls /users/:username
- fetchUserRepos(username): calls /users/:username/repos, filters out forks
- fetchUserEvents(username): calls /users/:username/events/public
- Handle 404, 403, network errors
- In-memory cache with 24h TTL using Map
1. src/lib/analyzers/languageAnalyzer.ts
- Input: repo list
- Output: { name: string, percentage: number }[] sorted by usage
1. src/lib/analyzers/activityAnalyzer.ts
- Input: events list
- Output: { avgCommitsPerWeek: number, activeReposLast90Days: number, consistencyScore: number }
1. src/lib/analyzers/engineeringAnalyzer.ts
- Input: repo list
- Detect: hasTests, hasDockerfile, hasCICD, hasReadme, hasDeployment
- Method: check repo file tree via /repos/:owner/:repo/contents
- Output: EngineeringSignals interface
1. src/lib/scoring/scoreEngine.ts
- Input: NormalizedProfile
- Output: DeveloperScores { backend, frontend, devops, testing, consistency, projectDepth, overallScore }
- All scores 0-100, computed deterministically
1. src/lib/ai/insightGenerator.ts
- Input: NormalizedProfile + DeveloperScores
- Call Gemini 2.0 Flash with structured prompt
- Return: AIInsights { summary, strengths, weaknesses, recommendations, careerFit }
1. src/app/api/analyze/route.ts
- POST endpoint, body: { username: string }
- Orchestrates all above modules
- Returns complete analysis as JSON
1. src/types/index.ts
- All TypeScript interfaces

Include all imports. Make it production-ready. No placeholder code.