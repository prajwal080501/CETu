import { collections } from "@/db/collections";
import type { Filter } from "mongodb";
import type { ThreadDoc } from "@/db/collections";

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
  const q: Filter<ThreadDoc> = {};
  if (filter?.scopeType) q.scopeType = filter.scopeType;
  if (filter?.scopeValue) q.scopeValue = filter.scopeValue;
  const rows = await collections
    .threads()
    .find(q)
    .sort({ lastActivityAt: -1 })
    .limit(100)
    .toArray();
  return rows.map((t) => ({
    id: t._id,
    scopeType: t.scopeType,
    scopeValue: t.scopeValue,
    title: t.title,
    authorName: t.authorName,
    replyCount: t.replyCount,
    createdAt: t.createdAt,
    lastActivityAt: t.lastActivityAt,
  }));
}

export async function getThread(id: number) {
  const t = await collections.threads().findOne({ _id: id });
  if (!t) return null;
  const replyDocs = await collections
    .threadReplies()
    .find({ threadId: id })
    .sort({ createdAt: 1 })
    .toArray();
  const thread = {
    id: t._id,
    scopeType: t.scopeType,
    scopeValue: t.scopeValue,
    title: t.title,
    body: t.body,
    authorId: t.authorId,
    authorName: t.authorName,
    replyCount: t.replyCount,
    createdAt: t.createdAt,
    lastActivityAt: t.lastActivityAt,
  };
  const replies = replyDocs.map((r) => ({
    id: r._id,
    threadId: r.threadId,
    body: r.body,
    authorId: r.authorId,
    authorName: r.authorName,
    createdAt: r.createdAt,
  }));
  return { thread, replies };
}

/** Branch + city options for the scope pickers, and per-scope thread counts. */
export async function getScopeOptions() {
  const [branchDocs, cities, counts] = await Promise.all([
    collections.branches().find({}, { projection: { name: 1 } }).toArray(),
    collections.colleges().distinct("city", { city: { $ne: null } }),
    collections
      .threads()
      .aggregate<{ scopeType: string; scopeValue: string; n: number }>([
        {
          $group: {
            _id: { scopeType: "$scopeType", scopeValue: "$scopeValue" },
            n: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            scopeType: "$_id.scopeType",
            scopeValue: "$_id.scopeValue",
            n: 1,
          },
        },
      ])
      .toArray(),
  ]);
  const countMap = new Map(counts.map((c) => [`${c.scopeType}|${c.scopeValue}`, c.n]));
  return {
    branches: branchDocs
      .map((b) => b.name)
      .sort((a, b) => a.localeCompare(b)),
    cities: (cities as (string | null)[])
      .filter((c): c is string => c != null)
      .sort((a, b) => a.localeCompare(b)),
    countFor: (t: string, v: string) => countMap.get(`${t}|${v}`) ?? 0,
  };
}
