import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Simple username/password gate for the admin panel, independent of Clerk.
 * Credentials live in env (`ADMIN_USERNAME` / `ADMIN_PASSWORD`); a login sets a
 * signed, httpOnly session cookie (HMAC with `ADMIN_SESSION_SECRET`) so it can't
 * be forged. All admin pages and server actions check `isAdminAuthed()`.
 */

const USER = process.env.ADMIN_USERNAME;
const PASS = process.env.ADMIN_PASSWORD;
const SECRET =
  process.env.ADMIN_SESSION_SECRET || (PASS ? `sess:${PASS}` : "");
const COOKIE = "cet_admin";
const MAX_AGE = 60 * 60 * 12; // 12h

const isReal = (v: string | undefined) => Boolean(v && v !== "REPLACE_ME");

/** True when admin credentials are configured. */
export const adminConfigured = isReal(USER) && isReal(PASS);

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

function makeToken(): string {
  const payload = `${USER}.${Date.now()}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

function validToken(token: string | undefined): boolean {
  if (!token || !SECRET) return false;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return false;
  const payload = Buffer.from(b64, "base64url").toString("utf8");
  if (!safeEqual(sig, sign(payload))) return false;
  const [, ts] = payload.split(".");
  const age = Date.now() - Number(ts);
  return Number.isFinite(age) && age >= 0 && age < MAX_AGE * 1000;
}

/** Check username + password against the configured admin account. */
export function verifyCredentials(username: string, password: string): boolean {
  if (!adminConfigured) return false;
  return safeEqual(username, USER!) && safeEqual(password, PASS!);
}

/** Set the signed admin session cookie (call after verifyCredentials). */
export async function createAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Is the current request an authenticated admin? */
export async function isAdminAuthed(): Promise<boolean> {
  const jar = await cookies();
  return validToken(jar.get(COOKIE)?.value);
}

/** Throw unless the caller holds a valid admin session (for server actions). */
export async function requireAdminSession(): Promise<void> {
  if (!(await isAdminAuthed())) throw new Error("unauthorized");
}
