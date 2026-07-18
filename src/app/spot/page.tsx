import { db } from "@/db";
import { sql } from "drizzle-orm";
import { SpotComingSoon } from "@/components/SpotComingSoon";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Institutional & SPOT Rounds — Coming Soon",
  description:
    "Off-CAP admissions tracker: institute-level, SPOT and vacancy round cutoffs for Maharashtra engineering colleges. Premium feature — launching soon.",
};

export default async function SpotPage() {
  // Count institute-level / SPOT / cutoff round PDFs we already reference.
  const rows = (await db.execute(sql`
    select count(*)::int as n from college_documents
    where doc_type in ('institutional', 'cutoff')
  `)) as unknown as { n: number }[];
  const previewCount = rows[0]?.n ?? 0;

  return <SpotComingSoon previewCount={previewCount} />;
}
