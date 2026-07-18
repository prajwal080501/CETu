"use server";

import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/db";
import { collegeDocuments, sourceDocuments, cutoffs, colleges } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { putPdf, makeKey, s3Enabled } from "@/lib/s3";
import { loadCutoffRows, type ParsedRow } from "@/db/load-cutoffs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const execFileP = promisify(execFile);
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/** Turn an AWS SDK / storage error into an actionable message. */
function storageError(e: unknown): string {
  const name = (e as { name?: string })?.name ?? "";
  if (name === "NoSuchBucket")
    return "S3 bucket not found — check AWS_S3_BUCKET and that AWS_REGION matches the bucket's region.";
  if (name === "InvalidAccessKeyId" || name === "SignatureDoesNotMatch")
    return "S3 credentials rejected — check AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.";
  if (name === "AccessDenied")
    return "S3 access denied — the IAM user needs s3:PutObject on this bucket.";
  return (e as Error)?.message || "Upload failed.";
}

const requireAdmin = requireAdminSession;

/** Read an uploaded PDF File into a validated Buffer. */
async function readPdf(file: File | null): Promise<Buffer> {
  if (!file || file.size === 0) throw new Error("No file uploaded.");
  if (file.size > MAX_BYTES) throw new Error("File too large (max 25 MB).");
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-")
    throw new Error("Not a PDF file.");
  return buf;
}

// ---- general document upload -----------------------------------------------

export async function uploadCollegeDocument(formData: FormData) {
  await requireAdmin();
  if (!s3Enabled) return { ok: false, error: "S3 storage is not configured." };

  const collegeId = Number(formData.get("collegeId"));
  const docType = String(formData.get("docType") || "other");
  const title = String(formData.get("title") || "").trim();
  const yearRaw = formData.get("year");
  const year = yearRaw ? Number(yearRaw) : null;
  const file = formData.get("file") as File | null;

  if (!collegeId) return { ok: false, error: "Pick a college." };
  if (!title) return { ok: false, error: "Give the document a title." };

  let buf: Buffer;
  try {
    buf = await readPdf(file);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  try {
    const key = makeKey(`docs/${collegeId}`, file!.name);
    await putPdf(key, buf);
    await db.insert(collegeDocuments).values({
      collegeId,
      docType,
      year,
      title,
      url: key, // S3 key — resolved to a presigned URL on read
    });
    const [c] = await db
      .select({ slug: colleges.slug })
      .from(colleges)
      .where(eq(colleges.id, collegeId))
      .limit(1);
    if (c) revalidatePath(`/colleges/${c.slug}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    console.error("uploadCollegeDocument failed:", e);
    return { ok: false, error: storageError(e) };
  }
}

// ---- cutoff PDF ingestion --------------------------------------------------

export async function ingestCutoffPdf(formData: FormData) {
  await requireAdmin();
  if (!s3Enabled) return { ok: false, error: "S3 storage is not configured." };

  const year = Number(formData.get("year"));
  const round = Number(formData.get("round"));
  const title = String(formData.get("title") || "").trim();
  const file = formData.get("file") as File | null;

  if (!year || !round)
    return { ok: false, error: "Year and round are required." };

  let buf: Buffer;
  try {
    buf = await readPdf(file);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const tmpPdf = join(tmpdir(), `cet-${randomUUID()}.pdf`);
  const tmpJsonl = `${tmpPdf}.jsonl`;
  let sourceDocId: number | null = null;

  try {
    // 1. Store raw PDF in S3 for provenance.
    const key = makeKey(`cutoffs/${year}-r${round}`, file!.name);
    await putPdf(key, buf);
    const sha256 = createHash("sha256").update(buf).digest("hex");

    // 2. Provenance record.
    const [src] = await db
      .insert(sourceDocuments)
      .values({
        title: title || `Cutoff ${year} Round ${round} — ${file!.name}`,
        sourceUrl: key,
        storagePath: key,
        year,
        round,
        docType: "cutoff",
        sha256,
      })
      .returning({ id: sourceDocuments.id });
    sourceDocId = src.id;

    // 3. Parse with the validated Python parser (needs a local path).
    await writeFile(tmpPdf, buf);
    const script = join(process.cwd(), "pipeline", "parse_cutoff.py");
    await execFileP(
      "python3",
      [script, tmpPdf, "--year", String(year), "--round", String(round), "--out", tmpJsonl],
      { cwd: process.cwd(), timeout: 180_000 }
    );

    // 4. Load rows as PENDING linked to the source document.
    const text = await readFile(tmpJsonl, "utf8");
    const rows: ParsedRow[] = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    if (rows.length === 0) throw new Error("Parser produced no rows.");
    const summary = await loadCutoffRows(rows, {
      verifiedAt: null,
      sourceDocumentId: sourceDocId,
    });

    revalidatePath("/admin");
    return { ok: true, sourceDocumentId: sourceDocId, parsedRows: rows.length, summary };
  } catch (e) {
    // Roll back the provenance row so a failed parse doesn't leave an orphan.
    if (sourceDocId != null)
      await db.delete(sourceDocuments).where(eq(sourceDocuments.id, sourceDocId)).catch(() => {});
    console.error("ingestCutoffPdf failed:", e);
    const msg = (e as Error).message || "Ingestion failed.";
    if (/ENOENT|python3/.test(msg))
      return { ok: false, error: "Parser not available (python3/pdftotext missing)." };
    return { ok: false, error: storageError(e) };
  } finally {
    await unlink(tmpPdf).catch(() => {});
    await unlink(tmpJsonl).catch(() => {});
    await unlink(`${tmpJsonl}.flags.json`).catch(() => {});
  }
}

// ---- batch moderation ------------------------------------------------------

export async function approveCutoffBatch(sourceDocumentId: number) {
  await requireAdmin();
  await db
    .update(cutoffs)
    .set({ verifiedAt: new Date() })
    .where(and(eq(cutoffs.sourceDocumentId, sourceDocumentId), isNull(cutoffs.verifiedAt)));
  revalidatePath("/admin");
  return { ok: true };
}

export async function rejectCutoffBatch(sourceDocumentId: number) {
  await requireAdmin();
  await db
    .delete(cutoffs)
    .where(and(eq(cutoffs.sourceDocumentId, sourceDocumentId), isNull(cutoffs.verifiedAt)));
  await db.delete(sourceDocuments).where(eq(sourceDocuments.id, sourceDocumentId));
  revalidatePath("/admin");
  return { ok: true };
}
