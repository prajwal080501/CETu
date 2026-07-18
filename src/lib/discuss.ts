import { db } from "@/db";
import { threads, threadReplies, branches, colleges } from "@/db/schema";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

export interface ThreadListItem {
  id: number;
  scopeType: string;
  scopeValue: string;
  title: string;
  authorName: string | null;
  replyCount: number;
  createdAt: Date;
  lastActivityAt: Date;
}

/** Threads, optionally filtered by scope, newest-active first. */
export async function getThreads(filter?: {
  scopeType?: string;
  scopeValue?: string;
}): Promise<ThreadListItem[]> {
  const conds = [];
  if (filter?.scopeType) conds.push(eq(threads.scopeType, filter.scopeType));
  if (filter?.scopeValue) conds.push(eq(threads.scopeValue, filter.scopeValue));
  return db
    .select({
      id: threads.id,
      scopeType: threads.scopeType,
      scopeValue: threads.scopeValue,
      title: threads.title,
      authorName: threads.authorName,
      replyCount: threads.replyCount,
      createdAt: threads.createdAt,
      lastActivityAt: threads.lastActivityAt,
    })
    .from(threads)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(threads.lastActivityAt))
    .limit(100);
}

export async function getThread(id: number) {
  const [thread] = await db.select().from(threads).where(eq(threads.id, id));
  if (!thread) return null;
  const replies = await db
    .select()
    .from(threadReplies)
    .where(eq(threadReplies.threadId, id))
    .orderBy(threadReplies.createdAt);
  return { thread, replies };
}

/** Branch + city options for the scope pickers, and per-scope thread counts. */
export async function getScopeOptions() {
  const [branchRows, cityRows, counts] = await Promise.all([
    db.select({ name: branches.name }).from(branches).orderBy(branches.name),
    db
      .selectDistinct({ city: colleges.city })
      .from(colleges)
      .where(isNotNull(colleges.city))
      .orderBy(colleges.city),
    db
      .select({
        scopeType: threads.scopeType,
        scopeValue: threads.scopeValue,
        n: sql<number>`count(*)::int`,
      })
      .from(threads)
      .groupBy(threads.scopeType, threads.scopeValue),
  ]);
  const countMap = new Map(
    counts.map((c) => [`${c.scopeType}|${c.scopeValue}`, c.n])
  );
  return {
    branches: branchRows.map((b) => b.name),
    cities: cityRows.map((c) => c.city as string),
    countFor: (t: string, v: string) => countMap.get(`${t}|${v}`) ?? 0,
  };
}
