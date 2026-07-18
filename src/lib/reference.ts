/**
 * Static reference data for Maharashtra MHT-CET CAP (Engineering).
 * Used to seed the DB and to drive filter UIs.
 */

export type SeatType = "HU" | "HU_OHU" | "OHU" | "SL" | "AI" | "MI" | "INST";

export const SEAT_TYPE_LABELS: Record<SeatType, string> = {
  HU: "Home University",
  HU_OHU: "Home Univ. seats (to other-than-home)",
  OHU: "Other Than Home University",
  SL: "State Level",
  AI: "All India",
  MI: "Minority",
  INST: "Institute Quota",
};

/**
 * Category catalogue. `group` drives coarse UI filters; `code` is the exact
 * label used in official CAP cutoff documents (kept faithful for matching).
 */
export const CATEGORIES: {
  code: string;
  label: string;
  group: string;
}[] = [
  { code: "GOPEN", label: "General / Open", group: "open" },
  { code: "LOPEN", label: "Ladies Open", group: "open" },
  { code: "EWS", label: "Economically Weaker Section", group: "ews" },
  { code: "TFWS", label: "Tuition Fee Waiver Scheme", group: "tfws" },
  { code: "GSC", label: "Scheduled Caste", group: "sc" },
  { code: "GST", label: "Scheduled Tribe", group: "st" },
  { code: "GVJ", label: "VJ / DT (Vimukta Jati)", group: "vjnt" },
  { code: "GNT1", label: "NT-B (Nomadic Tribe B)", group: "vjnt" },
  { code: "GNT2", label: "NT-C (Nomadic Tribe C)", group: "vjnt" },
  { code: "GNT3", label: "NT-D (Nomadic Tribe D)", group: "vjnt" },
  { code: "GOBC", label: "Other Backward Class", group: "obc" },
  { code: "GSEBC", label: "Socially & Educationally Backward Class", group: "obc" },
  { code: "PWDOPEN", label: "Persons With Disability (Open)", group: "special" },
  { code: "DEFOPEN", label: "Defence (Open)", group: "special" },
  { code: "ORPHAN", label: "Orphan", group: "special" },
  { code: "MI", label: "Minority", group: "special" },
];

/** Common Maharashtra Home Universities relevant to engineering CAP. */
export const UNIVERSITIES: { name: string; shortName: string }[] = [
  { name: "University of Mumbai", shortName: "MU" },
  { name: "Savitribai Phule Pune University", shortName: "SPPU" },
  { name: "Dr. Babasaheb Ambedkar Marathwada University", shortName: "BAMU" },
  { name: "Rashtrasant Tukadoji Maharaj Nagpur University", shortName: "RTMNU" },
  { name: "Shivaji University, Kolhapur", shortName: "SUK" },
  { name: "Sant Gadge Baba Amravati University", shortName: "SGBAU" },
  { name: "Swami Ramanand Teerth Marathwada University", shortName: "SRTMUN" },
  { name: "Kavayitri Bahinabai Chaudhari North Maharashtra University", shortName: "KBCNMU" },
  { name: "Punyashlok Ahilyadevi Holkar Solapur University", shortName: "PAHSU" },
  { name: "Gondwana University", shortName: "GU" },
];

/** Core engineering branches for MVP. */
export const BRANCHES: { name: string; slug: string; degree: string }[] = [
  { name: "Computer Engineering", slug: "computer-engineering", degree: "BE" },
  { name: "Computer Science and Engineering", slug: "cse", degree: "BTech" },
  { name: "Information Technology", slug: "information-technology", degree: "BE" },
  {
    name: "Artificial Intelligence and Data Science",
    slug: "ai-and-data-science",
    degree: "BE",
  },
  { name: "Electronics and Telecommunication Engineering", slug: "entc", degree: "BE" },
  { name: "Electrical Engineering", slug: "electrical-engineering", degree: "BE" },
  { name: "Mechanical Engineering", slug: "mechanical-engineering", degree: "BE" },
  { name: "Civil Engineering", slug: "civil-engineering", degree: "BE" },
  { name: "Chemical Engineering", slug: "chemical-engineering", degree: "BE" },
];
