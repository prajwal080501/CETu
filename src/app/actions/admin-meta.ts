"use server";

import { requireAdminSession } from "@/lib/admin-auth";
import { collections, type CollegeDoc } from "@/db/collections";
import { nextId } from "@/db/ids";
import type { UpdateFilter } from "mongodb";
import { revalidatePath } from "next/cache";

const FEE_YEAR = 2025; // shared with the display query (see lib/queries.ts)
const NAAC_GRADES = ["A++", "A+", "A", "B++", "B+", "B", "C"];

async function slugOf(collegeId: number) {
  const c = await collections
    .colleges()
    .findOne({ _id: collegeId }, { projection: { slug: 1 } });
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

  await collections.colleges().updateOne(
    { _id: collegeId },
    { $set: { naacGrade: grade, naacCgpa: cgpa, naacValidUpto: validUpto, naacSource: source } }
  );
  await revalidateCollege(collegeId);
  return { ok: true };
}

// ---- college average fee ---------------------------------------------------

export async function setCollegeAvgFee(collegeId: number, amount: number | null) {
  await requireAdminSession();
  if (!collegeId) return { ok: false, error: "Pick a college." };
  if (amount != null && (amount < 0 || amount > 10_000_000))
    return { ok: false, error: "Enter a sensible annual fee in ₹." };
  await collections
    .colleges()
    .updateOne({ _id: collegeId }, { $set: { avgFeeAnnual: amount ?? null } });
  await revalidateCollege(collegeId);
  return { ok: true };
}

// ---- branch-wise fees ------------------------------------------------------

/** The college's branches with any current fee, for the admin fee editor. */
export async function getBranchFees(collegeId: number) {
  await requireAdminSession();
  const [offerings, branchDocs, college] = await Promise.all([
    collections.offerings().find({ collegeId }).toArray(),
    collections.branches().find({}, { projection: { name: 1 } }).toArray(),
    collections.colleges().findOne({ _id: collegeId }, { projection: { fees: 1 } }),
  ]);
  const nameById = new Map(branchDocs.map((b) => [b._id, b.name]));
  const feeFor = new Map<number, number | null>();
  for (const f of college?.fees ?? []) {
    if (f.year === FEE_YEAR && f.categoryGroup === "open")
      feeFor.set(f.collegeBranchId, f.annualTuition);
  }
  return offerings
    .map((o) => ({
      collegeBranchId: o._id,
      branchName: nameById.get(o.branchId) ?? o.branchName,
      fee: feeFor.get(o._id) ?? null,
    }))
    .sort((a, b) => a.branchName.localeCompare(b.branchName));
}

/** Upsert branch fees (amount in ₹). Blank/0 removes that branch's fee. */
export async function setBranchFees(
  collegeId: number,
  rows: { collegeBranchId: number; amount: number | null }[]
) {
  await requireAdminSession();
  if (!collegeId || !rows?.length) return { ok: false, error: "Nothing to save." };

  const college = await collections
    .colleges()
    .findOne({ _id: collegeId }, { projection: { fees: 1 } });
  const existing = new Set(
    (college?.fees ?? [])
      .filter((f) => f.year === FEE_YEAR && f.categoryGroup === "open")
      .map((f) => f.collegeBranchId)
  );

  let saved = 0;
  for (const r of rows) {
    if (!r.collegeBranchId) continue;
    if (r.amount == null || r.amount <= 0) {
      await collections.colleges().updateOne(
        { _id: collegeId },
        {
          $pull: {
            fees: { collegeBranchId: r.collegeBranchId, year: FEE_YEAR, categoryGroup: "open" },
          },
        } as unknown as UpdateFilter<CollegeDoc>
      );
      existing.delete(r.collegeBranchId);
      continue;
    }
    const amt = Math.round(r.amount);
    if (existing.has(r.collegeBranchId)) {
      await collections.colleges().updateOne(
        { _id: collegeId },
        { $set: { "fees.$[e].annualTuition": amt } } as unknown as UpdateFilter<CollegeDoc>,
        {
          arrayFilters: [
            { "e.collegeBranchId": r.collegeBranchId, "e.year": FEE_YEAR, "e.categoryGroup": "open" },
          ],
        }
      );
    } else {
      const id = await nextId("fees");
      await collections.colleges().updateOne(
        { _id: collegeId },
        {
          $push: {
            fees: {
              id,
              collegeBranchId: r.collegeBranchId,
              year: FEE_YEAR,
              categoryGroup: "open",
              annualTuition: amt,
              source: null,
            },
          },
        }
      );
      existing.add(r.collegeBranchId);
    }
    saved++;
  }
  await revalidateCollege(collegeId);
  return { ok: true, saved };
}
