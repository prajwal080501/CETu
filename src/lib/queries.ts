import { collections } from "@/db/collections";
import { cached } from "./query-cache";
import type { CutoffRow } from "./predictor";
import type { CutoffHistoryRow } from "./predictor";
import type { SeatType } from "./reference";
import { s3Enabled, isS3Key, signedGetUrl } from "./s3";

const FEE_YEAR = 2025; // must match FEE_YEAR in app/actions/admin-meta.ts

// Predictor reference data (categories, universities, offering labels, cities)
// changes only on ingestion — cache it. Note: the data cache serializes to JSON,
// so anything cached must be a plain array/object (never a Map).
const PREDICTOR_REVALIDATE = 3600; // 1 hour

/** All colleges with their home-university name, for the directory. */
export async function listColleges() {
  const [cols, univs] = await Promise.all([
    collections
      .colleges()
      .find(
        { hidden: false },
        {
          projection: {
            name: 1, slug: 1, city: 1, district: 1, type: 1,
            homeUniversityId: 1,
          },
        }
      )
      .toArray(),
    collections.universities().find({}).toArray(),
  ]);
  const univById = new Map(univs.map((u) => [u._id, u]));
  return cols
    .map((c) => {
      const u = c.homeUniversityId ? univById.get(c.homeUniversityId) : null;
      return {
        id: c._id,
        name: c.name,
        slug: c.slug,
        city: c.city,
        district: c.district,
        type: c.type,
        university: u?.name ?? null,
        universityShort: u?.shortName ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCollegeBySlug(slug: string) {
  const c = await collections.colleges().findOne({ slug, hidden: false });
  if (!c) return null;
  return {
    id: c._id,
    dteCode: c.dteCode,
    name: c.name,
    slug: c.slug,
    city: c.city,
    district: c.district,
    type: c.type,
    isAutonomous: c.isAutonomous,
    aicteApproved: c.aicteApproved,
    naacGrade: c.naacGrade,
    naacCgpa: c.naacCgpa,
    naacValidUpto: c.naacValidUpto,
    naacSource: c.naacSource,
    avgFeeAnnual: c.avgFeeAnnual,
    website: c.website,
    homeUniversityId: c.homeUniversityId,
    university: c.homeUniversityName,
  };
}

/** Verified placements for a college, newest year first. */
export async function getCollegePlacements(collegeId: number) {
  const c = await collections
    .colleges()
    .findOne({ _id: collegeId }, { projection: { placements: 1 } });
  return (c?.placements ?? [])
    .filter((p) => p.verifiedAt != null)
    .sort((a, b) => b.year - a.year)
    .map((p) => ({
      year: p.year,
      avg: p.avgPackageLpa,
      median: p.medianPackageLpa,
      highest: p.highestPackageLpa,
      rate: p.placementRatePct,
      recruiters: p.topRecruiters,
      source: p.source,
    }));
}

/** Official PDFs for a college (placement reports, institutional-round cutoffs).
 * Admin-uploaded docs store an S3 key in `url`; resolve those to a short-lived
 * presigned URL. Legacy external http(s) URLs (seeded docs) pass through. */
export async function getCollegeDocuments(collegeId: number) {
  const c = await collections
    .colleges()
    .findOne({ _id: collegeId }, { projection: { documents: 1 } });
  const rows = (c?.documents ?? [])
    .slice()
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .map((d) => ({ docType: d.docType, year: d.year, title: d.title, url: d.url }));

  return Promise.all(
    rows.map(async (d) => ({
      ...d,
      url:
        s3Enabled && isS3Key(d.url)
          ? await signedGetUrl(d.url).catch(() => d.url)
          : d.url,
    }))
  );
}

/** Verified alumni for a college (with photo/company/role), newest batch first. */
export async function getCollegeAlumni(collegeId: number) {
  const c = await collections
    .colleges()
    .findOne({ _id: collegeId }, { projection: { alumni: 1 } });
  const rows = (c?.alumni ?? [])
    .filter((a) => a.verifiedAt != null)
    .sort(
      (a, b) => (b.batchYear ?? 0) - (a.batchYear ?? 0) || a.name.localeCompare(b.name)
    )
    .map((a) => ({
      name: a.name,
      achievement: a.achievement,
      company: a.company,
      role: a.role,
      batchYear: a.batchYear,
      linkedinUrl: a.linkedinUrl,
      photoUrl: a.photoUrl,
    }));

  return Promise.all(
    rows.map(async (a) => ({
      ...a,
      photoUrl:
        a.photoUrl && s3Enabled && isS3Key(a.photoUrl)
          ? await signedGetUrl(a.photoUrl).catch(() => null)
          : a.photoUrl,
    }))
  );
}

/** Latest NIRF Engineering ranking for a college (or null). */
export async function getCollegeNirf(collegeId: number) {
  const c = await collections
    .colleges()
    .findOne({ _id: collegeId }, { projection: { nirfRankings: 1 } });
  const rows = (c?.nirfRankings ?? []).slice().sort((a, b) => b.year - a.year);
  const row = rows[0];
  return row
    ? { year: row.year, rank: row.rank, band: row.band, score: row.score }
    : null;
}

/** Aggregate stats for a college's overview header. */
export async function getCollegeOverview(collegeId: number) {
  const [row] = await collections
    .offerings()
    .aggregate<{ branches: number; totalSeats: number }>([
      { $match: { collegeId } },
      {
        $group: {
          _id: null,
          branches: { $addToSet: "$branchId" },
          totalSeats: { $sum: { $ifNull: ["$totalIntake", 0] } },
        },
      },
      { $project: { _id: 0, branches: { $size: "$branches" }, totalSeats: 1 } },
    ])
    .toArray();
  return row ?? { branches: 0, totalSeats: 0 };
}

/** Branch offerings at a college with intake. */
export async function getCollegeBranches(collegeId: number) {
  const [offerings, branchDocs, college] = await Promise.all([
    collections.offerings().find({ collegeId }).toArray(),
    collections.branches().find({}).toArray(),
    collections
      .colleges()
      .findOne({ _id: collegeId }, { projection: { fees: 1 } }),
  ]);
  const branchById = new Map(branchDocs.map((b) => [b._id, b]));
  const feeFor = new Map<number, number | null>();
  for (const f of college?.fees ?? []) {
    if (f.year === FEE_YEAR && f.categoryGroup === "open")
      feeFor.set(f.collegeBranchId, f.annualTuition);
  }

  return offerings
    .map((o) => {
      const b = branchById.get(o.branchId);
      return {
        collegeBranchId: o._id,
        branchId: o.branchId,
        branchName: b?.name ?? o.branchName,
        branchSlug: b?.slug ?? "",
        degree: b?.degree ?? "",
        family: o.family,
        totalIntake: o.totalIntake,
        capSeats: o.capSeats,
        msSeats: o.msSeats,
        aiSeats: o.aiSeats,
        minoritySeats: o.minoritySeats,
        fee: feeFor.get(o._id) ?? null,
      };
    })
    .sort((a, b) => {
      // family asc (nulls last), then branchName asc — mirrors pg default order.
      if (a.family !== b.family) {
        if (a.family == null) return 1;
        if (b.family == null) return -1;
        return a.family.localeCompare(b.family);
      }
      return a.branchName.localeCompare(b.branchName);
    });
}

/** Verified cutoff rows for one offering, newest year first. */
export async function getCutoffsForOffering(collegeBranchId: number) {
  const [rows, cats] = await Promise.all([
    collections
      .cutoffs()
      .find({ collegeBranchId, verifiedAt: { $ne: null } })
      .toArray(),
    collections.categories().find({}).toArray(),
  ]);
  const labelByCode = new Map(cats.map((c) => [c.code, c.label]));
  return rows
    .map((r) => ({
      year: r.year,
      round: r.round,
      seatType: r.seatType,
      categoryCode: r.categoryCode,
      categoryLabel: labelByCode.get(r.categoryCode) ?? r.categoryCode,
      closingPercentile: r.closingPercentile,
    }))
    .sort((a, b) => b.year - a.year);
}

/**
 * Load all verified cutoff rows for a given year in predictor shape, grouped by
 * offering. This is the dataset the rules-based predictor runs over.
 */
export async function loadCutoffRowsForYear(
  year: number
): Promise<Map<number, CutoffRow[]>> {
  const rows = await collections
    .cutoffs()
    .find(
      { year, verifiedAt: { $ne: null } },
      {
        projection: {
          collegeBranchId: 1, collegeId: 1, collegeHomeUniversityId: 1,
          seatType: 1, categoryCode: 1, closingPercentile: 1,
        },
      }
    )
    .toArray();

  const byOffering = new Map<number, CutoffRow[]>();
  for (const r of rows) {
    const row: CutoffRow = {
      collegeBranchId: r.collegeBranchId,
      collegeId: r.collegeId as number,
      collegeHomeUniversityId: r.collegeHomeUniversityId,
      seatType: r.seatType as SeatType,
      categoryCode: r.categoryCode,
      closingPercentile:
        r.closingPercentile == null ? null : Number(r.closingPercentile),
    };
    const list = byOffering.get(r.collegeBranchId);
    if (list) list.push(row);
    else byOffering.set(r.collegeBranchId, [row]);
  }
  return byOffering;
}

/**
 * College-wide cutoff matrix for the latest year with data: one row per
 * (branch, category, seat type). The UI pivots this into category-rows ×
 * branch-columns with a seat-type toggle and branch filter.
 */
export async function getCollegeCutoffMatrix(collegeId: number) {
  const [rows, branchDocs, cats] = await Promise.all([
    collections
      .cutoffs()
      .find({ collegeId, verifiedAt: { $ne: null } })
      .toArray(),
    collections.branches().find({}).toArray(),
    collections.categories().find({}).toArray(),
  ]);
  if (rows.length === 0) return { year: null as number | null, rows: [] };

  const branchName = new Map(branchDocs.map((b) => [b._id, b.name]));
  const labelByCode = new Map(cats.map((c) => [c.code, c.label]));
  const latestYear = Math.max(...rows.map((r) => r.year));

  return {
    year: latestYear as number | null,
    rows: rows
      .filter((r) => r.year === latestYear)
      .map((r) => ({
        branchName: branchName.get(r.branchId) ?? "",
        branchFamily: r.family,
        categoryCode: r.categoryCode,
        categoryLabel: labelByCode.get(r.categoryCode) ?? r.categoryCode,
        categoryGroup: r.categoryGroup,
        seatType: r.seatType as string,
        closingPercentile:
          r.closingPercentile == null ? null : Number(r.closingPercentile),
        closingMeritNo: r.closingMeritNo,
      })),
  };
}

/** Distinct cities (with college counts) for the predictor location filter. */
export const getPredictorCities = cached(
  async () => {
    const rows = await collections
      .colleges()
      .aggregate<{ city: string; n: number }>([
        { $match: { city: { $ne: null } } },
        { $group: { _id: "$city", n: { $sum: 1 } } },
        { $project: { _id: 0, city: "$_id", n: 1 } },
        { $sort: { n: -1, city: 1 } },
      ])
      .toArray();
    return rows.filter((r) => r.city);
  },
  ["predictor-cities"],
  { revalidate: PREDICTOR_REVALIDATE }
);

/**
 * All verified cutoff rows across years, grouped by offering, in the shape the
 * trend-aware predictor consumes. Enables projecting next year's cutoff.
 */
export async function loadCutoffHistory(): Promise<Map<number, CutoffHistoryRow[]>> {
  const rows = await collections
    .cutoffs()
    .find(
      { verifiedAt: { $ne: null } },
      {
        projection: {
          collegeBranchId: 1, collegeId: 1, collegeHomeUniversityId: 1,
          seatType: 1, categoryCode: 1, year: 1, closingPercentile: 1,
        },
      }
    )
    .toArray();

  const byOffering = new Map<number, CutoffHistoryRow[]>();
  for (const r of rows) {
    const row: CutoffHistoryRow = {
      collegeBranchId: r.collegeBranchId,
      collegeId: r.collegeId as number,
      collegeHomeUniversityId: r.collegeHomeUniversityId,
      seatType: r.seatType as SeatType,
      categoryCode: r.categoryCode,
      year: r.year,
      closingPercentile:
        r.closingPercentile == null ? null : Number(r.closingPercentile),
    };
    const list = byOffering.get(r.collegeBranchId);
    if (list) list.push(row);
    else byOffering.set(r.collegeBranchId, [row]);
  }
  return byOffering;
}

/**
 * Cached raw arrays for the predictor form. Kept separate from getPredictorMeta
 * because the data cache can only store serializable values — the Map is built
 * from these arrays per-request (cheap) in getPredictorMeta below.
 */
const getPredictorMetaRaw = cached(
  async () => {
    const [cats, univs, offerings, cols] = await Promise.all([
      collections.categories().find({}).toArray(),
      collections.universities().find({}).toArray(),
      collections.offerings().find({}).toArray(),
      collections
        .colleges()
        .find({}, { projection: { slug: 1 } })
        .toArray(),
    ]);
    const slugById = new Map(cols.map((c) => [c._id, c.slug]));
    return {
      categories: cats.map((c) => ({
        id: c._id, code: c.code, label: c.label, group: c.group,
      })),
      universities: univs
        .map((u) => ({ id: u._id, name: u.name, shortName: u.shortName }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      offerings: offerings.map((o) => ({
        collegeBranchId: o._id,
        collegeName: o.collegeName,
        collegeSlug: slugById.get(o.collegeId) ?? "",
        city: o.city,
        branchName: o.branchName,
      })),
    };
  },
  ["predictor-meta"],
  { revalidate: PREDICTOR_REVALIDATE }
);

/** Lightweight lookups for predictor form + result rendering. */
export async function getPredictorMeta() {
  const { categories: cats, universities: univs, offerings } =
    await getPredictorMetaRaw();
  const offeringInfo = new Map(offerings.map((c) => [c.collegeBranchId, c]));
  return { categories: cats, universities: univs, offeringInfo };
}
