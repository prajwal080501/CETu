import { col } from "./mongo";

/**
 * MongoDB document shapes for CETu. These replace the Drizzle-inferred types.
 *
 * Conventions:
 *  - `_id` reuses the old Postgres integer id (number) for every entity that was
 *    referenced by a numeric FK, so cross-references port 1:1. The one exception
 *    is `preferenceLists`, already keyed by the Clerk user id (string).
 *  - Small per-college tables (placements, nirf, fees, alumni, documents) are
 *    EMBEDDED in the college doc — always read with it, never queried across
 *    colleges.
 *  - `cutoffs` and `seatMatrix` stay FLAT collections with denormalized
 *    college/branch/category fields, because they're filtered across all
 *    colleges (predictor, rankings).
 *
 * Seat types: HU | HU_OHU | OHU | SL | AI | MI | INST
 */

export type SeatType = "HU" | "HU_OHU" | "OHU" | "SL" | "AI" | "MI" | "INST";
export type CollegeType =
  | "government"
  | "government_aided"
  | "university_dept"
  | "private_unaided"
  | "autonomous"
  | "deemed";

// --- Reference collections -------------------------------------------------

export interface CategoryDoc {
  _id: number;
  code: string; // "GOPEN", "LOPEN", ...
  label: string;
  group: string; // open | sc | st | vjnt | obc | ews | tfws | special
}

export interface UniversityDoc {
  _id: number;
  name: string;
  shortName: string | null;
}

export interface BranchDoc {
  _id: number;
  name: string;
  slug: string;
  degree: string; // BE | BTech
  family: string | null;
}

// --- Embedded sub-shapes (inside CollegeDoc) -------------------------------

export interface PlacementEmbed {
  id: number;
  year: number;
  avgPackageLpa: number | null;
  medianPackageLpa: number | null;
  highestPackageLpa: number | null;
  placementRatePct: number | null;
  topRecruiters: string | null;
  source: string | null;
  verifiedAt: Date | null;
  contributedBy: string | null;
}

export interface NirfEmbed {
  id: number;
  year: number;
  rank: number | null;
  band: string | null;
  score: number | null;
  nirfInstituteId: string | null;
}

export interface FeeEmbed {
  id: number;
  collegeBranchId: number;
  year: number;
  categoryGroup: string; // open | tfws | reserved
  annualTuition: number | null;
  source: string | null;
}

export interface AlumnusEmbed {
  id: number;
  name: string;
  achievement: string | null;
  company: string | null;
  role: string | null;
  batchYear: number | null;
  linkedinUrl: string | null;
  photoUrl: string | null; // S3 key
  isVerified: boolean;
  verifiedAt: Date | null;
  contributedBy: string | null;
}

export interface CollegeDocumentEmbed {
  id: number;
  docType: string; // placement | institutional | cutoff | brochure | other
  year: number | null;
  title: string;
  url: string; // official PDF URL or S3 key
  sourcePage: string | null;
  createdAt: Date;
}

// --- Core collections ------------------------------------------------------

export interface CollegeDoc {
  _id: number;
  dteCode: string;
  name: string;
  slug: string;
  city: string | null;
  district: string | null;
  homeUniversityId: number | null;
  homeUniversityName: string | null; // denormalized for convenience
  type: CollegeType | null;
  isAutonomous: boolean;
  aicteApproved: boolean;
  naacGrade: string | null;
  naacCgpa: number | null;
  naacValidUpto: string | null;
  naacSource: string | null;
  nirfInstituteId: string | null;
  campusAcres: number | null;
  establishedYear: number | null;
  website: string | null;
  avgFeeAnnual: number | null;
  hidden: boolean;
  createdAt: Date;
  // Embedded per-college data:
  placements: PlacementEmbed[];
  nirfRankings: NirfEmbed[];
  fees: FeeEmbed[];
  alumni: AlumnusEmbed[];
  documents: CollegeDocumentEmbed[];
}

/** A branch offered at a college (was `college_branches`). Denormalized. */
export interface OfferingDoc {
  _id: number;
  collegeId: number;
  collegeName: string;
  city: string | null;
  branchId: number;
  branchName: string;
  family: string | null;
  totalIntake: number | null;
  capSeats: number | null;
  msSeats: number | null;
  minoritySeats: number | null;
  aiSeats: number | null;
  isNbaAccredited: boolean;
}

/** Published closing cutoff — flat + denormalized (65k docs, the workhorse). */
export interface CutoffDoc {
  _id: number;
  collegeBranchId: number;
  collegeId: number;
  collegeHomeUniversityId: number | null;
  branchId: number;
  family: string | null;
  city: string | null;
  year: number;
  round: number;
  seatType: SeatType;
  categoryId: number;
  categoryCode: string; // denormalized (GOPEN, ...)
  categoryGroup: string; // denormalized (open, ...)
  choiceCode: string | null;
  closingPercentile: number | null; // double
  closingMeritNo: number | null;
  sourceDocumentId: number | null;
  verifiedAt: Date | null; // trust gate: only non-null render in prod
  createdAt: Date;
}

export interface SeatMatrixDoc {
  _id: number;
  collegeBranchId: number;
  collegeId: number;
  year: number;
  round: number;
  seatType: SeatType;
  categoryId: number;
  categoryCode: string;
  choiceCode: string | null;
  seats: number;
  sourceDocumentId: number | null;
}

export interface SourceDocumentDoc {
  _id: number;
  title: string;
  sourceUrl: string;
  year: number;
  round: number | null;
  docType: string; // cutoff | seat_matrix | vacancy | brochure
  sha256: string | null;
  storagePath: string | null;
  ingestedAt: Date;
}

// --- Caches ----------------------------------------------------------------

export interface AiInsightDoc {
  _id: number;
  collegeId: number;
  model: string;
  dataHash: string;
  content: unknown; // { summary, strengths[], considerations[], bestFor }
  createdAt: Date;
}

export interface JobMarketDoc {
  _id: number;
  family: string;
  kind: string; // geo | histogram | summary
  payload: unknown;
  fetchedAt: Date;
}

export interface CityEmployerDoc {
  _id: number;
  city: string;
  scope: string; // family | "all"
  payload: unknown;
  fetchedAt: Date;
}

// --- Community / user ------------------------------------------------------

export interface NaacSubmissionDoc {
  _id: number;
  collegeId: number;
  grade: string;
  cgpa: number | null;
  validUpto: string | null;
  source: string | null;
  contributedBy: string;
  createdAt: Date;
}

export interface PreferenceListDoc {
  _id: string; // Clerk user id
  items: unknown[];
  updatedAt: Date;
}

export interface ThreadDoc {
  _id: number;
  scopeType: string; // branch | city | general
  scopeValue: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string | null;
  replyCount: number;
  createdAt: Date;
  lastActivityAt: Date;
}

export interface ThreadReplyDoc {
  _id: number;
  threadId: number;
  body: string;
  authorId: string;
  authorName: string | null;
  createdAt: Date;
}

// --- Typed accessors -------------------------------------------------------

export const collections = {
  categories: () => col<CategoryDoc>("categories"),
  universities: () => col<UniversityDoc>("universities"),
  branches: () => col<BranchDoc>("branches"),
  colleges: () => col<CollegeDoc>("colleges"),
  offerings: () => col<OfferingDoc>("offerings"),
  cutoffs: () => col<CutoffDoc>("cutoffs"),
  seatMatrix: () => col<SeatMatrixDoc>("seatMatrix"),
  sourceDocuments: () => col<SourceDocumentDoc>("sourceDocuments"),
  aiInsights: () => col<AiInsightDoc>("aiInsights"),
  jobMarket: () => col<JobMarketDoc>("jobMarket"),
  cityEmployers: () => col<CityEmployerDoc>("cityEmployers"),
  naacSubmissions: () => col<NaacSubmissionDoc>("naacSubmissions"),
  preferenceLists: () => col<PreferenceListDoc>("preferenceLists"),
  threads: () => col<ThreadDoc>("threads"),
  threadReplies: () => col<ThreadReplyDoc>("threadReplies"),
} as const;
