You are a senior full-stack engineer. Build a complete, production-ready Developer Profile Analyzer web application from scratch.

## What This App Does

A user enters a GitHub username. The app fetches their public GitHub data, runs a structured analysis, and generates a meaningful developer profile with strengths, weaknesses, and actionable recommendations — powered by Gemini 2.0 Flash API.

## Tech Stack

- Framework: Next.js 14 (App Router, TypeScript)
- Styling: Tailwind CSS
- Charts: Recharts
- AI: Google Gemini 2.0 Flash API — use GEMINI_API_KEY from env
- GitHub: GitHub REST API — use GITHUB_TOKEN from env (optional)
- Caching: In-memory cache (simple Map, no database)

## Project Structure

src/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── api/
│       └── analyze/
│           └── route.ts
├── lib/
│   ├── github/
│   │   └── fetcher.ts
│   ├── analyzers/
│   │   ├── languageAnalyzer.ts
│   │   ├── activityAnalyzer.ts
│   │   ├── repoQualityAnalyzer.ts
│   │   └── engineeringAnalyzer.ts
│   ├── scoring/
│   │   └── scoreEngine.ts
│   └── ai/
│       └── insightGenerator.ts
└── types/
└── index.ts

## System Flow

User Input → Fetch Layer → Normalization → Rule Engine → AI Layer → Dashboard UI

## GitHub API Endpoints

GET /users/:username
GET /users/:username/repos?per_page=100&sort=updated
GET /users/:username/events/public?per_page=100

Rules:

- Exclude forked repositories from all analysis
- Only analyze repos owned by the user

## Normalization Layer (CRITICAL)

Transform raw data into this exact structure:

interface NormalizedProfile {
username: string
totalRepos: number
ownedRepos: number
activeReposLast90Days: number
topLanguages: { name: string; percentage: number }[]
avgCommitsPerWeek: number
hasTests: boolean
hasDockerfile: boolean
hasCICD: boolean
hasReadme: boolean
hasDeployment: boolean
frontendExposure: "none" | "low" | "medium" | "high"
backendExposure: "none" | "low" | "medium" | "high"
devopsExposure: "none" | "low" | "medium" | "high"
mlExposure: "none" | "low" | "medium" | "high"
repoQualityScore: number
consistencyScore: number
}

## Rule Engine

Compute these scores deterministically BEFORE calling AI:

interface DeveloperScores {
backend: number
frontend: number
devops: number
testing: number
consistency: number
projectDepth: number
overallScore: number
}

Scoring logic:

- testing: +40 if any repo has test files, +30 if >30% repos have tests, +30 if CI/CD detected
- devops: +40 if Dockerfile found, +30 if GitHub Actions found, +30 if deployment config found
- consistency: based on commit frequency over last 90 days
- projectDepth: based on avg repo size, stars, non-fork ratio
- frontend: detect React, Vue, Next.js, Tailwind, Angular, Svelte
- backend: detect Express, FastAPI, Django, NestJS, Spring, Laravel
- overallScore: weighted average of all scores

## AI Layer — Gemini 2.0 Flash

Send ONLY normalized profile + scores to Gemini. Never send raw GitHub JSON.

System prompt to use:
"You are a senior engineering career advisor. Analyze the developer profile and generate structured insights.
Rules:

- Be specific. Reference actual numbers and technologies.
- No generic advice. Every recommendation must be tied to evidence.
- No flattery. Be honest about weaknesses.
- Keep each insight to 1-2 sentences max.
Return valid JSON only, no markdown."

Expected JSON output:
interface AIInsights {
summary: string
strengths: string[]
weaknesses: string[]
recommendations: string[]
careerFit: { role: string; confidence: number }[]
}

## UI Requirements

Landing State:

- Clean hero section
- GitHub username input
- Submit button

Loading State:

- Skeleton loaders
- Status messages: "Fetching repositories...", "Analyzing patterns...", "Generating insights..."

Dashboard:

1. Profile Header — avatar, name, bio, stats
2. Skill Radar — RadarChart: Backend, Frontend, DevOps, Testing, Consistency, Project Depth
3. Language Distribution — BarChart top languages
4. AI Insights — Strengths (green), Weaknesses (red), Recommendations (blue)
5. Career Fit — roles with confidence percentages
6. Engineering Maturity — checklist: Tests, Docker, CI/CD, README, Deployment

## Error Handling

- GitHub user not found (404)
- Rate limit exceeded (403)
- No public repositories
- Gemini API failure (show partial results)
- Network errors

## Environment Variables

GITHUB_TOKEN=optional
GEMINI_API_KEY=required

## Deliverables

1. Complete runnable Next.js project
2. All files in the structure above
3. .env.example
4. README.md with setup instructions

## Definition of Done

- Any GitHub username returns full analysis
- Forked repos excluded
- Scores computed deterministically
- AI insights reference real data
- Engineering maturity shows real signals
- Graceful error handling
- Clean responsive UI

Start by generating all files. Do not ask clarifying questions. Build the complete project.