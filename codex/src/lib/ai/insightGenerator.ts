import type { AIInsights, DeveloperScores, NormalizedProfile } from "@/types";

const GEMINI_MODEL = "gemini-2.0-flash";
const REQUEST_TIMEOUT_MS = 20_000;
const GEMINI_SYSTEM_PROMPT = `You are a senior engineering career advisor. Analyze the developer profile and generate structured insights.
Rules:
- Be specific. Reference actual numbers and technologies.
- No generic advice. Every recommendation must be tied to evidence.
- No flattery. Be honest about weaknesses.
- Keep each insight to 1-2 sentences max.
Return valid JSON only, no markdown.`;

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
}

export async function generateAIInsights(profile: NormalizedProfile, scores: DeveloperScores): Promise<AIInsights> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: GEMINI_SYSTEM_PROMPT }]
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: JSON.stringify({
                    normalizedProfile: profile,
                    scores
                  })
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.9,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                recommendations: { type: "array", items: { type: "string" } },
                careerFit: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      role: { type: "string" },
                      confidence: { type: "number" }
                    },
                    required: ["role", "confidence"]
                  }
                }
              },
              required: ["summary", "strengths", "weaknesses", "recommendations", "careerFit"]
            }
          }
        }),
        cache: "no-store"
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Gemini API failed with status ${response.status}: ${detail.slice(0, 240)}`);
    }

    const payload = (await response.json()) as GeminiGenerateResponse;
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return parseInsights(text);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Gemini API request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildFallbackInsights(profile: NormalizedProfile, scores: DeveloperScores): AIInsights {
  const languageSummary = profile.topLanguages
    .slice(0, 3)
    .map((language) => `${language.name} ${language.percentage}%`)
    .join(", ");
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  if (scores.backend >= 70) {
    strengths.push(`Backend score is ${scores.backend}/100 with ${profile.backendExposure} backend exposure.`);
  }
  if (scores.frontend >= 70) {
    strengths.push(`Frontend score is ${scores.frontend}/100 and the top language mix is ${languageSummary || "not available"}.`);
  }
  if (profile.hasReadme) {
    strengths.push(`README signal appears in ${profile.ownedRepos > 0 ? "at least one" : "zero"} owned repository, helping portfolio readability.`);
  }
  if (scores.consistency >= 55) {
    strengths.push(`Recent public cadence is visible at ${profile.avgCommitsPerWeek} commits per week.`);
  }

  if (scores.testing < 70) {
    weaknesses.push(`Testing score is ${scores.testing}/100; test files or CI coverage are not strong enough across the owned repositories.`);
  }
  if (scores.devops < 70) {
    weaknesses.push(`DevOps score is ${scores.devops}/100 because Docker, CI/CD, or deployment signals are incomplete.`);
  }
  if (scores.consistency < 45) {
    weaknesses.push(`Consistency is ${scores.consistency}/100 with ${profile.avgCommitsPerWeek} average commits per week in public events.`);
  }
  if (profile.repoQualityScore < 55) {
    weaknesses.push(`Repository quality is ${profile.repoQualityScore}/100, indicating missing documentation, automation, tests, or deployment evidence.`);
  }

  if (!profile.hasTests) {
    recommendations.push(`Add tests to one active repository first; no test files were detected in the inspected owned repositories.`);
  } else if (scores.testing < 80) {
    recommendations.push(`Expand tests across more owned repositories to improve the deterministic testing score.`);
  }
  if (!profile.hasCICD) {
    recommendations.push(`Add a GitHub Actions workflow because CI/CD is currently absent from the engineering maturity signals.`);
  }
  if (!profile.hasDockerfile) {
    recommendations.push(`Add a Dockerfile to a backend or full-stack repository to make the DevOps score more verifiable.`);
  }
  if (profile.avgCommitsPerWeek < 2) {
    recommendations.push(`Make smaller public commits weekly; recent public activity is ${profile.avgCommitsPerWeek} commits per week.`);
  }

  return {
    summary: `@${profile.username} has ${profile.ownedRepos} owned non-fork repositories, ${profile.activeReposLast90Days} active repos in public events over 90 days, ${languageSummary || "no dominant language metadata"}, and an overall score of ${scores.overallScore}/100.`,
    strengths: ensureList(strengths, [`The profile has ${profile.ownedRepos} owned non-fork repositories available for analysis.`]),
    weaknesses: ensureList(weaknesses, ["Gemini insights were unavailable, so deterministic fallback analysis is shown."]),
    recommendations: ensureList(recommendations, ["Configure GEMINI_API_KEY to enable Gemini-generated career recommendations."]),
    careerFit: buildCareerFit(scores, profile)
  };
}

function parseInsights(text: string): AIInsights {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as unknown;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Gemini response was not a JSON object.");
  }

  const value = parsed as Partial<AIInsights>;
  const insights: AIInsights = {
    summary: typeof value.summary === "string" ? value.summary.trim() : "",
    strengths: toStringArray(value.strengths),
    weaknesses: toStringArray(value.weaknesses),
    recommendations: toStringArray(value.recommendations),
    careerFit: toCareerFitArray(value.careerFit)
  };

  if (!insights.summary || insights.strengths.length === 0 || insights.weaknesses.length === 0 || insights.recommendations.length === 0) {
    throw new Error("Gemini response did not include the required insight fields.");
  }

  return insights;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 6)
    : [];
}

function toCareerFitArray(value: unknown): AIInsights["careerFit"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is { role: string; confidence: number } => {
      return Boolean(item) && typeof item.role === "string" && typeof item.confidence === "number";
    })
    .map((item) => ({
      role: item.role.trim(),
      confidence: clampScore(Math.round(item.confidence))
    }))
    .filter((item) => item.role.length > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

function ensureList(primary: string[], fallback: string[]): string[] {
  return primary.length > 0 ? primary.slice(0, 5) : fallback.slice(0, 5);
}

function buildCareerFit(scores: DeveloperScores, profile: NormalizedProfile): AIInsights["careerFit"] {
  const mlScore = exposureToScore(profile.mlExposure);
  const fullStackScore = Math.round((scores.backend + scores.frontend + scores.projectDepth) / 3);

  return [
    { role: "Full-Stack Engineer", confidence: fullStackScore },
    { role: "Backend Engineer", confidence: scores.backend },
    { role: "Frontend Engineer", confidence: scores.frontend },
    { role: "DevOps-leaning Engineer", confidence: scores.devops },
    { role: "ML / Data Engineer", confidence: Math.round((mlScore + scores.projectDepth) / 2) }
  ]
    .map((fit) => ({ ...fit, confidence: clampScore(fit.confidence) }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
}

function exposureToScore(exposure: NormalizedProfile["mlExposure"]): number {
  if (exposure === "high") {
    return 90;
  }
  if (exposure === "medium") {
    return 65;
  }
  if (exposure === "low") {
    return 35;
  }

  return 0;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}
