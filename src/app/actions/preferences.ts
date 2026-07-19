"use server";

import { auth } from "@clerk/nextjs/server";
import { collections } from "@/db/collections";
import type { FlatResult } from "@/components/PredictorResults";

/**
 * Load the signed-in user's saved preference list. Returns [] for anonymous
 * users (the client then uses its localStorage copy).
 */
export async function loadPreferenceList(): Promise<FlatResult[]> {
  const { userId } = await auth();
  if (!userId) return [];
  const row = await collections.preferenceLists().findOne({ _id: userId });
  return (row?.items as FlatResult[]) ?? [];
}

/**
 * Persist the full ordered preference list for the signed-in user (whole-list
 * upsert — the list is small and always sent complete). No-op if signed out.
 */
export async function savePreferenceList(items: FlatResult[]): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;
  await collections
    .preferenceLists()
    .updateOne(
      { _id: userId },
      { $set: { items, updatedAt: new Date() } },
      { upsert: true }
    );
}
