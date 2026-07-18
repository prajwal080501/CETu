/**
 * Seed a small, realistic sample of MHT-CET Engineering data for local dev.
 *
 * Numbers here are illustrative (roughly plausible for top Pune/Mumbai colleges)
 * and are NOT verified official cutoffs — they exist only to exercise the app.
 * Real data flows in via the ingestion pipeline (see /pipeline).
 *
 * Run: pnpm db:seed   (requires DATABASE_URL)
 */
import { db } from "./index";
import {
  categories,
  universities,
  branches,
  colleges,
  collegeBranches,
  cutoffs,
} from "./schema";
import { CATEGORIES, UNIVERSITIES, BRANCHES } from "@/lib/reference";
import { eq } from "drizzle-orm";

type SeatType = "HU" | "OHU" | "SL";

// college dteCode -> branch slug -> intake + per-year/seat/category closing pct
const SAMPLE: {
  dteCode: string;
  name: string;
  slug: string;
  city: string;
  district: string;
  university: string; // shortName
  type: "government" | "government_aided" | "autonomous" | "private_unaided";
  branches: {
    slug: string;
    intake: number;
    // [year][seatType][categoryCode] = closing percentile
    cutoffs: Record<number, Partial<Record<SeatType, Record<string, number>>>>;
  }[];
}[] = [
  {
    dteCode: "01002",
    name: "College of Engineering, Pune (COEP Technological University)",
    slug: "coep-pune",
    city: "Pune",
    district: "Pune",
    university: "SPPU",
    type: "autonomous",
    branches: [
      {
        slug: "computer-engineering",
        intake: 180,
        cutoffs: {
          2024: {
            HU: { GOPEN: 99.62, GOBC: 99.1, GSC: 97.8, EWS: 99.2 },
            OHU: { GOPEN: 99.71, GOBC: 99.3 },
            SL: { GOPEN: 99.55 },
          },
          2023: {
            HU: { GOPEN: 99.55, GOBC: 98.9, GSC: 97.4, EWS: 99.0 },
            OHU: { GOPEN: 99.66, GOBC: 99.1 },
            SL: { GOPEN: 99.48 },
          },
          2022: {
            HU: { GOPEN: 99.48, GOBC: 98.6, GSC: 96.9, EWS: 98.7 },
            OHU: { GOPEN: 99.6, GOBC: 98.9 },
            SL: { GOPEN: 99.4 },
          },
        },
      },
      {
        slug: "entc",
        intake: 120,
        cutoffs: {
          2024: {
            HU: { GOPEN: 99.1, GOBC: 98.2, GSC: 95.6, EWS: 98.4 },
            OHU: { GOPEN: 99.3 },
            SL: { GOPEN: 99.05 },
          },
          2023: {
            HU: { GOPEN: 98.9, GOBC: 97.9, GSC: 95.1, EWS: 98.1 },
            OHU: { GOPEN: 99.15 },
          },
        },
      },
    ],
  },
  {
    dteCode: "03005",
    name: "Veermata Jijabai Technological Institute (VJTI), Mumbai",
    slug: "vjti-mumbai",
    city: "Mumbai",
    district: "Mumbai",
    university: "MU",
    type: "autonomous",
    branches: [
      {
        slug: "computer-engineering",
        intake: 120,
        cutoffs: {
          2024: {
            HU: { GOPEN: 99.68, GOBC: 99.2, GSC: 98.0, EWS: 99.3 },
            OHU: { GOPEN: 99.58, GOBC: 99.0 },
            SL: { GOPEN: 99.5 },
          },
          2023: {
            HU: { GOPEN: 99.6, GOBC: 99.0, GSC: 97.6, EWS: 99.1 },
            OHU: { GOPEN: 99.5, GOBC: 98.8 },
          },
        },
      },
      {
        slug: "information-technology",
        intake: 60,
        cutoffs: {
          2024: {
            HU: { GOPEN: 99.4, GOBC: 98.7, GSC: 96.8, EWS: 98.9 },
            OHU: { GOPEN: 99.3 },
          },
        },
      },
    ],
  },
  {
    dteCode: "06276",
    name: "Pune Institute of Computer Technology (PICT), Pune",
    slug: "pict-pune",
    city: "Pune",
    district: "Pune",
    university: "SPPU",
    type: "private_unaided",
    branches: [
      {
        slug: "computer-engineering",
        intake: 240,
        cutoffs: {
          2024: {
            HU: { GOPEN: 99.3, GOBC: 98.5, GSC: 96.2, EWS: 98.7 },
            OHU: { GOPEN: 99.45, GOBC: 98.9 },
            SL: { GOPEN: 99.2 },
          },
          2023: {
            HU: { GOPEN: 99.2, GOBC: 98.3, GSC: 95.8, EWS: 98.5 },
            OHU: { GOPEN: 99.35 },
          },
        },
      },
      {
        slug: "information-technology",
        intake: 120,
        cutoffs: {
          2024: {
            HU: { GOPEN: 99.0, GOBC: 98.1, GSC: 95.2, EWS: 98.3 },
            OHU: { GOPEN: 99.15 },
          },
        },
      },
    ],
  },
  {
    dteCode: "05004",
    name: "Government College of Engineering, Nagpur",
    slug: "gcoe-nagpur",
    city: "Nagpur",
    district: "Nagpur",
    university: "RTMNU",
    type: "government",
    branches: [
      {
        slug: "computer-engineering",
        intake: 90,
        cutoffs: {
          2024: {
            HU: { GOPEN: 97.8, GOBC: 96.1, GSC: 92.4, EWS: 96.8 },
            OHU: { GOPEN: 98.4 },
            SL: { GOPEN: 97.6 },
          },
        },
      },
      {
        slug: "mechanical-engineering",
        intake: 90,
        cutoffs: {
          2024: {
            HU: { GOPEN: 92.5, GOBC: 89.0, GSC: 82.1, EWS: 90.4 },
            OHU: { GOPEN: 94.0 },
          },
        },
      },
    ],
  },
];

async function seed() {
  console.log("Seeding reference data...");

  await db.insert(categories).values(CATEGORIES).onConflictDoNothing();
  await db.insert(universities).values(UNIVERSITIES).onConflictDoNothing();
  await db.insert(branches).values(BRANCHES).onConflictDoNothing();

  const catRows = await db.select().from(categories);
  const catByCode = new Map(catRows.map((c) => [c.code, c.id]));
  const univRows = await db.select().from(universities);
  const univByShort = new Map(univRows.map((u) => [u.shortName, u.id]));
  const branchRows = await db.select().from(branches);
  const branchBySlug = new Map(branchRows.map((b) => [b.slug, b.id]));

  for (const c of SAMPLE) {
    console.log(`  college: ${c.name}`);
    const [college] = await db
      .insert(colleges)
      .values({
        dteCode: c.dteCode,
        name: c.name,
        slug: c.slug,
        city: c.city,
        district: c.district,
        homeUniversityId: univByShort.get(c.university) ?? null,
        type: c.type,
      })
      .onConflictDoUpdate({
        target: colleges.dteCode,
        set: { name: c.name },
      })
      .returning();

    for (const b of c.branches) {
      const branchId = branchBySlug.get(b.slug);
      if (!branchId) throw new Error(`Unknown branch slug: ${b.slug}`);

      const [cb] = await db
        .insert(collegeBranches)
        .values({
          collegeId: college.id,
          branchId,
          totalIntake: b.intake,
        })
        .onConflictDoUpdate({
          target: [collegeBranches.collegeId, collegeBranches.branchId],
          set: { totalIntake: b.intake },
        })
        .returning();

      for (const [yearStr, bySeat] of Object.entries(b.cutoffs)) {
        const year = Number(yearStr);
        for (const [seatType, byCat] of Object.entries(bySeat)) {
          for (const [catCode, pct] of Object.entries(byCat)) {
            const categoryId = catByCode.get(catCode);
            if (!categoryId) continue;
            await db
              .insert(cutoffs)
              .values({
                collegeBranchId: cb.id,
                year,
                round: 3, // final round closing
                seatType: seatType as "HU" | "OHU" | "SL",
                categoryId,
                closingPercentile: String(pct),
                verifiedAt: new Date(), // sample data treated as verified for dev
              })
              .onConflictDoUpdate({
                target: [
                  cutoffs.collegeBranchId,
                  cutoffs.year,
                  cutoffs.round,
                  cutoffs.seatType,
                  cutoffs.categoryId,
                ],
                set: { closingPercentile: String(pct) },
              });
          }
        }
      }
    }
  }

  const [{ count } = { count: 0 }] = await db
    .select({ count: cutoffs.id })
    .from(cutoffs)
    .then((r) => [{ count: r.length }]);
  console.log(`Done. ${count} cutoff rows present.`);
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});

// silence unused import in some tooling
void eq;
