"use server";

import { db } from "@/db";
import { aiInsights } from "@/db/schema";
import { eq } from "drizzle-orm";
import { aiEnabled, AI_MODEL, generateInsights, type CollegeInsights } from "@/lib/ai";
import {
  buildInsightFacts,
  factsHash,
  getCachedInsights,
} from "@/lib/insights";

export type InsightsResult =
  | { ok: true; insights: CollegeInsights; cached: boolean; model: string }
  | { ok: false; error: string };

/**
 * Return grounded AI insights for a college. Serves the cache when the
 * underlying facts are unchanged; otherwise calls Gemini and stores the result.
 * `force` bypasses the cache to regenerate.
 */
export async function generateCollegeInsights(
  collegeId: number,
  slug: string,
  force = false
): Promise<InsightsResult> {
  if (!aiEnabled) {
    return { ok: false, error: "AI insights are not configured." };
  }

  const facts = await buildInsightFacts(collegeId, slug);
  if (!facts) return { ok: false, error: "College not found." };

  const hash = factsHash(facts);

  if (!force) {
    const cached = await getCachedInsights(collegeId);
    if (cached && cached.dataHash === hash) {
      return { ok: true, insights: cached.content, cached: true, model: cached.model };
    }
  }

  let insights: CollegeInsights;
  try {
    insights = await generateInsights(facts);
  } catch (e) {
    console.error("Gemini insight generation failed:", e);
    return { ok: false, error: "Could not generate insights right now." };
  }

  await db
    .insert(aiInsights)
    .values({ collegeId, model: AI_MODEL, dataHash: hash, content: insights })
    .onConflictDoUpdate({
      target: aiInsights.collegeId,
      set: { model: AI_MODEL, dataHash: hash, content: insights, createdAt: new Date() },
    });

  return { ok: true, insights, cached: false, model: AI_MODEL };
}
