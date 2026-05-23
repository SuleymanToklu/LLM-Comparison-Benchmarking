# Developer Profile Analyzer

Developer Profile Analyzer is a production-ready Next.js 14 app that fetches public GitHub profile data, computes deterministic engineering scores, and generates structured career insights using Gemini 2.0 Flash.

## Features

- Next.js 14 App Router + TypeScript
- Tailwind CSS responsive dashboard
- Recharts visualizations (Skill Radar + Language Distribution)
- Deterministic score engine (frontend, backend, devops, testing, consistency, project depth)
- AI insights generated from normalized profile + computed scores only
- In-memory caching for GitHub fetches and API analysis responses
- Graceful handling of user-not-found, rate-limits, no-repo, AI failure, and network errors

## Tech Stack

- Framework: Next.js 14
- Styling: Tailwind CSS
- Charts: Recharts
- AI: Google Gemini 2.0 Flash API
- Data source: GitHub REST API
- Cache: In-memory Map

## Environment Variables

Copy `.env.example` to `.env.local` and set values:

- `GEMINI_API_KEY` (required)
- `GITHUB_TOKEN` (optional but recommended to avoid strict rate limits)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Start dev server:

```bash
npm run dev
```

4. Open app:

- http://localhost:3000

## Production Commands

```bash
npm run lint
npm run build
npm run start
```

## API Contract

### POST `/api/analyze`

Request body:

```json
{
  "username": "octocat"
}
```

Response includes:

- GitHub user profile summary
- NormalizedProfile object
- DeveloperScores object
- AI insights (or `null` if AI fails)
- warnings array

## Notes

- Forked repositories are excluded from all analysis.
- Only user-owned repositories are analyzed.
- AI receives only normalized and deterministic data.
