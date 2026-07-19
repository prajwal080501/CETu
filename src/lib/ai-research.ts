import "server-only";
import { GoogleGenAI } from "@google/genai";
import { aiEnabled, AI_MODEL } from "./ai";
import type { PlacementRecord } from "./ai-extract";

/**
 * Gemini + Google Search grounding to DRAFT missing college data (placements,
 * NIRF, NAAC) from the public web. Strictly a research aid: the model must only
 * return figures it can source, cite them, and leave anything unverifiable null
 * — it never fabricates. Output is always reviewed + edited by an admin before
 * it's saved (see actions/admin-research.ts). Grounding + responseSchema can't
 * be combined, so we request JSON in the text and parse it defensively.
 */

const KEY = process.env.GEMINI_API_KEY;

function ai() {
  if (!aiEnabled) throw new Error("Gemini is not configured (GEMINI_API_KEY).");
  return new GoogleGenAI({ apiKey: KEY });
}

export type NirfRecord = {
  year: number;
  rank?: number | null;
  band?: string | null;
  score?: number | null;
};

export type NaacResearch = {
  grade?: string | null;
  cgpa?: number | null;
  validUpto?: string | null;
  source?: string | null;
};

export type ResearchResult = {
  placements: PlacementRecord[];
  nirf: NirfRecord[];
  naac: NaacResearch | null;
  sources: string[];
  notes: string;
};

/** Pull the first JSON object out of a (possibly fenced) model response. */
function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return {};
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return {};
  }
}

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
};

export async function researchCollege(input: {
  name: string;
  city: string | null;
  university: string | null;
}): Promise<ResearchResult> {
  const prompt = `You are a data researcher for CETu, a Maharashtra MHT-CET engineering college tool.

Research this EXACT college using web search and return ONLY verifiable, sourced data:
- Name: ${input.name}
- City: ${input.city ?? "(unknown)"}
- Home university: ${input.university ?? "(unknown)"}

Find, if publicly available from reliable sources (the college's official site, NIRF, NAAC, credible aggregators):
1. Recent PLACEMENT statistics per year (average / median / highest package in LPA, placement rate %, top recruiters).
2. NIRF Engineering ranking(s) — year, rank or band, score.
3. NAAC accreditation — grade, CGPA, valid-upto year, and the source URL.

STRICT RULES:
- Return ONLY figures you can actually find for THIS specific college. Do NOT guess, average, or fabricate. Match the institute precisely (right city/university) — do not confuse it with a similarly named college.
- Use null for anything you cannot verify. Prefer the most recent 1-3 years.
- Packages in LPA (₹ lakh/year) as numbers. Rate as a percent number.

Respond with ONLY a JSON object (no prose) of this exact shape:
{
  "placements": [{"year": 2024, "avgLpa": null, "medianLpa": null, "highestLpa": null, "ratePct": null, "recruiters": null}],
  "nirf": [{"year": 2024, "rank": null, "band": null, "score": null}],
  "naac": {"grade": null, "cgpa": null, "validUpto": null, "source": null},
  "notes": "one line on confidence and what could not be found"
}`;

  const res = await ai().models.generateContent({
    model: AI_MODEL,
    contents: [{ text: prompt }],
    config: {
      // Google Search grounding — lets the model actually look data up.
      tools: [{ googleSearch: {} }],
      temperature: 0.1,
    },
  });

  const json = extractJson(res.text ?? "");

  const placements: PlacementRecord[] = Array.isArray(json.placements)
    ? (json.placements as Record<string, unknown>[])
        .map((p) => ({
          year: num(p.year) ?? 0,
          avgLpa: num(p.avgLpa),
          medianLpa: num(p.medianLpa),
          highestLpa: num(p.highestLpa),
          ratePct: num(p.ratePct),
          recruiters: str(p.recruiters),
        }))
        .filter((p) => p.year > 0)
    : [];

  const nirf: NirfRecord[] = Array.isArray(json.nirf)
    ? (json.nirf as Record<string, unknown>[])
        .map((n) => ({
          year: num(n.year) ?? 0,
          rank: num(n.rank),
          band: str(n.band),
          score: num(n.score),
        }))
        .filter((n) => n.year > 0 && (n.rank != null || n.band != null))
    : [];

  const naacRaw = (json.naac ?? null) as Record<string, unknown> | null;
  const naac: NaacResearch | null =
    naacRaw && str(naacRaw.grade)
      ? {
          grade: str(naacRaw.grade),
          cgpa: num(naacRaw.cgpa),
          validUpto: str(naacRaw.validUpto),
          source: str(naacRaw.source),
        }
      : null;

  // Grounding source URLs, for the admin to verify.
  const cand = (res as { candidates?: Array<{ groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string } }> } }> })
    .candidates?.[0];
  const sources = Array.from(
    new Set(
      (cand?.groundingMetadata?.groundingChunks ?? [])
        .map((c) => c.web?.uri)
        .filter((u): u is string => !!u)
    )
  );

  return { placements, nirf, naac, sources, notes: str(json.notes) ?? "" };
}
