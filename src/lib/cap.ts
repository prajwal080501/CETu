/**
 * MHT-CET CAP (Centralized Admission Process) workflow + document checklist.
 *
 * Reference data compiled from the CAP process and official/reliable admission
 * guides — the authoritative source is the official Information Brochure on
 * cetcell.mahacet.org, which the UI links and tells students to verify against.
 * Plain config so it's easy to edit; workflow stages link to schedule milestones
 * (see src/lib/schedule.ts) for live dates.
 */

export interface CapStage {
  key: string;
  title: string;
  what: string;
  where?: string;
  /** Links to a milestone in schedule.ts for its live date/status. */
  scheduleKey?: string;
}

export const CAP_STAGES: CapStage[] = [
  {
    key: "register",
    title: "Register & apply",
    what: "Fill the CAP application, upload your documents, choose E-Scrutiny (online) or Physical (Facilitation Centre) verification, and pay the fee.",
    where: "cetcell.mahacet.org",
    scheduleKey: "registration",
  },
  {
    key: "verify",
    title: "Document verification",
    what: "Get your original documents verified — online via E-Scrutiny or in person at a Facilitation Centre.",
    scheduleKey: "registration",
  },
  {
    key: "merit",
    title: "Merit list",
    what: "Check your provisional merit number, raise a grievance if anything is wrong, then confirm your final merit number.",
    scheduleKey: "final-merit",
  },
  {
    key: "options",
    title: "Fill the option form",
    what: "Lock 1–300 college-branch preferences for the round — most-wanted first. Build this list in Make My List, then enter it here.",
    scheduleKey: "cap1-options",
  },
  {
    key: "allotment",
    title: "Seat allotment",
    what: "Check your provisional seat allotment for the round.",
    scheduleKey: "cap1-allot",
  },
  {
    key: "accept",
    title: "Accept your seat",
    what: "Accept & Freeze (keep the seat and exit further rounds) or Accept & Float (keep it but try for a better seat next round). Pay the seat-acceptance fee.",
  },
  {
    key: "report",
    title: "Report to the college",
    what: "Report to your allotted institute with all original documents before the reporting deadline.",
  },
  {
    key: "next",
    title: "Next rounds / SPOT",
    what: "If you floated or went unallotted, repeat for CAP Round 2, 3, then the Institute-level / SPOT rounds.",
    scheduleKey: "cap2",
  },
];

export interface CapDoc {
  key: string;
  label: string;
  note?: string;
}

/** Needed by every candidate. */
export const CAP_DOCS_MANDATORY: CapDoc[] = [
  { key: "cet-score", label: "MHT-CET 2026 scorecard" },
  { key: "hsc", label: "Class 12 (HSC) marksheet" },
  { key: "ssc", label: "Class 10 (SSC) marksheet" },
  { key: "hsc-pass", label: "Class 12 passing certificate" },
  { key: "domicile", label: "Maharashtra domicile certificate", note: "From Tehsildar or above" },
  { key: "nationality", label: "Nationality proof", note: "Birth certificate / passport / leaving certificate" },
  { key: "photo-id", label: "Photo ID", note: "Aadhaar preferred" },
  { key: "photos", label: "6–8 passport-size photographs" },
  { key: "lc", label: "School leaving certificate" },
];

interface CapExtraDoc extends CapDoc {
  applies: (categoryCode: string) => boolean;
}

const core = (code: string) => code.replace(/^[GL]/, "");
const isReserved = (code: string) => /^(SC|ST|VJ|NT|OBC|SEBC)/.test(core(code));
const needsNCL = (code: string) => /^(OBC|SEBC|VJ|NT)/.test(core(code));

const EXTRA_DOCS: CapExtraDoc[] = [
  { key: "caste", label: "Caste certificate", note: "From a Maharashtra competent authority", applies: isReserved },
  { key: "caste-validity", label: "Caste validity certificate", note: "If already issued", applies: isReserved },
  { key: "ncl", label: "Non-Creamy-Layer (NCL) certificate", note: "Current year — OBC / SEBC / VJNT", applies: needsNCL },
  { key: "ews", label: "EWS income & asset certificate", note: "Current year", applies: (c) => c === "EWS" },
  { key: "tfws", label: "Family income certificate (below ₹8 lakh)", note: "For TFWS seats", applies: (c) => c === "TFWS" },
  { key: "minority", label: "Minority community certificate", applies: (c) => core(c) === "MI" || c === "MI" },
  { key: "orphan", label: "Orphan certificate", note: "District Women & Child Development officer", applies: (c) => c.includes("ORPHAN") },
  { key: "pwd", label: "Disability certificate", note: "Civil Surgeon / Medical Board", applies: (c) => c.includes("PWD") },
  { key: "defence", label: "Defence / ex-servicemen certificate", applies: (c) => c.includes("DEF") },
];

/** Category/quota-specific documents for the chosen category. */
export function extraDocsFor(categoryCode: string): CapDoc[] {
  return EXTRA_DOCS.filter((d) => d.applies(categoryCode)).map(({ key, label, note }) => ({
    key,
    label,
    note,
  }));
}
