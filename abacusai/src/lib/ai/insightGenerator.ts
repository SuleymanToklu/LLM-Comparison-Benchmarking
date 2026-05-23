import type { AIInsights, DeveloperScores, NormalizedProfile } from "@/types"

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

const SYSTEM_PROMPT = `You are a senior engineering career advisor. Analyze the developer profile and generate structured insights.
Rules:
- Be specific. Reference actual numbers and technologies.
- No generic advice. Every recommendation must be tied to evidence.
- No flattery. Be honest about weaknesses.
- Keep each insight to 1-2 sentences max.
Return valid JSON only, no markdown.`

function sanitizeInsights(raw: unknown): AIInsights {
  const fallback: AIInsights = {
    summary: "AI output was invalid; deterministic analysis remains accurate.",
    strengths: [],
    weaknesses: [],
    recommendations: [],
    careerFit: []
  }

  if (!raw || typeof raw !== "object") {
    return fallback
  }

  const payload = raw as Partial<AIInsights>

  const strengths = Array.isArray(payload.strengths)
    ? payload.strengths.filter((item): item is string => typeof item === "string")
    : []

  const weaknesses = Array.isArray(payload.weaknesses)
    ? payload.weaknesses.filter((item): item is string => typeof item === "string")
    : []

  const recommendations = Array.isArray(payload.recommendations)
    ? payload.recommendations.filter((item): item is string => typeof item === "string")
    : []

  const careerFit = Array.isArray(payload.careerFit)
    ? payload.careerFit
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null
          }

          const role = (item as { role?: unknown }).role
          const confidence = (item as { confidence?: unknown }).confidence
          if (typeof role !== "string" || typeof confidence !== "number") {
            return null
          }

          return {
            role,
            confidence: Math.max(0, Math.min(100, Math.round(confidence)))
          }
        })
        .filter((item): item is { role: string; confidence: number } => item !== null)
    : []

  return {
    summary: typeof payload.summary === "string" ? payload.summary : fallback.summary,
    strengths,
    weaknesses,
    recommendations,
    careerFit
  }
}

export async function generateInsights(
  normalized: NormalizedProfile,
  scores: DeveloperScores
): Promise<AIInsights> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing")
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: JSON.stringify({ normalized, scores }) }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`)
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!rawText) {
    throw new Error("Gemini response did not include content")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error("Gemini returned invalid JSON")
  }

  return sanitizeInsights(parsed)
}
