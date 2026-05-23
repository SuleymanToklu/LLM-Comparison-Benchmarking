import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'
import { NormalizedProfile, DeveloperScores, AIInsights, CareerFitEntry } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.0-flash'
const MAX_RETRIES  = 2
const RETRY_DELAY_MS = 1200

// ─── JSON response schema ─────────────────────────────────────────────────────

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    strengths: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    weaknesses: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    recommendations: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    careerFit: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          role:       { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ['role', 'confidence'],
      },
    },
  },
  required: ['summary', 'strengths', 'weaknesses', 'recommendations', 'careerFit'],
}

// ─── Fallback (no API key or all retries exhausted) ───────────────────────────

function buildFallback(profile: NormalizedProfile, scores: DeveloperScores): AIInsights {
  return {
    summary:
      `@${profile.username} has ${profile.ownedRepos} owned repositories and an overall score of ` +
      `${scores.overallScore}/100. AI narrative generation is unavailable — the computed scores ` +
      `below reflect the actual analysis.`,
    strengths: [
      profile.totalStars > 10
        ? `${profile.totalStars} total stars across owned repositories indicates community interest`
        : 'Active GitHub presence with publicly visible work',
      profile.hasTests ? 'Test files detected — automated quality signals present' : 'Repositories are publicly available for review',
    ].filter(Boolean),
    weaknesses: [
      !profile.hasTests      ? 'No test files detected across analysed repositories'         : null,
      !profile.hasCICD       ? 'No CI/CD pipeline found in any analysed repository'           : null,
      !profile.hasDockerfile ? 'No Dockerfile or Docker Compose configuration detected'       : null,
    ].filter((s): s is string => s !== null),
    recommendations: [
      !profile.hasTests      ? 'Add a jest.config.ts / pytest.ini and write tests for your most-used repo'   : null,
      !profile.hasCICD       ? 'Set up a GitHub Actions workflow (.github/workflows/ci.yml) for automation'   : null,
      !profile.hasDockerfile ? 'Create a Dockerfile in at least one project to demonstrate containerisation'  : null,
      !profile.hasReadme     ? 'Add README.md files with project description, usage, and contribution guide'  : null,
    ].filter((s): s is string => s !== null).slice(0, 4),
    careerFit: buildFallbackCareerFit(scores),
  }
}

function buildFallbackCareerFit(scores: DeveloperScores): CareerFitEntry[] {
  const fits: Array<[string, number]> = [
    ['Backend Engineer',        scores.backend],
    ['Frontend Engineer',       scores.frontend],
    ['Full Stack Developer',    Math.round((scores.backend + scores.frontend) / 2)],
    ['DevOps Engineer',         scores.devops],
    ['ML Engineer',             0], // can't determine without Gemini
  ]

  return fits
    .filter(([, score]) => score > 20)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([role, confidence]) => ({ role, confidence: Math.min(95, confidence) }))
}

// ─── Prompt construction ──────────────────────────────────────────────────────

/**
 * Build a compact, data-rich JSON payload to pass to Gemini.
 * We deliberately exclude raw repo lists to stay within token limits.
 */
function buildPayload(
  profile: NormalizedProfile,
  scores: DeveloperScores
): Record<string, unknown> {
  return {
    username:          profile.username,
    accountAgeDays:    profile.accountAgeDays,
    ownedRepositories: profile.ownedRepos,
    totalStars:        profile.totalStars,
    followers:         profile.followers,
    topLanguages: profile.topLanguages
      .slice(0, 5)
      .map(l => `${l.name} (${l.percentage}%, ${l.repoCount} repos)`),
    detectedFrameworks: {
      frontend: profile.detectedFrontendFrameworks,
      backend:  profile.detectedBackendFrameworks,
      devops:   profile.detectedDevOpsTools,
      ml:       profile.detectedMLFrameworks,
    },
    techExposure: {
      frontend: profile.frontendExposure,
      backend:  profile.backendExposure,
      devops:   profile.devopsExposure,
      ml:       profile.mlExposure,
    },
    engineeringPractices: {
      hasAutomatedTests:  profile.hasTests,
      testCoverage:
        profile.reposAnalyzed > 0
          ? `${profile.reposWithTests}/${profile.reposAnalyzed} analysed repos`
          : 'unknown',
      hasCICD:            profile.hasCICD,
      hasDockerfile:      profile.hasDockerfile,
      hasDeploymentConfig: profile.hasDeployment,
      hasReadme:          profile.hasReadme,
    },
    activityLast90Days: {
      avgCommitsPerWeek:     profile.avgCommitsPerWeek,
      activeRepos:           profile.activeReposLast90Days,
      consistencyScore:      profile.consistencyScore,
    },
    computedScores: {
      backend:      scores.backend,
      frontend:     scores.frontend,
      devops:       scores.devops,
      testing:      scores.testing,
      consistency:  scores.consistency,
      projectDepth: scores.projectDepth,
      overall:      scores.overallScore,
    },
  }
}

function buildPrompt(payload: Record<string, unknown>): string {
  return `You are a senior engineering career advisor with 15+ years of experience reviewing GitHub developer profiles.

TASK: Analyse the structured profile data below and produce a JSON response with honest, evidence-based insights.

STRICT RULES:
1. Every claim MUST reference specific numbers from the data
   (e.g. "With a testing score of 12/100 and tests found in 0 of 5 analysed repos...")
2. No generic advice — every recommendation must target a concrete gap in THIS profile
3. Weaknesses: be direct; avoid softeners like "you might want to" or "consider possibly"
4. Recommendations: actionable steps (name the file, tool, or repo to change)
5. Career fit confidence must derive from exposure levels and computed scores — not guesswork
6. Counts: strengths 3-4 · weaknesses 2-3 · recommendations 3-4 · careerFit 3-5 roles

Developer Profile Data:
${JSON.stringify(payload, null, 2)}`
}

// ─── Response validation ──────────────────────────────────────────────────────

function validateAndNormalise(raw: unknown): AIInsights {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('AI response is not an object')
  }

  const obj = raw as Record<string, unknown>

  if (typeof obj.summary !== 'string' || obj.summary.trim() === '') {
    throw new Error('Missing or empty "summary"')
  }
  if (!Array.isArray(obj.strengths) || obj.strengths.length === 0) {
    throw new Error('Missing or empty "strengths"')
  }
  if (!Array.isArray(obj.weaknesses) || obj.weaknesses.length === 0) {
    throw new Error('Missing or empty "weaknesses"')
  }
  if (!Array.isArray(obj.recommendations) || obj.recommendations.length === 0) {
    throw new Error('Missing or empty "recommendations"')
  }
  if (!Array.isArray(obj.careerFit) || obj.careerFit.length === 0) {
    throw new Error('Missing or empty "careerFit"')
  }

  const careerFit: CareerFitEntry[] = (obj.careerFit as Array<Record<string, unknown>>)
    .filter(cf => typeof cf.role === 'string' && typeof cf.confidence === 'number')
    .map(cf => ({
      role:       cf.role as string,
      confidence: Math.min(100, Math.max(0, Math.round(cf.confidence as number))),
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)

  if (careerFit.length === 0) {
    throw new Error('careerFit entries missing required fields')
  }

  return {
    summary:         obj.summary.trim(),
    strengths:       (obj.strengths as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 5),
    weaknesses:      (obj.weaknesses as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 5),
    recommendations: (obj.recommendations as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 5),
    careerFit,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate AI-powered developer insights via Gemini 2.0 Flash.
 *
 * Falls back to a deterministic summary computed from the scores if:
 * - `GEMINI_API_KEY` is not set
 * - All retries are exhausted
 * - The response fails validation
 */
export async function generateInsights(
  profile: NormalizedProfile,
  scores: DeveloperScores
): Promise<AIInsights> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[insightGenerator] GEMINI_API_KEY not configured — using fallback insights')
    return buildFallback(profile, scores)
  }

  const genAI  = new GoogleGenerativeAI(apiKey)
  const model  = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature:        0.4,  // low for consistent, factual output
      topP:               0.9,
      responseMimeType:   'application/json',
      responseSchema:     RESPONSE_SCHEMA,
    },
  })

  const payload = buildPayload(profile, scores)
  const prompt  = buildPrompt(payload)
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt))
    }

    try {
      const result   = await model.generateContent(prompt)
      const rawText  = result.response.text()

      // Gemini with responseMimeType:'application/json' should return clean JSON,
      // but strip any accidental markdown fences as a safety net.
      const jsonText = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim()

      const parsed = JSON.parse(jsonText) as unknown
      return validateAndNormalise(parsed)
    } catch (err) {
      lastError = err
      console.error(`[insightGenerator] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, err)
    }
  }

  console.error('[insightGenerator] All retries exhausted, using fallback:', lastError)
  return buildFallback(profile, scores)
}
