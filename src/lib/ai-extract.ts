import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { aiEnabled, AI_MODEL } from "./ai";

/**
 * Gemini-powered extraction of structured records from an uploaded PDF, shaped
 * to fit our DB. The model reads the PDF directly (inline data) and returns
 * strict JSON via responseSchema. Grounding rule: extract ONLY what the document
 * states — never invent names, companies, packages or years. Admin previews the
 * result before it's committed.
 */

const KEY = process.env.GEMINI_API_KEY;

function ai() {
  if (!aiEnabled) throw new Error("Gemini is not configured (GEMINI_API_KEY).");
  return new GoogleGenAI({ apiKey: KEY });
}

function pdfPart(buffer: Buffer) {
  return { inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } };
}

export type AlumniRecord = {
  name: string;
  company?: string | null;
  role?: string | null;
  batchYear?: number | null;
  achievement?: string | null;
  linkedin?: string | null;
};

export type PlacementRecord = {
  year: number;
  avgLpa?: number | null;
  medianLpa?: number | null;
  highestLpa?: number | null;
  ratePct?: number | null;
  recruiters?: string | null;
};

const ALUMNI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    alumni: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          company: { type: Type.STRING, description: "Current/notable employer, if stated" },
          role: { type: Type.STRING, description: "Job title / designation, if stated" },
          batchYear: { type: Type.INTEGER, description: "Graduation year, if stated" },
          achievement: { type: Type.STRING, description: "Notable achievement, one line" },
          linkedin: { type: Type.STRING, description: "LinkedIn URL only if present" },
        },
        required: ["name"],
      },
    },
  },
  required: ["alumni"],
};

const PLACEMENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    placements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          year: { type: Type.INTEGER, description: "Placement/passing year" },
          avgLpa: { type: Type.NUMBER, description: "Average package in LPA" },
          medianLpa: { type: Type.NUMBER, description: "Median package in LPA" },
          highestLpa: { type: Type.NUMBER, description: "Highest package in LPA" },
          ratePct: { type: Type.NUMBER, description: "Placement percentage" },
          recruiters: { type: Type.STRING, description: "Comma-separated top recruiters" },
        },
        required: ["year"],
      },
    },
  },
  required: ["placements"],
};

const SYSTEM =
  "You extract structured records from an official college document (PDF). " +
  "Use ONLY facts explicitly present in the document. Never invent, guess or " +
  "extrapolate names, companies, packages, percentages or years. If a field " +
  "isn't stated, omit it. Convert salary figures to LPA (lakhs per annum) as a " +
  "number (e.g. '12.5 LPA' -> 12.5, '1.2 Cr' -> 120).";

export async function extractAlumniFromPdf(buffer: Buffer): Promise<AlumniRecord[]> {
  const res = await ai().models.generateContent({
    model: AI_MODEL,
    contents: [
      pdfPart(buffer),
      { text: "Extract every distinguished/notable alumnus listed in this document." },
    ],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: ALUMNI_SCHEMA,
      temperature: 0.1,
    },
  });
  const json = JSON.parse(res.text ?? "{}") as { alumni?: AlumniRecord[] };
  return (json.alumni ?? []).filter((a) => a.name?.trim());
}

export async function extractPlacementsFromPdf(buffer: Buffer): Promise<PlacementRecord[]> {
  const res = await ai().models.generateContent({
    model: AI_MODEL,
    contents: [
      pdfPart(buffer),
      { text: "Extract the placement statistics per year from this document." },
    ],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseSchema: PLACEMENT_SCHEMA,
      temperature: 0.1,
    },
  });
  const json = JSON.parse(res.text ?? "{}") as { placements?: PlacementRecord[] };
  return (json.placements ?? []).filter((p) => p.year);
}
