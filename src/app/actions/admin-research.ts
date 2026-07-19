"use server";

import { requireAdminSession } from "@/lib/admin-auth";
import { collections, type CollegeDoc } from "@/db/collections";
import { nextId } from "@/db/ids";
import type { UpdateFilter } from "mongodb";
import { revalidatePath } from "next/cache";
import { aiEnabled } from "@/lib/ai";
import { researchCollege, type NirfRecord, type NaacResearch, type ResearchResult } from "@/lib/ai-research";

export type ResearchResponse =
  | ({ ok: true } & ResearchResult)
  | { ok: false; error: string };

/** AI-research a college's missing data. Returns a DRAFT — never saves. */
export async function researchCollegeData(collegeId: number): Promise<ResearchResponse> {
  await requireAdminSession();
  if (!aiEnabled)
    return { ok: false, error: "Gemini not configured (GEMINI_API_KEY)." };
  const c = await collections
    .colleges()
    .findOne({ _id: collegeId }, { projection: { name: 1, city: 1, homeUniversityName: 1 } });
  if (!c) return { ok: false, error: "College not found." };
  try {
    const result = await researchCollege({
      name: c.name,
      city: c.city,
      university: c.homeUniversityName,
    });
    return { ok: true, ...result };
  } catch (e) {
    console.error("researchCollegeData failed:", e);
    return { ok: false, error: "AI research failed — try again." };
  }
}

async function slugOf(collegeId: number) {
  const c = await collections
    .colleges()
    .findOne({ _id: collegeId }, { projection: { slug: 1 } });
  return c?.slug ?? null;
}

/** Save reviewed NIRF rows into the college's embedded nirfRankings (upsert by year). */
export async function commitResearchedNirf(collegeId: number, records: NirfRecord[]) {
  await requireAdminSession();
  if (!collegeId || !records?.length) return { ok: false, error: "Nothing to save." };
  let saved = 0;
  for (const r of records) {
    if (!r.year || (r.rank == null && r.band == null)) continue;
    const upd = await collections.colleges().updateOne(
      { _id: collegeId, "nirfRankings.year": r.year },
      {
        $set: {
          "nirfRankings.$.rank": r.rank ?? null,
          "nirfRankings.$.band": r.band ?? null,
          "nirfRankings.$.score": r.score ?? null,
        },
      } as unknown as UpdateFilter<CollegeDoc>
    );
    if (upd.matchedCount === 0) {
      const id = await nextId("nirf");
      await collections.colleges().updateOne(
        { _id: collegeId },
        {
          $push: {
            nirfRankings: {
              id, year: r.year, rank: r.rank ?? null, band: r.band ?? null,
              score: r.score ?? null, nirfInstituteId: null,
            },
          },
        }
      );
    }
    saved++;
  }
  const slug = await slugOf(collegeId);
  if (slug) revalidatePath(`/colleges/${slug}`);
  revalidatePath("/admin");
  return { ok: true, saved };
}

const NAAC_GRADES = ["A++", "A+", "A", "B++", "B+", "B", "C"];

/** Save a reviewed NAAC grade onto the college. */
export async function commitResearchedNaac(collegeId: number, naac: NaacResearch) {
  await requireAdminSession();
  if (!collegeId || !naac?.grade || !NAAC_GRADES.includes(naac.grade))
    return { ok: false, error: "Pick a valid NAAC grade." };
  if (naac.cgpa != null && (naac.cgpa < 0 || naac.cgpa > 4))
    return { ok: false, error: "CGPA must be 0–4." };
  await collections.colleges().updateOne(
    { _id: collegeId },
    {
      $set: {
        naacGrade: naac.grade,
        naacCgpa: naac.cgpa ?? null,
        naacValidUpto: naac.validUpto ?? null,
        naacSource: naac.source ?? null,
      },
    }
  );
  const slug = await slugOf(collegeId);
  if (slug) revalidatePath(`/colleges/${slug}`);
  revalidatePath("/admin");
  return { ok: true };
}
