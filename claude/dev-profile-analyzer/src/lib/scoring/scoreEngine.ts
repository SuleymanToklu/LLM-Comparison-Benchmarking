import { NormalizedProfile, DeveloperScores } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(value)))
}

/**
 * Look up a language by name (case-insensitive) in the profile's top-language
 * list and return its usage percentage, or 0 if absent.
 */
function langPct(profile: NormalizedProfile, ...names: string[]): number {
  const set = new Set(names.map(n => n.toLowerCase()))
  return profile.topLanguages
    .filter(l => set.has(l.name.toLowerCase()))
    .reduce((acc, l) => acc + l.percentage, 0)
}

// ─── Per-dimension scorers ────────────────────────────────────────────────────

/**
 * Frontend score (0-100).
 *
 * Evidence sources (in order of weight):
 * 1. Exposure level from language/topic analysis  → 0–60
 * 2. JavaScript/TypeScript dominance              → 0–20
 * 3. Presence of HTML/CSS/SCSS                    → 0–10
 * 4. Detected frontend framework diversity        → 0–10
 * 5. Deployment signal (frontend devs ship)       → 0–5  [bonus, after clamp]
 */
function computeFrontend(p: NormalizedProfile): number {
  const EXPOSURE_BASE: Record<string, number> = {
    none: 0, low: 15, medium: 40, high: 60,
  }

  let score = EXPOSURE_BASE[p.frontendExposure]

  // JS/TS: each percentage point of usage contributes up to 20 pts total
  const jsTs = langPct(p, 'javascript', 'typescript')
  score += Math.min(20, jsTs * 0.2)

  // HTML/CSS/SCSS as secondary signals
  const markup = langPct(p, 'html', 'css', 'scss', 'less')
  score += Math.min(10, markup * 0.15)

  // Framework breadth (each unique framework detected = +3, cap 10)
  score += Math.min(10, p.detectedFrontendFrameworks.length * 3)

  // Deployment bonus: frontend projects are typically deployed
  if (p.hasDeployment) score += 5

  return clamp(score)
}

/**
 * Backend score (0-100).
 *
 * Evidence sources:
 * 1. Exposure level                               → 0–60
 * 2. Dedicated backend languages                  → 0–20
 * 3. Detected backend framework diversity         → 0–10
 * 4. Automated tests + CI (production quality)    → 0–10
 */
function computeBackend(p: NormalizedProfile): number {
  const EXPOSURE_BASE: Record<string, number> = {
    none: 0, low: 15, medium: 40, high: 60,
  }

  let score = EXPOSURE_BASE[p.backendExposure]

  const backendLangs = langPct(
    p,
    'python', 'java', 'go', 'rust', 'ruby', 'php',
    'kotlin', 'scala', 'c#', 'elixir', 'crystal', 'c', 'c++'
  )
  score += Math.min(20, backendLangs * 0.2)

  score += Math.min(10, p.detectedBackendFrameworks.length * 2)

  // Production-quality signals
  if (p.hasTests)  score += 5
  if (p.hasCICD)   score += 5

  return clamp(score)
}

/**
 * DevOps score (0-100).
 *
 * Evidence sources:
 * 1. Docker usage                                 → 35
 * 2. CI/CD pipeline                               → 30
 * 3. Deployment configuration                     → 20
 * 4. DevOps exposure / tooling topics             → 0–10
 * 5. Infrastructure languages (HCL, Shell)        → 0–5
 */
function computeDevOps(p: NormalizedProfile): number {
  let score = 0

  if (p.hasDockerfile) score += 35
  if (p.hasCICD)       score += 30
  if (p.hasDeployment) score += 20

  const EXPOSURE_BONUS: Record<string, number> = {
    none: 0, low: 3, medium: 7, high: 12,
  }
  score += EXPOSURE_BONUS[p.devopsExposure]

  // HCL / Shell signals infrastructure awareness
  const infraLang = langPct(p, 'hcl', 'shell', 'powershell')
  if (infraLang > 0) score += 5

  return clamp(score)
}

/**
 * Testing score (0-100).
 *
 * Evidence sources:
 * 1. Tests found in any repo                      → 40
 * 2. Test breadth (>30 % of analysed repos)       → 30
 * 3. CI/CD (automated test execution)             → 30
 */
function computeTesting(p: NormalizedProfile): number {
  let score = 0

  if (p.hasTests) score += 40

  const coverage = p.reposAnalyzed > 0
    ? p.reposWithTests / p.reposAnalyzed
    : 0

  if (coverage > 0.5)       score += 30
  else if (coverage > 0.3)  score += 20
  else if (coverage > 0.1)  score += 10

  if (p.hasCICD) score += 30

  return clamp(score)
}

/**
 * Project depth score (0-100).
 *
 * Reflects portfolio maturity rather than recency of activity.
 *
 * Evidence sources:
 * 1. Community interest (stars) — log scale       → 0–30
 * 2. Portfolio breadth (repo count) — log scale   → 0–20
 * 3. Code volume (avg repo size KB) — log scale   → 0–15
 * 4. Account tenure                               → 0–15
 * 5. Language breadth (polyglot signal)           → 0–10
 * 6. README quality across repos                  → 0–10
 */
function computeProjectDepth(p: NormalizedProfile): number {
  let score = 0

  // Stars: log₁₀ scale — 10 stars ≈ 15 pts, 100 stars ≈ 22 pts, 1 000 stars ≈ 30 pts
  score += Math.min(30, (Math.log10(p.totalStars + 1) / Math.log10(1000)) * 30)

  // Repo count: 50 owned repos → max 20 pts
  score += Math.min(20, (Math.log1p(p.ownedRepos) / Math.log1p(50)) * 20)

  // Avg repo size: 5 000 KB → max 15 pts
  score += Math.min(15, (Math.log1p(p.avgRepoSize) / Math.log1p(5000)) * 15)

  // Tenure: 1 yr = ~12 pts, 3 yrs = max 15 pts
  const years = p.accountAgeDays / 365
  score += Math.min(15, years * 5)

  // Polyglot: 4+ languages = 10 pts, 2-3 = 5 pts
  if (p.topLanguages.length >= 4)      score += 10
  else if (p.topLanguages.length >= 2) score += 5

  // README culture
  if (p.hasReadme) {
    const readmeRatio = p.reposAnalyzed > 0 ? p.reposWithReadme / p.reposAnalyzed : 0
    score += Math.min(10, readmeRatio * 10)
  }

  return clamp(score)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute all developer skill scores deterministically from a NormalizedProfile.
 *
 * All scores are integers in [0, 100].  The overallScore is a weighted average:
 *   backend × 20 % + frontend × 20 % + testing × 20 % +
 *   devops  × 15 % + projectDepth × 15 % + consistency × 10 %
 */
export function computeScores(profile: NormalizedProfile): DeveloperScores {
  const backend      = computeBackend(profile)
  const frontend     = computeFrontend(profile)
  const devops       = computeDevOps(profile)
  const testing      = computeTesting(profile)
  const consistency  = clamp(profile.consistencyScore)
  const projectDepth = computeProjectDepth(profile)

  const overallScore = clamp(
    backend      * 0.20 +
    frontend     * 0.20 +
    testing      * 0.20 +
    devops       * 0.15 +
    projectDepth * 0.15 +
    consistency  * 0.10
  )

  return { backend, frontend, devops, testing, consistency, projectDepth, overallScore }
}
