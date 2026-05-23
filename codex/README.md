# Developer Profile Analyzer

A production-ready Next.js 14 app that turns a public GitHub username into a structured engineering profile. It fetches public GitHub data, excludes forked repositories, computes deterministic scores, and sends only the normalized profile plus scores to Gemini 2.0 Flash for structured career insights.

## Stack

- Next.js 14 App Router with TypeScript
- Tailwind CSS
- Recharts
- Google Gemini 2.0 Flash API
- GitHub REST API
- In-memory API response cache

## Setup

```bash
npm install
cp .env.example .env.local
```

Set environment variables:

```bash
GEMINI_API_KEY=your_google_gemini_api_key
GITHUB_TOKEN=optional_github_token_for_higher_rate_limits
```

`GEMINI_API_KEY` is required for AI-generated insights. If Gemini is unavailable or the key is missing, the app still returns deterministic scores and shows fallback insights with a warning.

## Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## Analysis Flow

1. User enters a GitHub username.
2. API fetches `/users/:username`, `/users/:username/repos?per_page=100&sort=updated`, and `/users/:username/events/public?per_page=100`.
3. Forks and non-owned repositories are excluded from analysis.
4. Recent owned repositories are inspected for README, tests, Dockerfile, CI/CD, deployment config, and framework signals.
5. Data is normalized into `NormalizedProfile`.
6. Scores are computed deterministically before any AI call.
7. Gemini receives only `NormalizedProfile` and `DeveloperScores`.
8. The dashboard renders profile stats, charts, AI insights, career fit, maturity checks, activity, and repository evidence.

## Error Handling

- GitHub 404 returns a user-not-found message.
- GitHub 403 rate limits return rate-limit guidance.
- Users with no public or no owned non-fork repositories get a clear no-data state.
- Gemini failures do not break the dashboard. Deterministic partial results remain visible.
- Network failures return a retryable API error.

## Notes

The cache is an in-memory `Map` in the API route with a 10 minute TTL. It resets when the server process restarts.
