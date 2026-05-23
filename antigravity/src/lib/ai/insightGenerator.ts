import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AIInsights, DeveloperScores, NormalizedProfile } from "../../types";

export async function generateInsights(
  profile: NormalizedProfile,
  scores: DeveloperScores
): Promise<AIInsights> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are a senior engineering career advisor. Analyze the developer profile and generate structured insights.
Rules:
- Be specific. Reference actual numbers and technologies.
- No generic advice. Every recommendation must be tied to evidence.
- No flattery. Be honest about weaknesses.
- Keep each insight to 1-2 sentences max.`;

  const inputData = JSON.stringify({ profile, scores }, null, 2);

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
      recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
      careerFit: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            role: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
          },
          required: ["role", "confidence"],
        },
      },
    },
    required: ["summary", "strengths", "weaknesses", "recommendations", "careerFit"],
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Developer Profile:\n${inputData}`,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });

  if (!response.text) {
    throw new Error("Failed to generate AI insights");
  }

  let text = response.text;
  if (text.startsWith("```json")) {
    text = text.replace(/```json\n?/, "").replace(/```$/, "");
  }

  return JSON.parse(text) as AIInsights;
}
