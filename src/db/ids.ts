import { db } from "./mongo";

/**
 * Sequential id generator replacing Postgres `serial`. A `counters` collection
 * holds one document per sequence (`_id` = sequence name, `value` = last id
 * handed out). Seed the counters to the current data max after migration (see
 * scripts/ensure-indexes.ts) so new ids never collide with imported ones.
 *
 * Sequence names in use: colleges, branches, universities, categories,
 * offerings, seatMatrix, cutoffs, sourceDocuments, threads, threadReplies,
 * naacSubmissions, and the embedded-array sequences placements/alumni/documents/fees.
 */
interface Counter {
  _id: string;
  value: number;
}

/** Reserve and return the next id for a sequence. */
export async function nextId(seq: string): Promise<number> {
  const doc = await db
    .collection<Counter>("counters")
    .findOneAndUpdate(
      { _id: seq },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" }
    );
  return doc!.value;
}

/** Reserve `count` consecutive ids and return them in order. */
export async function nextIds(seq: string, count: number): Promise<number[]> {
  if (count <= 0) return [];
  const doc = await db
    .collection<Counter>("counters")
    .findOneAndUpdate(
      { _id: seq },
      { $inc: { value: count } },
      { upsert: true, returnDocument: "after" }
    );
  const end = doc!.value; // last id in the reserved block
  const start = end - count + 1;
  return Array.from({ length: count }, (_, i) => start + i);
}
