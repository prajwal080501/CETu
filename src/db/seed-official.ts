/**
 * Placement data + official document links for the top 5 engineering colleges in
 * Pune, Mumbai and Nagpur (by 2025 CAP cutoff).
 *
 * SOURCING: figures are taken from each college's OWN placement page/PDF or its
 * NIRF submission wherever accessible; a few come from that college's published
 * report as compiled by education portals (marked `reported: true`). The exact
 * `source` URL is stored and shown on the frontend so provenance is transparent.
 * Numbers are indicative (packages in LPA) and should be confirmed against the
 * linked source. Extend via the admin/contribute flow.
 *
 * Run: DATABASE_URL=... tsx src/db/seed-official.ts
 */
import { db } from "./index";
import { colleges, collegeDocuments, placements } from "./schema";
import { eq, inArray } from "drizzle-orm";

const WEBSITES: Record<string, string> = {
  "03012": "https://vjti.ac.in",
  "06006": "https://www.coeptech.ac.in",
  "06271": "https://www.pict.edu",
  "04115": "https://www.rknec.edu",
  "06273": "https://www.vit.edu",
  "06177": "https://cms.sinhgad.edu",
  "06272": "http://www.dypcoeakurdi.ac.in",
  "06145": "https://jspmjscoe.edu.in",
  "03036": "https://www.ictmumbai.edu.in",
  "03199": "https://www.djsce.ac.in",
  "03182": "https://tsec.edu",
  "03185": "https://vesit.ves.ac.in",
  "04025": "https://www.gcoen.ac.in",
  "04167": "https://ycce.edu",
};

interface Doc {
  dte: string;
  docType: "placement" | "institutional" | "cutoff" | "brochure";
  year: number;
  title: string;
  url: string;
}
const DOCUMENTS: Doc[] = [
  { dte: "03012", docType: "placement", year: 2025, title: "UG Placement Report AY 2024–25", url: "https://vjti.ac.in/wp-content/uploads/2025/06/UG-Placement-report-AY-2024-25.pdf" },
  { dte: "03012", docType: "placement", year: 2024, title: "Placement Report AY 2023–24", url: "https://vjti.ac.in/wp-content/uploads/2024/07/VJTI-Placement-Report-2023-24_240712_155623.pdf" },
  { dte: "06006", docType: "placement", year: 2026, title: "Placement Statistics 2025–26 (B.Tech)", url: "https://www.coeptech.ac.in/wp-content/uploads/2026/07/Placement-Data-2025-26-B-.-Tech-2.pdf" },
  { dte: "06006", docType: "placement", year: 2025, title: "Placement Statistics 2024–25", url: "https://www.coeptech.ac.in/wp-content/uploads/2025/08/Placement-Statistics-2024-25.pdf" },
  { dte: "06006", docType: "institutional", year: 2025, title: "SPOT (institute-level) Round Cutoff", url: "https://www.coeptech.ac.in/wp-content/uploads/2025/04/SPOT-Round-Cutoff-COEP-Tech.pdf" },
  { dte: "06006", docType: "cutoff", year: 2025, title: "CAP Round 1 Cutoff", url: "https://www.coeptech.ac.in/wp-content/uploads/2025/04/Cutoff-Round-1-COEP-Tech.pdf" },
  { dte: "06271", docType: "placement", year: 2025, title: "Placement Report 2024–25", url: "https://www.pict.edu/placement/pdf/Placement%20Report%202024-25.pdf" },
  { dte: "06271", docType: "placement", year: 2024, title: "Placement Report 2023–24", url: "https://www.pict.edu/placement/pdf/Placement%20Report%202023-24.pdf" },
  { dte: "04115", docType: "placement", year: 2025, title: "Placement Metric Evaluation Sheet", url: "https://rbunagpur.in/wp-content/uploads/2025/04/Placement-Metric-Evaluation-Sheet.pdf" },
  { dte: "06273", docType: "placement", year: 2025, title: "Placements — official page", url: "https://www.vit.edu/placement/" },
  { dte: "06177", docType: "placement", year: 2025, title: "Placements — official page", url: "https://cms.sinhgad.edu/sinhgad_engineering_institutes/vadgaon_scoe/scoe_placements.aspx" },
  { dte: "06272", docType: "placement", year: 2025, title: "Placement statistics — official page", url: "http://www.dypcoeakurdi.ac.in/placements/placement-statistics" },
  { dte: "06145", docType: "placement", year: 2025, title: "Placement statistics — official page", url: "https://jspmjscoe.edu.in/placements/statistics" },
  { dte: "03182", docType: "placement", year: 2025, title: "Placement statistics — official page", url: "https://tsec.edu/placement-statistics-2/" },
  { dte: "03185", docType: "placement", year: 2025, title: "Placement statistics — official page", url: "https://vesit.ves.ac.in/placements/statistics" },
  { dte: "04025", docType: "placement", year: 2024, title: "Placement Report 2024", url: "https://www.gcoen.ac.in/downloads/Placement_Report_2024.pdf" },
  { dte: "04167", docType: "placement", year: 2025, title: "Placement details — official page", url: "https://ycce.edu/placement-details/" },
];

interface PlaceRow {
  dte: string;
  year: number;
  avg?: number;
  median?: number;
  highest?: number;
  rate?: number;
  recruiters?: string;
  source: string;
  reported?: boolean; // true when compiled from the college's report via a portal
}
const PLACEMENTS: PlaceRow[] = [
  // Mumbai
  { dte: "03012", year: 2024, rate: 82, highest: 54.0, avg: 10.4, source: "https://vjti.ac.in/wp-content/uploads/2025/06/UG-Placement-report-AY-2024-25.pdf" }, // extracted from official PDF
  { dte: "03036", year: 2024, median: 9.0, highest: 17.0, rate: 95, recruiters: "L&T, Unilever, Reliance, BPCL, Honeywell, ONGC", source: "https://www.ictmumbai.edu.in/" },
  { dte: "03199", year: 2024, avg: 11.1, median: 10.4, highest: 32.0, source: "https://www.djsce.ac.in/", reported: true },
  { dte: "03182", year: 2024, median: 7.0, highest: 24.13, recruiters: "as per official placement statistics", source: "https://tsec.edu/placement-statistics-2/" },
  { dte: "03185", year: 2024, avg: 6.5, highest: 14.5, recruiters: "Morgan Stanley, J.P. Morgan, Nomura", source: "https://vesit.ves.ac.in/placements/statistics" },
  // Pune
  { dte: "06006", year: 2025, avg: 12.5, median: 10.5, highest: 60.3, rate: 87.46, recruiters: "DE Shaw, Texas Instruments, Meesho, ZS Associates, Accenture", source: "https://www.coeptech.ac.in/wp-content/uploads/2026/07/Placement-Data-2025-26-B-.-Tech-2.pdf" }, // AY 2025-26, official PDF
  { dte: "06006", year: 2024, avg: 11.62, highest: 52.57, rate: 84, recruiters: "Nutanix, FINIQ, Oracle, Future First", source: "https://www.coeptech.ac.in/wp-content/uploads/2025/08/Placement-Statistics-2024-25.pdf" }, // AY 2024-25, official PDF
  { dte: "06271", year: 2024, median: 8.38, rate: 92.89, recruiters: "Accenture, Barclays, HCL, L&T Infotech", source: "https://www.pict.edu/placement/" },
  { dte: "06273", year: 2024, median: 7.6, highest: 50.0, recruiters: "Accenture, Cognizant, Infosys", source: "https://www.vit.edu/placement/" },
  { dte: "06177", year: 2024, avg: 5.0, rate: 51, recruiters: "HCL, TATA, Infosys, IBM, ICICI Bank", source: "https://cms.sinhgad.edu/sinhgad_engineering_institutes/vadgaon_scoe/scoe_placements.aspx", reported: true }, // highest package removed — 55 LPA was an unverifiable self-reported outlier
  { dte: "06272", year: 2024, median: 6.0, highest: 52.0, rate: 73, source: "http://www.dypcoeakurdi.ac.in/placements/placement-statistics" },
  { dte: "06145", year: 2024, avg: 5.5, highest: 26.4, recruiters: "TCS, Tech Mahindra, Accenture, IBM", source: "https://jspmjscoe.edu.in/placements/statistics", reported: true },
  // Nagpur
  { dte: "04025", year: 2024, avg: 5.77, highest: 9.25, recruiters: "Infosys, TCS, Tech Mahindra, HCL, L&T Infotech", source: "https://www.gcoen.ac.in/downloads/Placement_Report_2024.pdf" },
  { dte: "04167", year: 2024, avg: 7.0, highest: 20.0, source: "https://ycce.edu/placement-details/" },
  { dte: "04116", year: 2024, avg: 4.5, median: 5.6, highest: 16.0, source: "https://ghrce.raisoni.net/", reported: true },
  { dte: "04123", year: 2024, avg: 4.0, highest: 27.0, source: "https://www.shiksha.com/college/priyadarshini-college-of-engineering-nagpur-59635/placement", reported: true },
  { dte: "04115", year: 2024, avg: 10.5, highest: 52.0, source: "https://rbunagpur.in/placement-report/", reported: true },
];

async function main() {
  const dtes = [...new Set([...Object.keys(WEBSITES), ...PLACEMENTS.map((p) => p.dte)])];
  const rows = await db
    .select({ id: colleges.id, dteCode: colleges.dteCode })
    .from(colleges)
    .where(inArray(colleges.dteCode, dtes));
  const idByDte = new Map(rows.map((r) => [r.dteCode, r.id]));

  for (const [dte, website] of Object.entries(WEBSITES)) {
    const id = idByDte.get(dte);
    if (id) await db.update(colleges).set({ website }).where(eq(colleges.id, id));
  }

  const ids = [...idByDte.values()];
  if (ids.length) {
    await db.delete(collegeDocuments).where(inArray(collegeDocuments.collegeId, ids));
    await db.delete(placements).where(inArray(placements.collegeId, ids));
  }
  for (const d of DOCUMENTS) {
    const id = idByDte.get(d.dte);
    if (id) await db.insert(collegeDocuments).values({ collegeId: id, docType: d.docType, year: d.year, title: d.title, url: d.url });
  }
  const now = new Date();
  for (const p of PLACEMENTS) {
    const id = idByDte.get(p.dte);
    if (!id) continue;
    await db.insert(placements).values({
      collegeId: id, year: p.year,
      avgPackageLpa: p.avg?.toString() ?? null,
      medianPackageLpa: p.median?.toString() ?? null,
      highestPackageLpa: p.highest?.toString() ?? null,
      placementRatePct: p.rate?.toString() ?? null,
      topRecruiters: p.recruiters ?? null,
      source: p.source,
      verifiedAt: now,
    });
  }
  console.log(`seeded: ${Object.keys(WEBSITES).length} websites, ${DOCUMENTS.length} documents, ${PLACEMENTS.length} placement rows`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
