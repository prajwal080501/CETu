import "server-only";
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Gemini integration for grounded, data-driven college insights.
 *
 * GRACEFUL DEGRADATION (same pattern as Clerk): the whole feature is gated on a
 * real GEMINI_API_KEY. Without one the app runs exactly as before — the AI card
 * simply doesn't render. Drop a key in `.env.local` and restart to activate.
 *
 * GROUNDING: the model is only ever given structured facts we already hold in
 * the DB (cutoffs, seats, NIRF, placements) and is instructed to reason strictly
 * from them — it must not invent packages, rankings, or claims. This keeps the
 * output faithful to our verified data rather than the model's training memory.
 */

const KEY = process.env.GEMINI_API_KEY;

export const aiEnabled = Boolean(KEY && KEY !== "REPLACE_ME" && KEY.length > 8);

// `-latest` alias tracks the current stable flash model, avoiding pinned-model
// "no longer available to new users" breakage. Verified against the live key.
export const AI_MODEL = "gemini-flash-latest";

export type CollegeInsights = {
  summary: string;
  strengths: string[];
  considerations: string[];
  bestFor: string;
};

/** The grounding facts we feed the model. Everything here comes from the DB. */
export type InsightFacts = {
  name: string;
  city: string | null;
  type: string | null;
  university: string | null;
  autonomous: boolean;
  naacGrade: string | null;
  nirf: { year: number; rank: number | null; band: string | null } | null;
  totalSeats: number;
  branchCount: number;
  topBranches: { name: string; seats: number | null; openCutoff: number | null }[];
  placements: {
    year: number;
    highestLpa: number | null;
    medianLpa: number | null;
    avgLpa: number | null;
    ratePct: number | null;
    recruiters: string | null;
  } | null;
};

const SYSTEM_INSTRUCTION = `You are an admissions-data analyst for CETu, a Maharashtra MHT-CET engineering college research tool.

You will be given ONLY verified structured facts about ONE college. Write a concise, neutral, student-facing analysis grounded STRICTLY in those facts.

Hard rules:
- Use ONLY the numbers and fields provided. NEVER invent placement packages, rankings, fees, recruiters, or accreditations that are not in the input.
- If a fact is missing (null/empty), do not speculate about it — either omit it or say the data isn't available.
- MHT-CET cutoffs are PERCENTILES (0-100, higher = more competitive). A GOPEN closing percentile near 99 means highly selective; near 80 means more accessible.
- Be specific and quantitative: cite the actual seats, percentile, NIRF rank, or package where relevant.
- Neutral tone. No marketing language, no hype, no emojis. This is a research aid, not an ad.
- Keep each list item to one crisp sentence.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "2-3 sentence overview of the college grounded in the facts.",
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-4 data-backed strengths, each one sentence.",
    },
    considerations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-3 things an aspirant should weigh, each one sentence.",
    },
    bestFor: {
      type: Type.STRING,
      description:
        "One sentence: what kind of aspirant (percentile band, priorities) should target this college.",
    },
  },
  required: ["summary", "strengths", "considerations", "bestFor"],
  propertyOrdering: ["summary", "strengths", "considerations", "bestFor"],
};

/** Call Gemini with grounded facts and return structured insights. */
export async function generateInsights(
  facts: InsightFacts
): Promise<CollegeInsights> {
  if (!aiEnabled) throw new Error("AI is not enabled (no GEMINI_API_KEY).");

  const ai = new GoogleGenAI({ apiKey: KEY });
  const res = await ai.models.generateContent({
    model: AI_MODEL,
    contents: `Here are the verified facts for this college as JSON. Analyse strictly from them:\n\n${JSON.stringify(
      facts,
      null,
      2
    )}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.4,
    },
  });

  const text = res.text;
  if (!text) throw new Error("Empty response from Gemini.");
  const parsed = JSON.parse(text) as CollegeInsights;
  return {
    summary: String(parsed.summary ?? "").trim(),
    strengths: (parsed.strengths ?? []).map((s) => String(s).trim()).filter(Boolean),
    considerations: (parsed.considerations ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean),
    bestFor: String(parsed.bestFor ?? "").trim(),
  };
}
