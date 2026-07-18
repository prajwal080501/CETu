import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * AWS S3 storage for admin-uploaded PDFs (college documents + raw cutoff PDFs).
 * Graceful degradation like the other integrations: gated on `s3Enabled`. The
 * bucket is assumed private — objects are read back via short-lived presigned
 * GET URLs, and we store the S3 KEY (not a URL) as the canonical reference.
 */

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.AWS_S3_BUCKET;
const KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const SECRET = process.env.AWS_SECRET_ACCESS_KEY;

const isReal = (v: string | undefined) => Boolean(v && v !== "REPLACE_ME");

export const s3Enabled = isReal(REGION) && isReal(BUCKET);

let _client: S3Client | null = null;
function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: REGION,
      // Explicit creds when provided; otherwise fall back to the default IAM
      // provider chain (instance role, SSO, shared config, etc.).
      ...(isReal(KEY_ID) && isReal(SECRET)
        ? { credentials: { accessKeyId: KEY_ID!, secretAccessKey: SECRET! } }
        : {}),
    });
  }
  return _client;
}

/** Upload a buffer to `key` with an explicit content type. Returns the key. */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  if (!s3Enabled) throw new Error("S3 is not configured.");
  await client().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
  return key;
}

/** Upload a PDF buffer to `key`. Returns the stored key. */
export function putPdf(key: string, body: Buffer): Promise<string> {
  return putObject(key, body, "application/pdf");
}

/** Short-lived presigned GET URL for an S3 key (default 1h). */
export async function signedGetUrl(key: string, expiresIn = 3600): Promise<string> {
  if (!s3Enabled) throw new Error("S3 is not configured.");
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  );
}

/** Heuristic: a stored doc reference that is an S3 key (not an external URL). */
export function isS3Key(ref: string): boolean {
  return !/^https?:\/\//i.test(ref);
}

/** Build a safe, namespaced S3 object key. */
export function makeKey(prefix: string, filename: string): string {
  const safe = filename
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const uuid = crypto.randomUUID();
  return `${prefix}/${uuid}-${safe || "file.pdf"}`;
}
