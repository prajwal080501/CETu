import { collections } from "@/db/collections";
import { SpotComingSoon } from "@/components/SpotComingSoon";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Institutional & SPOT Rounds — Coming Soon",
  description:
    "Off-CAP admissions tracker: institute-level, SPOT and vacancy round cutoffs for Maharashtra engineering colleges. Premium feature — launching soon.",
};

export default async function SpotPage() {
  // Count institute-level / SPOT / cutoff round PDFs we already reference.
  const [agg] = await collections
    .colleges()
    .aggregate<{ n: number }>([
      { $unwind: "$documents" },
      { $match: { "documents.docType": { $in: ["institutional", "cutoff"] } } },
      { $count: "n" },
    ])
    .toArray();
  const previewCount = agg?.n ?? 0;

  return <SpotComingSoon previewCount={previewCount} />;
}
