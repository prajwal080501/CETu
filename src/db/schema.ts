import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  numeric,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Maharashtra MHT-CET (Engineering / CAP) domain schema.
 *
 * Modeling notes specific to Maharashtra CAP that most competitors get wrong:
 *  - Seats and cutoffs are split by SEAT TYPE (Home University / Other Than Home
 *    University / State Level / All India / Minority / Institute), and this split
 *    materially changes what a given percentile can get. We model it explicitly.
 *  - Cutoffs are published per CAP ROUND (I / II / III) and per CATEGORY.
 *  - MHT-CET is percentile-based (0..100, up to 7 decimals in official data).
 */

// Seat type within CAP (a.k.a. seat "level").
export const seatTypeEnum = pgEnum("seat_type", [
  "HU", // Home University seats, Home University candidates
  "HU_OHU", // Home University seats allotted to Other-Than-HU candidates
  "OHU", // Other Than Home University
  "SL", // State Level
  "AI", // All India
  "MI", // Minority
  "INST", // Institute / Management quota
]);

// Institute governance/type.
export const collegeTypeEnum = pgEnum("college_type", [
  "government",
  "government_aided",
  "university_dept",
  "private_unaided",
  "autonomous",
  "deemed",
]);

// Reservation categories used in Maharashtra CAP allotment.
// (Ladies/PWD/Defence/Orphan variants exist as prefixes/suffixes in official
//  data; we store the raw published label in `category.code` to stay faithful.)
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  // e.g. "GOPEN", "LOPEN", "GSC", "GST", "GVJ", "GNT1", "GNT2", "GNT3",
  // "GOBC", "GSEBC", "EWS", "TFWS", "PWDOPEN", "DEFOPEN", "ORPHAN", "MI"
  code: varchar("code", { length: 24 }).notNull().unique(),
  label: text("label").notNull(),
  // Broad grouping for UI filters: open, sc, st, vjnt, obc, ews, tfws, special.
  group: varchar("group", { length: 16 }).notNull(),
});

export const universities = pgTable("universities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // Home University, e.g. "University of Mumbai"
  shortName: varchar("short_name", { length: 32 }),
});

export const colleges = pgTable(
  "colleges",
  {
    id: serial("id").primaryKey(),
    // Official DTE institute code, e.g. "01002" (COEP), used across CAP docs.
    dteCode: varchar("dte_code", { length: 12 }).notNull().unique(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    city: text("city"),
    district: text("district"),
    homeUniversityId: integer("home_university_id").references(
      () => universities.id
    ),
    type: collegeTypeEnum("type"),
    isAutonomous: boolean("is_autonomous").default(false),
    // AICTE approval is a prerequisite for DTE CAP participation, so true for all
    // colleges in this dataset.
    aicteApproved: boolean("aicte_approved").default(true),
    naacGrade: varchar("naac_grade", { length: 8 }),
    naacCgpa: numeric("naac_cgpa", { precision: 4, scale: 2 }),
    naacValidUpto: varchar("naac_valid_upto", { length: 24 }),
    naacSource: text("naac_source"), // provenance URL for the applied NAAC grade
    // Stable NIRF institute id (e.g. "IR-E-U-0306") for multi-year linkage.
    nirfInstituteId: varchar("nirf_institute_id", { length: 24 }),
    campusAcres: numeric("campus_acres", { precision: 8, scale: 2 }),
    establishedYear: integer("established_year"),
    website: text("website"),
    // Real (curated) average annual tuition in ₹, admin-entered. When set, shown
    // on the college page instead of the indicative fee band.
    avgFeeAnnual: integer("avg_fee_annual"),
    // Soft-hide (reversible): excluded from listings/search/pages when true. Used
    // to suppress a duplicate institute-code record (e.g. an old DTE code a
    // college superseded) without deleting the data.
    hidden: boolean("hidden").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("colleges_city_idx").on(t.city),
    index("colleges_home_univ_idx").on(t.homeUniversityId),
  ]
);

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // "Computer Engineering", "Information Technology", ...
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  degree: varchar("degree", { length: 16 }).default("BE").notNull(), // BE / BTech
  // Coarse grouping for filters, e.g. "Computer, IT & AI" (see lib/normalize).
  family: varchar("family", { length: 40 }),
});

/**
 * A branch offered at a college. Each such offering maps to one or more CAP
 * "choice codes" per year (choice codes drift year to year, so they live on the
 * year-scoped seat/cutoff rows, and we keep a canonical crosswalk here).
 */
export const collegeBranches = pgTable(
  "college_branches",
  {
    id: serial("id").primaryKey(),
    collegeId: integer("college_id")
      .references(() => colleges.id, { onDelete: "cascade" })
      .notNull(),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    totalIntake: integer("total_intake"), // sanctioned intake (from CAP allotment)
    // Aggregate seat breakdown from the CAP allotment header (no PII).
    capSeats: integer("cap_seats"),
    msSeats: integer("ms_seats"), // Maharashtra State
    minoritySeats: integer("minority_seats"),
    aiSeats: integer("ai_seats"), // All India
    isNbaAccredited: boolean("is_nba_accredited").default(false),
  },
  (t) => [
    uniqueIndex("college_branch_uq").on(t.collegeId, t.branchId),
    index("college_branch_college_idx").on(t.collegeId),
  ]
);

/**
 * Category- and seat-type-wise seat matrix, per CAP round per year.
 * (Vacancy reports also fit here by round.)
 */
export const seatMatrix = pgTable(
  "seat_matrix",
  {
    id: serial("id").primaryKey(),
    collegeBranchId: integer("college_branch_id")
      .references(() => collegeBranches.id, { onDelete: "cascade" })
      .notNull(),
    year: integer("year").notNull(),
    round: integer("round").notNull(), // 1, 2, 3
    seatType: seatTypeEnum("seat_type").notNull(),
    categoryId: integer("category_id")
      .references(() => categories.id)
      .notNull(),
    choiceCode: varchar("choice_code", { length: 24 }),
    seats: integer("seats").notNull(),
    sourceDocumentId: integer("source_document_id").references(
      () => sourceDocuments.id
    ),
  },
  (t) => [
    index("seat_matrix_cb_idx").on(t.collegeBranchId),
    uniqueIndex("seat_matrix_uq").on(
      t.collegeBranchId,
      t.year,
      t.round,
      t.seatType,
      t.categoryId
    ),
  ]
);

/**
 * Published closing cutoff per (offering, year, round, seat type, category).
 * Percentile is the primary MHT-CET metric; merit number is secondary.
 */
export const cutoffs = pgTable(
  "cutoffs",
  {
    id: serial("id").primaryKey(),
    collegeBranchId: integer("college_branch_id")
      .references(() => collegeBranches.id, { onDelete: "cascade" })
      .notNull(),
    year: integer("year").notNull(),
    round: integer("round").notNull(),
    seatType: seatTypeEnum("seat_type").notNull(),
    categoryId: integer("category_id")
      .references(() => categories.id)
      .notNull(),
    choiceCode: varchar("choice_code", { length: 24 }),
    closingPercentile: numeric("closing_percentile", { precision: 10, scale: 7 }),
    closingMeritNo: integer("closing_merit_no"),
    sourceDocumentId: integer("source_document_id").references(
      () => sourceDocuments.id
    ),
    // Trust gate: only rows with verifiedAt set are shown in production.
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("cutoffs_cb_idx").on(t.collegeBranchId),
    index("cutoffs_lookup_idx").on(
      t.year,
      t.round,
      t.seatType,
      t.categoryId
    ),
    uniqueIndex("cutoffs_uq").on(
      t.collegeBranchId,
      t.year,
      t.round,
      t.seatType,
      t.categoryId
    ),
  ]
);

export const placements = pgTable("placements", {
  id: serial("id").primaryKey(),
  collegeId: integer("college_id")
    .references(() => colleges.id, { onDelete: "cascade" })
    .notNull(),
  year: integer("year").notNull(),
  avgPackageLpa: numeric("avg_package_lpa", { precision: 6, scale: 2 }),
  medianPackageLpa: numeric("median_package_lpa", { precision: 6, scale: 2 }),
  highestPackageLpa: numeric("highest_package_lpa", { precision: 8, scale: 2 }),
  placementRatePct: numeric("placement_rate_pct", { precision: 5, scale: 2 }),
  topRecruiters: text("top_recruiters"), // comma-separated for MVP
  source: text("source"),
  // Only rows with verifiedAt set render publicly. contributedBy = Clerk user id
  // for crowdsourced submissions (curated seed rows are pre-verified).
  verifiedAt: timestamp("verified_at"),
  contributedBy: text("contributed_by"),
});

/**
 * Links to a college's own official PDFs (placement reports, institute-level /
 * SPOT round cutoffs, brochures). We store the source URL (not a rehosted copy)
 * so the frontend links to the authoritative document on the college's site.
 */
export const collegeDocuments = pgTable(
  "college_documents",
  {
    id: serial("id").primaryKey(),
    collegeId: integer("college_id")
      .references(() => colleges.id, { onDelete: "cascade" })
      .notNull(),
    docType: varchar("doc_type", { length: 20 }).notNull(), // placement | institutional | cutoff | brochure | other
    year: integer("year"),
    title: text("title").notNull(),
    url: text("url").notNull(), // official PDF URL on the college's domain
    sourcePage: text("source_page"), // page the PDF was linked from
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("college_documents_college_idx").on(t.collegeId)]
);

/**
 * Official third-party rankings. NIRF Engineering, year-wise, so we can show a
 * multi-year trend. Institute id links a college across years.
 */
export const nirfRankings = pgTable(
  "nirf_rankings",
  {
    id: serial("id").primaryKey(),
    collegeId: integer("college_id")
      .references(() => colleges.id, { onDelete: "cascade" })
      .notNull(),
    year: integer("year").notNull(),
    rank: integer("rank"), // null when only a rank-band is published
    band: varchar("band", { length: 16 }), // e.g. "201-300"
    score: numeric("score", { precision: 6, scale: 2 }),
    nirfInstituteId: varchar("nirf_institute_id", { length: 24 }),
  },
  (t) => [uniqueIndex("nirf_college_year_uq").on(t.collegeId, t.year)]
);

/**
 * Cached AI-generated insight for a college, produced by Gemini and grounded on
 * the college's own structured DB data (cutoffs / seats / NIRF / placements).
 * Cached so we don't re-call the model on every page view; `dataHash` lets us
 * invalidate when the underlying facts change. Content is structured JSON.
 */
export const aiInsights = pgTable(
  "ai_insights",
  {
    id: serial("id").primaryKey(),
    collegeId: integer("college_id")
      .references(() => colleges.id, { onDelete: "cascade" })
      .notNull(),
    model: varchar("model", { length: 48 }).notNull(),
    // Hash of the grounding facts fed to the model; regenerate when it changes.
    dataHash: varchar("data_hash", { length: 64 }).notNull(),
    content: jsonb("content").notNull(), // { summary, strengths[], considerations[], bestFor }
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("ai_insights_college_uq").on(t.collegeId)]
);

/**
 * Cached live job-market data (Adzuna) keyed by branch family + kind
 * ('geo' = per-region median salary heatmap, 'histogram' = salary distribution,
 * 'summary' = Maharashtra-wide median + job count). Cached so we don't hit the
 * free-tier API on every page view; refreshed on a cadence. `payload` holds the
 * normalized shape the UI renders.
 */
export const jobMarket = pgTable(
  "job_market",
  {
    id: serial("id").primaryKey(),
    family: varchar("family", { length: 40 }).notNull(),
    kind: varchar("kind", { length: 16 }).notNull(), // geo | histogram | summary
    payload: jsonb("payload").notNull(),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("job_market_uq").on(t.family, t.kind)]
);

/**
 * Cached top employers per city (Adzuna top_companies), keyed by city + scope
 * (a branch family, or 'all'). `payload` holds the current leaderboard plus a
 * small dated history so the city page can show how hiring shifts over time.
 */
export const cityEmployers = pgTable(
  "city_employers",
  {
    id: serial("id").primaryKey(),
    city: varchar("city", { length: 80 }).notNull(),
    scope: varchar("scope", { length: 40 }).notNull().default("all"),
    payload: jsonb("payload").notNull(),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("city_employers_uq").on(t.city, t.scope)]
);

/**
 * Crowdsourced NAAC grade submissions awaiting moderation. NAAC grades have no
 * clean bulk source, so signed-in users submit grade + CGPA + an official source
 * link; a moderator approves, which applies it to the college and deletes the
 * pending row. Never fabricated — only verified, sourced grades render.
 */
export const naacSubmissions = pgTable(
  "naac_submissions",
  {
    id: serial("id").primaryKey(),
    collegeId: integer("college_id")
      .references(() => colleges.id, { onDelete: "cascade" })
      .notNull(),
    grade: varchar("grade", { length: 8 }).notNull(),
    cgpa: numeric("cgpa", { precision: 4, scale: 2 }),
    validUpto: varchar("valid_upto", { length: 24 }),
    source: text("source"),
    contributedBy: text("contributed_by").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("naac_submissions_college_idx").on(t.collegeId)]
);

export const fees = pgTable(
  "fees",
  {
    id: serial("id").primaryKey(),
    collegeBranchId: integer("college_branch_id")
      .references(() => collegeBranches.id, { onDelete: "cascade" })
      .notNull(),
    year: integer("year").notNull(),
    // category grouping this fee applies to (open vs TFWS vs reserved), free text for MVP
    categoryGroup: varchar("category_group", { length: 16 }).default("open"),
    annualTuition: integer("annual_tuition"),
    source: text("source"),
  },
  (t) => [uniqueIndex("fees_branch_year_group_uq").on(t.collegeBranchId, t.year, t.categoryGroup)]
);

export const alumni = pgTable("alumni", {
  id: serial("id").primaryKey(),
  collegeId: integer("college_id")
    .references(() => colleges.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  achievement: text("achievement"),
  company: text("company"),
  role: text("role"),
  batchYear: integer("batch_year"),
  linkedinUrl: text("linkedin_url"),
  photoUrl: text("photo_url"), // S3 key for the alumnus photo
  isVerified: boolean("is_verified").default(false),
  verifiedAt: timestamp("verified_at"),
  contributedBy: text("contributed_by"),
});

/**
 * Provenance for every ingested official PDF. Immutable raw archive record.
 */
/**
 * A signed-in user's CAP preference list. One row per user; the ordered choices
 * are stored as JSON (same shape the client builds). Keyed by Clerk user id.
 * Anonymous users keep their list in localStorage instead.
 */
export const preferenceLists = pgTable("preference_lists", {
  userId: text("user_id").primaryKey(),
  items: jsonb("items").notNull().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Community discussion threads, scoped by branch / city / general. Only
 * signed-in users create threads or replies (authorId = Clerk user id).
 */
export const threads = pgTable(
  "threads",
  {
    id: serial("id").primaryKey(),
    scopeType: varchar("scope_type", { length: 16 }).notNull(), // branch | city | general
    scopeValue: varchar("scope_value", { length: 120 }).default("").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    authorId: text("author_id").notNull(),
    authorName: text("author_name"),
    replyCount: integer("reply_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  },
  (t) => [
    index("threads_scope_idx").on(t.scopeType, t.scopeValue),
    index("threads_activity_idx").on(t.lastActivityAt),
  ]
);

export const threadReplies = pgTable(
  "thread_replies",
  {
    id: serial("id").primaryKey(),
    threadId: integer("thread_id")
      .references(() => threads.id, { onDelete: "cascade" })
      .notNull(),
    body: text("body").notNull(),
    authorId: text("author_id").notNull(),
    authorName: text("author_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("thread_replies_thread_idx").on(t.threadId)]
);

export const sourceDocuments = pgTable("source_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  sourceUrl: text("source_url").notNull(),
  year: integer("year").notNull(),
  round: integer("round"),
  docType: varchar("doc_type", { length: 24 }).notNull(), // cutoff | seat_matrix | vacancy | brochure
  sha256: varchar("sha256", { length: 64 }),
  storagePath: text("storage_path"), // object storage key for the raw PDF
  ingestedAt: timestamp("ingested_at").defaultNow().notNull(),
});

// --- Relations -------------------------------------------------------------

export const collegesRelations = relations(colleges, ({ one, many }) => ({
  homeUniversity: one(universities, {
    fields: [colleges.homeUniversityId],
    references: [universities.id],
  }),
  collegeBranches: many(collegeBranches),
  placements: many(placements),
  alumni: many(alumni),
}));

export const collegeBranchesRelations = relations(
  collegeBranches,
  ({ one, many }) => ({
    college: one(colleges, {
      fields: [collegeBranches.collegeId],
      references: [colleges.id],
    }),
    branch: one(branches, {
      fields: [collegeBranches.branchId],
      references: [branches.id],
    }),
    cutoffs: many(cutoffs),
    seatMatrix: many(seatMatrix),
    fees: many(fees),
  })
);

export const cutoffsRelations = relations(cutoffs, ({ one }) => ({
  collegeBranch: one(collegeBranches, {
    fields: [cutoffs.collegeBranchId],
    references: [collegeBranches.id],
  }),
  category: one(categories, {
    fields: [cutoffs.categoryId],
    references: [categories.id],
  }),
}));
