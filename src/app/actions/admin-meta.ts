"use server";

import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/db";
import { colleges, collegeBranches, branches, fees } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const FEE_YEAR = 2025; // shared with the display query (see lib/queries.ts)
const NAAC_GRADES = ["A++", "A+", "A", "B++", "B+", "B", "C"];

async function slugOf(collegeId: number) {
  const [c] = await db
    .select({ slug: colleges.slug })
    .from(colleges)
    .where(eq(colleges.id, collegeId))
    .limit(1);
  return c?.slug ?? null;
}

async function revalidateCollege(collegeId: number) {
  const slug = await slugOf(collegeId);
  if (slug) revalidatePath(`/colleges/${slug}`);
  revalidatePath("/admin");
}

// ---- NAAC (admin-set, verified directly) -----------------------------------

export async function setCollegeNaac(formData: FormData) {
  await requireAdminSession();
  const collegeId = Number(formData.get("collegeId"));
  const grade = String(formData.get("grade") || "");
  if (!collegeId || !NAAC_GRADES.includes(grade))
    return { ok: false, error: "Pick a college and a valid grade." };
  const cgpaRaw = formData.get("cgpa");
  const cgpa = cgpaRaw ? Number(cgpaRaw) : null;
  if (cgpa != null && (cgpa < 0 || cgpa > 4))
    return { ok: false, error: "CGPA must be 0–4." };
  const validUpto = (String(formData.get("validUpto") || "").trim() || null) as string | null;
  const source = (String(formData.get("source") || "").trim() || null) as string | null;

  await db
    .update(colleges)
    .set({
      naacGrade: grade,
      naacCgpa: cgpa?.toString() ?? null,
      naacValidUpto: validUpto,
      naacSource: source,
    })
    .where(eq(colleges.id, collegeId));
  await revalidateCollege(collegeId);
  return { ok: true };
}

// ---- college average fee ---------------------------------------------------

export async function setCollegeAvgFee(collegeId: number, amount: number | null) {
  await requireAdminSession();
  if (!collegeId) return { ok: false, error: "Pick a college." };
  if (amount != null && (amount < 0 || amount > 10_000_000))
    return { ok: false, error: "Enter a sensible annual fee in ₹." };
  await db
    .update(colleges)
    .set({ avgFeeAnnual: amount ?? null })
    .where(eq(colleges.id, collegeId));
  await revalidateCollege(collegeId);
  return { ok: true };
}

// ---- branch-wise fees ------------------------------------------------------

/** The college's branches with any current fee, for the admin fee editor. */
export async function getBranchFees(collegeId: number) {
  await requireAdminSession();
  const rows = await db
    .select({
      collegeBranchId: collegeBranches.id,
      branchName: branches.name,
      fee: fees.annualTuition,
    })
    .from(collegeBranches)
    .innerJoin(branches, eq(branches.id, collegeBranches.branchId))
    .leftJoin(
      fees,
      and(
        eq(fees.collegeBranchId, collegeBranches.id),
        eq(fees.year, FEE_YEAR),
        eq(fees.categoryGroup, "open")
      )
    )
    .where(eq(collegeBranches.collegeId, collegeId))
    .orderBy(branches.name);
  return rows;
}

/** Upsert branch fees (amount in ₹). Blank/0 removes that branch's fee. */
export async function setBranchFees(
  collegeId: number,
  rows: { collegeBranchId: number; amount: number | null }[]
) {
  await requireAdminSession();
  if (!collegeId || !rows?.length) return { ok: false, error: "Nothing to save." };
  let saved = 0;
  for (const r of rows) {
    if (!r.collegeBranchId) continue;
    if (r.amount == null || r.amount <= 0) {
      await db
        .delete(fees)
        .where(
          and(
            eq(fees.collegeBranchId, r.collegeBranchId),
            eq(fees.year, FEE_YEAR),
            eq(fees.categoryGroup, "open")
          )
        );
      continue;
    }
    await db
      .insert(fees)
      .values({
        collegeBranchId: r.collegeBranchId,
        year: FEE_YEAR,
        categoryGroup: "open",
        annualTuition: Math.round(r.amount),
      })
      .onConflictDoUpdate({
        target: [fees.collegeBranchId, fees.year, fees.categoryGroup],
        set: { annualTuition: Math.round(r.amount) },
      });
    saved++;
  }
  await revalidateCollege(collegeId);
  return { ok: true, saved };
}
