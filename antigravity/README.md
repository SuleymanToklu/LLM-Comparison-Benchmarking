# Developer Profile Analyzer

A Next.js application that fetches public GitHub data, runs a structured analysis, and generates a meaningful developer profile with strengths, weaknesses, and actionable recommendations powered by the Gemini 2.0 Flash API.

## Tech Stack
- Framework: Next.js 14 (App Router, TypeScript)
- Styling: Tailwind CSS
- Charts: Recharts
- AI: Google Gemini 2.0 Flash API
- GitHub: GitHub REST API

## Getting Started

1. Clone the repository
2. Run `npm install`
3. Copy `.env.example` to `.env.local` and add your API keys:
   - `GEMINI_API_KEY`: Required. Your Google Gemini API key.
   - `GITHUB_TOKEN`: Optional but recommended to avoid rate limits.
4. Run `npm run dev` to start the development server
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Features
- In-depth Developer Skill Radar Chart
- Automated Code Quality and Maturity Checks
- Insights and Career Fit Recommendations using AI
- Clean, responsive dashboard
