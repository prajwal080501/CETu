import { redirect } from "next/navigation";

/** The predictor was renamed to "Make My List" — redirect old links (and any
 * saved /predictor?percentile=… URLs) to the new route, preserving params. */
export default async function PredictorRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      v == null ? [] : Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]]
    ) as [string, string][]
  ).toString();
  redirect(`/make-my-list${qs ? `?${qs}` : ""}`);
}
