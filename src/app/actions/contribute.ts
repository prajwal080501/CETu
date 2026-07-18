"use server";

import { auth } from "@clerk/nextjs/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/db";
import { placements, alumni, colleges, naacSubmissions } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Crowdsourced contributions. Submissions from signed-in users land UNVERIFIED
 * (verifiedAt = null) and only render publicly after a moderator approves them
 * in /admin. This is the sanctioned source for data with no clean bulk feed —
 * placements, NAAC grade, campus, alumni — so we never fabricate those.
 */

export interface PlacementInput {
  collegeId: number;
  year: number;
  medianPackageLpa?: number;
  highestPackageLpa?: number;
  placementRatePct?: number;
  topRecruiters?: string;
  source?: string;
}

export async function submitPlacement(input: PlacementInput) {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Sign in to contribute." };
  if (!input.collegeId || !input.year)
    return { ok: false, error: "Missing college or year." };
  await db.insert(placements).values({
    collegeId: input.collegeId,
    year: input.year,
    medianPackageLpa: input.medianPackageLpa?.toString() ?? null,
    highestPackageLpa: input.highestPackageLpa?.toString() ?? null,
    placementRatePct: input.placementRatePct?.toString() ?? null,
    topRecruiters: input.topRecruiters ?? null,
    source: input.source ?? null,
    contributedBy: userId,
    verifiedAt: null,
  });
  return { ok: true };
}

export async function submitAlumnus(input: {
  collegeId: number;
  name: string;
  achievement?: string;
}) {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Sign in to contribute." };
  if (!input.collegeId || !input.name?.trim())
    return { ok: false, error: "Missing college or name." };
  await db.insert(alumni).values({
    collegeId: input.collegeId,
    name: input.name.trim(),
    achievement: input.achievement?.trim() ?? null,
    contributedBy: userId,
    verifiedAt: null,
    isVerified: false,
  });
  return { ok: true };
}

const VALID_GRADES = ["A++", "A+", "A", "B++", "B+", "B", "C"];

/** Contribute a NAAC grade (no clean bulk source). Verified before it shows. */
export async function submitNaac(input: {
  collegeId: number;
  grade: string;
  cgpa?: number;
  validUpto?: string;
  source?: string;
}) {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Sign in to contribute." };
  if (!input.collegeId || !VALID_GRADES.includes(input.grade))
    return { ok: false, error: "Pick a valid NAAC grade." };
  if (!input.source?.trim())
    return { ok: false, error: "An official source link is required." };
  if (input.cgpa != null && (input.cgpa < 0 || input.cgpa > 4))
    return { ok: false, error: "CGPA must be between 0 and 4." };
  await db.insert(naacSubmissions).values({
    collegeId: input.collegeId,
    grade: input.grade,
    cgpa: input.cgpa?.toString() ?? null,
    validUpto: input.validUpto?.trim() || null,
    source: input.source.trim(),
    contributedBy: userId,
  });
  return { ok: true };
}

export async function approveNaac(id: number) {
  await requireAdmin();
  const [sub] = await db
    .select()
    .from(naacSubmissions)
    .where(eq(naacSubmissions.id, id))
    .limit(1);
  if (!sub) return { ok: false, error: "Not found." };
  await db
    .update(colleges)
    .set({
      naacGrade: sub.grade,
      naacCgpa: sub.cgpa,
      naacValidUpto: sub.validUpto,
      naacSource: sub.source,
    })
    .where(eq(colleges.id, sub.collegeId));
  await db.delete(naacSubmissions).where(eq(naacSubmissions.id, id));
  revalidatePath("/admin");
  return { ok: true };
}

export async function rejectNaac(id: number) {
  await requireAdmin();
  await db.delete(naacSubmissions).where(eq(naacSubmissions.id, id));
  revalidatePath("/admin");
  return { ok: true };
}

// ---- moderation (admin) ----------------------------------------------------

const requireAdmin = requireAdminSession;

export async function approvePlacement(id: number) {
  await requireAdmin();
  await db
    .update(placements)
    .set({ verifiedAt: new Date() })
    .where(and(eq(placements.id, id), isNull(placements.verifiedAt)));
  revalidatePath("/admin");
  return { ok: true };
}

export async function approveAlumnus(id: number) {
  await requireAdmin();
  await db
    .update(alumni)
    .set({ verifiedAt: new Date(), isVerified: true })
    .where(and(eq(alumni.id, id), isNull(alumni.verifiedAt)));
  revalidatePath("/admin");
  return { ok: true };
}

export async function rejectPlacement(id: number) {
  await requireAdmin();
  await db.delete(placements).where(and(eq(placements.id, id), isNull(placements.verifiedAt)));
  revalidatePath("/admin");
  return { ok: true };
}

/** Moderator-entered NAAC grade (with CGPA), applied directly to the college. */
export async function setNaacGrade(collegeId: number, grade: string, cgpa?: number) {
  await requireAdmin();
  await db
    .update(colleges)
    .set({ naacGrade: grade || null, naacCgpa: cgpa?.toString() ?? null })
    .where(eq(colleges.id, collegeId));
  revalidatePath("/admin");
  return { ok: true };
}
