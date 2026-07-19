"use server";

import { auth } from "@clerk/nextjs/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { collections, type CollegeDoc } from "@/db/collections";
import { nextId } from "@/db/ids";
import type { UpdateFilter } from "mongodb";
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
  const id = await nextId("placements");
  await collections.colleges().updateOne(
    { _id: input.collegeId },
    {
      $push: {
        placements: {
          id,
          year: input.year,
          avgPackageLpa: null,
          medianPackageLpa: input.medianPackageLpa ?? null,
          highestPackageLpa: input.highestPackageLpa ?? null,
          placementRatePct: input.placementRatePct ?? null,
          topRecruiters: input.topRecruiters ?? null,
          source: input.source ?? null,
          contributedBy: userId,
          verifiedAt: null,
        },
      },
    }
  );
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
  const id = await nextId("alumni");
  await collections.colleges().updateOne(
    { _id: input.collegeId },
    {
      $push: {
        alumni: {
          id,
          name: input.name.trim(),
          achievement: input.achievement?.trim() ?? null,
          company: null,
          role: null,
          batchYear: null,
          linkedinUrl: null,
          photoUrl: null,
          isVerified: false,
          contributedBy: userId,
          verifiedAt: null,
        },
      },
    }
  );
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
  const id = await nextId("naacSubmissions");
  await collections.naacSubmissions().insertOne({
    _id: id,
    collegeId: input.collegeId,
    grade: input.grade,
    cgpa: input.cgpa ?? null,
    validUpto: input.validUpto?.trim() || null,
    source: input.source.trim(),
    contributedBy: userId,
    createdAt: new Date(),
  });
  return { ok: true };
}

export async function approveNaac(id: number) {
  await requireAdmin();
  const sub = await collections.naacSubmissions().findOne({ _id: id });
  if (!sub) return { ok: false, error: "Not found." };
  await collections.colleges().updateOne(
    { _id: sub.collegeId },
    {
      $set: {
        naacGrade: sub.grade,
        naacCgpa: sub.cgpa,
        naacValidUpto: sub.validUpto,
        naacSource: sub.source,
      },
    }
  );
  await collections.naacSubmissions().deleteOne({ _id: id });
  revalidatePath("/admin");
  return { ok: true };
}

export async function rejectNaac(id: number) {
  await requireAdmin();
  await collections.naacSubmissions().deleteOne({ _id: id });
  revalidatePath("/admin");
  return { ok: true };
}

// ---- moderation (admin) ----------------------------------------------------

const requireAdmin = requireAdminSession;

export async function approvePlacement(id: number) {
  await requireAdmin();
  await collections.colleges().updateOne(
    { "placements.id": id },
    { $set: { "placements.$[e].verifiedAt": new Date() } } as unknown as UpdateFilter<CollegeDoc>,
    { arrayFilters: [{ "e.id": id, "e.verifiedAt": null }] }
  );
  revalidatePath("/admin");
  return { ok: true };
}

export async function approveAlumnus(id: number) {
  await requireAdmin();
  await collections.colleges().updateOne(
    { "alumni.id": id },
    {
      $set: { "alumni.$[e].verifiedAt": new Date(), "alumni.$[e].isVerified": true },
    } as unknown as UpdateFilter<CollegeDoc>,
    { arrayFilters: [{ "e.id": id, "e.verifiedAt": null }] }
  );
  revalidatePath("/admin");
  return { ok: true };
}

export async function rejectPlacement(id: number) {
  await requireAdmin();
  await collections.colleges().updateOne(
    { "placements.id": id },
    { $pull: { placements: { id, verifiedAt: null } } } as unknown as UpdateFilter<CollegeDoc>
  );
  revalidatePath("/admin");
  return { ok: true };
}

/** Moderator-entered NAAC grade (with CGPA), applied directly to the college. */
export async function setNaacGrade(collegeId: number, grade: string, cgpa?: number) {
  await requireAdmin();
  await collections
    .colleges()
    .updateOne(
      { _id: collegeId },
      { $set: { naacGrade: grade || null, naacCgpa: cgpa ?? null } }
    );
  revalidatePath("/admin");
  return { ok: true };
}
