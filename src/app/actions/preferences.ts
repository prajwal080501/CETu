"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { preferenceLists } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { FlatResult } from "@/components/PredictorResults";

/**
 * Load the signed-in user's saved preference list. Returns [] for anonymous
 * users (the client then uses its localStorage copy).
 */
export async function loadPreferenceList(): Promise<FlatResult[]> {
  const { userId } = await auth();
  if (!userId) return [];
  const [row] = await db
    .select({ items: preferenceLists.items })
    .from(preferenceLists)
    .where(eq(preferenceLists.userId, userId));
  return (row?.items as FlatResult[]) ?? [];
}

/**
 * Persist the full ordered preference list for the signed-in user (whole-list
 * upsert — the list is small and always sent complete). No-op if signed out.
 */
export async function savePreferenceList(items: FlatResult[]): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;
  await db
    .insert(preferenceLists)
    .values({ userId, items, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: preferenceLists.userId,
      set: { items, updatedAt: new Date() },
    });
}
