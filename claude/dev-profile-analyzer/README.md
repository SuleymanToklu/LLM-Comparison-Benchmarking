# DevProfile Analyzer

AI-powered GitHub developer profile analyzer. Enter any GitHub username and get structured insights into skills, strengths, weaknesses, and career fit — powered by Gemini 2.0 Flash.

## Features

- **GitHub Data Fetching** — Repos, events, and profile info via GitHub REST API
- **Deterministic Scoring** — Backend, Frontend, DevOps, Testing, Consistency, and Project Depth scores computed before AI
- **AI Insights** — Gemini 2.0 Flash generates specific, evidence-based strengths, weaknesses, and recommendations
- **Skill Radar** — Radar chart visualization of computed scores
- **Language Distribution** — Bar chart of top languages across owned repos
- **Engineering Maturity** — Checklist for Tests, Docker, CI/CD, README, and Deployment config
- **Career Fit** — AI-suggested roles with confidence percentages
- **Caching** — In-memory 10-minute cache to avoid repeated API calls
- **Error Handling** — Graceful handling of 404, rate limits, missing repos, and AI failures

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **AI**: Google Gemini 2.0 Flash
- **Icons**: Lucide React

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd dev-profile-analyzer
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key

# Optional (recommended to avoid rate limits)
GITHUB_TOKEN=your_github_token
```

**Get your Gemini API key**: [Google AI Studio](https://aistudio.google.com/app/apikey)  
**Get your GitHub token**: [GitHub Settings → Tokens](https://github.com/settings/tokens) (no scopes needed for public data)

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main UI page
│   ├── layout.tsx            # Root layout
│   └── api/
│       └── analyze/
│           └── route.ts      # API endpoint: GET /api/analyze?username=
├── lib/
│   ├── github/
│   │   └── fetcher.ts        # GitHub API calls
│   ├── analyzers/
│   │   ├── languageAnalyzer.ts     # Language & exposure detection
│   │   ├── activityAnalyzer.ts     # Commit frequency & activity
│   │   ├── repoQualityAnalyzer.ts  # Tests, Docker, CI/CD detection
│   │   └── engineeringAnalyzer.ts  # Framework detection & project depth
│   ├── scoring/
│   │   └── scoreEngine.ts    # Deterministic score computation
│   └── ai/
│       └── insightGenerator.ts # Gemini 2.0 Flash integration
├── components/
│   ├── ProfileHeader.tsx     # Avatar, name, stats
│   ├── SkillRadar.tsx        # Recharts RadarChart
│   ├── LanguageChart.tsx     # Recharts BarChart
│   ├── AIInsightsPanel.tsx   # Strengths/Weaknesses/Recommendations
│   ├── CareerFitPanel.tsx    # Role confidence bars
│   ├── EngineeringMaturity.tsx # Engineering checklist
│   └── SkeletonLoader.tsx    # Loading state
└── types/
    └── index.ts              # TypeScript interfaces
```

## API

### `GET /api/analyze?username=<github_username>`

Returns a full `AnalysisResult` object:

```typescript
{
  profile: NormalizedProfile   // Normalized GitHub data
  scores: DeveloperScores      // Deterministic skill scores (0-100)
  insights: AIInsights         // Gemini-generated insights
  analyzedAt: string           // ISO timestamp
}
```

## Analysis Pipeline

```
User Input
    ↓
GitHub API (user, repos, events)
    ↓
Filter: exclude forks, keep owned repos only
    ↓
Parallel analysis:
  - Language & exposure detection
  - Activity & commit frequency
  - Repo quality signals (tests, docker, CI/CD)
  - Project depth metrics
    ↓
Normalized Profile (NormalizedProfile)
    ↓
Rule Engine → DeveloperScores (deterministic)
    ↓
Gemini 2.0 Flash → AIInsights
    ↓
Cache + Return
```

## Rate Limits

- Without `GITHUB_TOKEN`: 60 requests/hour per IP
- With `GITHUB_TOKEN`: 5,000 requests/hour
- Results are cached for 10 minutes to minimize API calls

## Deployment

### Vercel (recommended)

```bash
npx vercel
```

Set environment variables in Vercel dashboard:
- `GEMINI_API_KEY` (required)
- `GITHUB_TOKEN` (optional)
