import { unstable_cache } from "next/cache";

/**
 * Wrapper around Next's `unstable_cache`. In the app it behaves exactly like
 * `unstable_cache`. In out-of-Next contexts (validation scripts, unit tests)
 * `unstable_cache` throws because there's no incrementalCache — set
 * `NEXT_DISABLE_CACHE=1` to bypass it and run the wrapped function directly, so
 * the real query functions can be exercised and diffed against Postgres.
 */
export const cached: typeof unstable_cache = process.env.NEXT_DISABLE_CACHE
  ? (((fn: (...args: never[]) => unknown) => fn) as unknown as typeof unstable_cache)
  : unstable_cache;
