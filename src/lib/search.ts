/**
 * Intelligent, dependency-free college search scoring. Pure functions — safe to
 * import into client components. Ranks colleges for a free-text query with:
 *  - multi-term AND matching ("walchand sangli", "computer pune")
 *  - acronym matching, incl. buried acronyms via subsequence:
 *      "mmcoe" → Marathwada Mitra Mandal's College Of Engineering
 *      "dypcoe" → Dr. D. Y. Patil College Of Engineering
 *      "scoe"  → Sinhgad College Of Engineering
 *      "sppu"  → Savitribai Phule Pune University (university acronym)
 *  - field weighting (name > acronym > city > university)
 *  - prefix / word-start boosts over plain substring hits
 * Ties preserve the input order (V8 sort is stable), so an equally-relevant
 * pair keeps the caller's ranking (e.g. competitiveness).
 */

export type Searchable = {
  name: string;
  city?: string | null;
  university?: string | null;
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ordered initials of EVERY word (incl. "of"/"and"/"&", which users type —
 * College **O**f **E**ngineering = COE). Keeping every initial lets a typed
 * acronym match as a subsequence even when the real initials are buried behind
 * a trust/society prefix (e.g. "mmcoe" inside "mmmcoekp").
 */
export function acronym(name: string): string {
  return norm(name)
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("");
}

/** True if `needle` appears as an ordered (not necessarily contiguous) subsequence of `hay`. */
function subseq(hay: string, needle: string): boolean {
  if (!needle) return false;
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++) {
    if (hay[j] === needle[i]) i++;
  }
  return i === needle.length;
}

/** Score one doc against pre-normalized query terms. 0 = excluded (AND). */
function scoreOne(doc: Searchable, terms: string[]): number {
  const name = norm(doc.name);
  const nameWords = name.split(" ");
  const nameCollapsed = name.replace(/\s+/g, ""); // "k k wagh" → "kkwagh"
  const city = norm(doc.city ?? "");
  const uni = norm(doc.university ?? "");
  const nameAcr = acronym(doc.name);
  const uniAcr = acronym(doc.university ?? "");

  let total = 0;
  for (const t of terms) {
    let best = 0;
    if (name === t) best = 1000;
    else if (name.startsWith(t)) best = 600;
    if (nameAcr === t) best = Math.max(best, 550);
    if (nameWords.some((w) => w.startsWith(t))) best = Math.max(best, 350);
    if (t.length >= 2 && nameAcr.startsWith(t)) best = Math.max(best, 320);
    // Contiguous buried acronym: initials of consecutive words, e.g. "dj" for
    // **D**warkadas **J**. Sanghvi (acronym "svpkmsdjscoevpm" contains "dj"), or
    // "mmcoe" inside a trust-prefixed acronym. Precise, so ranked above subseq.
    if (t.length >= 2 && nameAcr.includes(t)) best = Math.max(best, 300);
    // Buried-acronym match via subsequence (mmcoe inside mmmcoekp), length ≥ 3.
    if (t.length >= 3 && subseq(nameAcr, t)) best = Math.max(best, 250);
    // Collapsed-name substring: initials+word merges like "kkwagh" (K K Wagh).
    if (t.length >= 3 && nameCollapsed.includes(t)) best = Math.max(best, 260);
    if (name.includes(t)) best = Math.max(best, 200);
    if (city.startsWith(t)) best = Math.max(best, 180);
    else if (city.includes(t)) best = Math.max(best, 100);
    // University acronym (sppu, mu) + substring.
    if (uniAcr === t) best = Math.max(best, 150);
    else if (t.length >= 3 && subseq(uniAcr, t)) best = Math.max(best, 110);
    if (uni.includes(t)) best = Math.max(best, 80);
    if (best === 0) return 0; // every term must match somewhere
    total += best;
  }
  return total;
}

/** Rank `docs` for `query`. Empty query returns the input order (capped). */
export function searchColleges<T extends Searchable>(
  docs: T[],
  query: string,
  limit?: number
): T[] {
  const q = norm(query);
  if (!q) return limit ? docs.slice(0, limit) : docs;
  const terms = q.split(" ").filter(Boolean);
  const scored: { d: T; s: number }[] = [];
  for (const d of docs) {
    const s = scoreOne(d, terms);
    if (s > 0) scored.push({ d, s });
  }
  scored.sort((a, b) => b.s - a.s); // stable → ties keep input (rank) order
  const out = scored.map((x) => x.d);
  return limit ? out.slice(0, limit) : out;
}
