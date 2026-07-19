"use server";

import { requireAdminSession } from "@/lib/admin-auth";
import { collections } from "@/db/collections";
import { nextId, nextIds } from "@/db/ids";
import { revalidatePath } from "next/cache";
import { putObject, makeKey, s3Enabled } from "@/lib/s3";
import { aiEnabled } from "@/lib/ai";
import {
  extractAlumniFromPdf,
  extractPlacementsFromPdf,
  type AlumniRecord,
  type PlacementRecord,
} from "@/lib/ai-extract";

const MAX_PDF = 25 * 1024 * 1024;
const MAX_IMG = 8 * 1024 * 1024;

async function collegeSlug(collegeId: number): Promise<string | null> {
  const c = await collections
    .colleges()
    .findOne({ _id: collegeId }, { projection: { slug: 1 } });
  return c?.slug ?? null;
}

async function readPdf(file: File | null): Promise<Buffer> {
  if (!file || file.size === 0) throw new Error("No PDF uploaded.");
  if (file.size > MAX_PDF) throw new Error("PDF too large (max 25 MB).");
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("Not a PDF.");
  return buf;
}

// ---- manual alumnus (with photo) -------------------------------------------

export async function addAlumnusManual(formData: FormData) {
  await requireAdminSession();
  const collegeId = Number(formData.get("collegeId"));
  const name = String(formData.get("name") || "").trim();
  if (!collegeId || !name) return { ok: false, error: "College and name are required." };

  const company = (String(formData.get("company") || "").trim() || null) as string | null;
  const role = (String(formData.get("role") || "").trim() || null) as string | null;
  const achievement = (String(formData.get("achievement") || "").trim() || null) as string | null;
  const linkedinUrl = (String(formData.get("linkedin") || "").trim() || null) as string | null;
  const batchRaw = formData.get("batchYear");
  const batchYear = batchRaw ? Number(batchRaw) : null;
  const photo = formData.get("photo") as File | null;

  let photoUrl: string | null = null;
  try {
    if (photo && photo.size > 0) {
      if (!s3Enabled) return { ok: false, error: "S3 not configured — can't store photos." };
      if (photo.size > MAX_IMG) return { ok: false, error: "Photo too large (max 8 MB)." };
      if (!photo.type.startsWith("image/")) return { ok: false, error: "Photo must be an image." };
      const buf = Buffer.from(await photo.arrayBuffer());
      const ext = photo.type.split("/")[1] || "jpg";
      photoUrl = await putObject(makeKey(`alumni/${collegeId}`, `photo.${ext}`), buf, photo.type);
    }
    const id = await nextId("alumni");
    await collections.colleges().updateOne(
      { _id: collegeId },
      {
        $push: {
          alumni: {
            id,
            name,
            company,
            role,
            batchYear,
            linkedinUrl,
            achievement,
            photoUrl,
            isVerified: true,
            verifiedAt: new Date(),
            contributedBy: null,
          },
        },
      }
    );
    const slug = await collegeSlug(collegeId);
    if (slug) revalidatePath(`/colleges/${slug}`);
    return { ok: true };
  } catch (e) {
    console.error("addAlumnusManual failed:", e);
    return { ok: false, error: "Failed to add alumnus." };
  }
}

// ---- Gemini: extract from PDF (preview) -------------------------------------

export async function extractAlumniPdf(formData: FormData) {
  await requireAdminSession();
  if (!aiEnabled) return { ok: false as const, error: "Gemini not configured (GEMINI_API_KEY)." };
  let buf: Buffer;
  try {
    buf = await readPdf(formData.get("file") as File | null);
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
  try {
    const records = await extractAlumniFromPdf(buf);
    if (records.length === 0) return { ok: false as const, error: "No alumni found in the PDF." };
    return { ok: true as const, records };
  } catch (e) {
    console.error("extractAlumniPdf failed:", e);
    return { ok: false as const, error: "Gemini extraction failed." };
  }
}

export async function extractPlacementsPdf(formData: FormData) {
  await requireAdminSession();
  if (!aiEnabled) return { ok: false as const, error: "Gemini not configured (GEMINI_API_KEY)." };
  let buf: Buffer;
  try {
    buf = await readPdf(formData.get("file") as File | null);
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
  try {
    const records = await extractPlacementsFromPdf(buf);
    if (records.length === 0) return { ok: false as const, error: "No placement data found." };
    return { ok: true as const, records };
  } catch (e) {
    console.error("extractPlacementsPdf failed:", e);
    return { ok: false as const, error: "Gemini extraction failed." };
  }
}

// ---- commit reviewed records -----------------------------------------------

export async function commitAlumni(collegeId: number, records: AlumniRecord[]) {
  await requireAdminSession();
  if (!collegeId || !records?.length) return { ok: false, error: "Nothing to save." };
  const now = new Date();
  const clean = records.filter((r) => r.name?.trim());
  const ids = await nextIds("alumni", clean.length);
  const docs = clean.map((r, i) => ({
    id: ids[i],
    name: r.name.trim(),
    company: r.company?.trim() || null,
    role: r.role?.trim() || null,
    batchYear: r.batchYear ?? null,
    achievement: r.achievement?.trim() || null,
    linkedinUrl: r.linkedin?.trim() || null,
    photoUrl: null,
    isVerified: true,
    verifiedAt: now,
    contributedBy: null,
  }));
  if (docs.length)
    await collections
      .colleges()
      .updateOne({ _id: collegeId }, { $push: { alumni: { $each: docs } } });
  const slug = await collegeSlug(collegeId);
  if (slug) revalidatePath(`/colleges/${slug}`);
  return { ok: true, count: records.length };
}

export async function commitPlacements(collegeId: number, records: PlacementRecord[]) {
  await requireAdminSession();
  if (!collegeId || !records?.length) return { ok: false, error: "Nothing to save." };
  const now = new Date();
  const clean = records.filter((r) => r.year);
  const ids = await nextIds("placements", clean.length);
  const docs = clean.map((r, i) => ({
    id: ids[i],
    year: r.year,
    avgPackageLpa: r.avgLpa ?? null,
    medianPackageLpa: r.medianLpa ?? null,
    highestPackageLpa: r.highestLpa ?? null,
    placementRatePct: r.ratePct ?? null,
    topRecruiters: r.recruiters?.trim() || null,
    source: "Admin (Gemini-extracted from official PDF)",
    verifiedAt: now,
    contributedBy: null,
  }));
  if (docs.length)
    await collections
      .colleges()
      .updateOne({ _id: collegeId }, { $push: { placements: { $each: docs } } });
  const slug = await collegeSlug(collegeId);
  if (slug) revalidatePath(`/colleges/${slug}`);
  return { ok: true, count: records.length };
}
