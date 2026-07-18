"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { threads, threadReplies } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const SCOPES = new Set(["branch", "city", "general"]);

export async function createThread(input: {
  scopeType: string;
  scopeValue: string;
  title: string;
  body: string;
  authorName?: string;
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Sign in to start a thread." };
  const scopeType = SCOPES.has(input.scopeType) ? input.scopeType : "general";
  const title = input.title?.trim();
  const body = input.body?.trim();
  if (!title || title.length < 4) return { ok: false, error: "Add a longer title." };
  if (!body) return { ok: false, error: "Write something in the post." };

  const [row] = await db
    .insert(threads)
    .values({
      scopeType,
      scopeValue: scopeType === "general" ? "" : (input.scopeValue ?? "").slice(0, 120),
      title: title.slice(0, 200),
      body: body.slice(0, 5000),
      authorId: userId,
      authorName: input.authorName?.slice(0, 80) ?? null,
    })
    .returning({ id: threads.id });
  revalidatePath("/discuss");
  return { ok: true, id: row.id };
}

export async function createReply(input: {
  threadId: number;
  body: string;
  authorName?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Sign in to reply." };
  const body = input.body?.trim();
  if (!body) return { ok: false, error: "Write a reply." };

  await db.insert(threadReplies).values({
    threadId: input.threadId,
    body: body.slice(0, 5000),
    authorId: userId,
    authorName: input.authorName?.slice(0, 80) ?? null,
  });
  await db
    .update(threads)
    .set({
      replyCount: sql`${threads.replyCount} + 1`,
      lastActivityAt: new Date(),
    })
    .where(eq(threads.id, input.threadId));
  revalidatePath(`/discuss/${input.threadId}`);
  revalidatePath("/discuss");
  return { ok: true };
}
