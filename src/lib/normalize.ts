/**
 * Normalization helpers for the loader: infer a college's home university and
 * city from its name, and classify a branch into a coarse family for filters.
 *
 * The cutoff PDFs name the home university for only ~106/389 colleges. Maharashtra
 * university jurisdiction follows the DISTRICT, and college names almost always
 * end with their town/district, so we infer the affiliating university from the
 * name for the remaining (non-autonomous) colleges. This is HEURISTIC — the exact
 * per-college crosswalk always takes precedence, and autonomous colleges (which
 * have only State-Level seats) are left unmapped by design.
 */

// Exact university strings as they appear in the DB (from the parsed PDFs).
const U = {
  MUMBAI: "Mumbai University",
  SPPU: "Savitribai Phule Pune University",
  NAGPUR: "Rashtrasant Tukadoji Maharaj Nagpur University",
  AMRAVATI: "Sant Gadge Baba Amravati University",
  BAMU: "Dr. Babasaheb Ambedkar Marathwada University",
  SRTMUN: "Swami Ramanand Teerth Marathwada University, Nanded",
  SHIVAJI: "Shivaji University",
  KBCNMU: "Kavayitri Bahinabai Chaudhari North Maharashtra University, Jalgaon",
  SOLAPUR: "Punyashlok Ahilyadevi Holkar Solapur University",
  GONDWANA: "Gondwana University",
} as const;

/**
 * District / city keyword -> university. Includes major towns and common
 * aliases that appear in college names. Keys are matched case-insensitively as
 * whole words against the college name (longer keys first).
 */
const PLACE_TO_UNIVERSITY: Record<string, string> = {
  // Mumbai University region
  mumbai: U.MUMBAI, thane: U.MUMBAI, palghar: U.MUMBAI, raigad: U.MUMBAI,
  ratnagiri: U.MUMBAI, sindhudurg: U.MUMBAI, "navi mumbai": U.MUMBAI,
  kalyan: U.MUMBAI, panvel: U.MUMBAI, kandivali: U.MUMBAI, malad: U.MUMBAI,
  andheri: U.MUMBAI, ambernath: U.MUMBAI, khalapur: U.MUMBAI, badlapur: U.MUMBAI,
  karjat: U.MUMBAI, vasai: U.MUMBAI, virar: U.MUMBAI, chiplun: U.MUMBAI,
  deorukh: U.MUMBAI, roha: U.MUMBAI, bhiwandi: U.MUMBAI, vangani: U.MUMBAI,
  sawantwadi: U.MUMBAI, dombivli: U.MUMBAI, ulhasnagar: U.MUMBAI, boisar: U.MUMBAI,
  // SPPU (Pune) region: Pune, Ahmednagar, Nashik
  pune: U.SPPU, ahmednagar: U.SPPU, nashik: U.SPPU, nasik: U.SPPU,
  wagholi: U.SPPU, talegaon: U.SPPU, lonavala: U.SPPU, chinchwad: U.SPPU,
  pimpri: U.SPPU, indapur: U.SPPU, baramati: U.SPPU, maval: U.SPPU,
  shirur: U.SPPU, sangamner: U.SPPU, trimbakeshwar: U.SPPU, sinnar: U.SPPU,
  // Nagpur region
  nagpur: U.NAGPUR, wardha: U.NAGPUR, bhandara: U.NAGPUR, dongargaon: U.NAGPUR,
  // Gondwana
  gadchiroli: U.GONDWANA, chandrapur: U.GONDWANA, gondia: U.GONDWANA,
  // Amravati region
  amravati: U.AMRAVATI, akola: U.AMRAVATI, yavatmal: U.AMRAVATI,
  buldhana: U.AMRAVATI, washim: U.AMRAVATI,
  // Aurangabad (Chhatrapati Sambhajinagar) region
  aurangabad: U.BAMU, "sambhajinagar": U.BAMU, jalna: U.BAMU, beed: U.BAMU,
  // Nanded region
  nanded: U.SRTMUN, latur: U.SRTMUN, parbhani: U.SRTMUN, hingoli: U.SRTMUN,
  // Shivaji (Kolhapur) region
  kolhapur: U.SHIVAJI, sangli: U.SHIVAJI, satara: U.SHIVAJI,
  ichalkaranji: U.SHIVAJI, jaysingpur: U.SHIVAJI, karad: U.SHIVAJI,
  miraj: U.SHIVAJI, warananagar: U.SHIVAJI, tasgaon: U.SHIVAJI,
  wathar: U.SHIVAJI, ashta: U.SHIVAJI,
  // North Maharashtra (Jalgaon)
  jalgaon: U.KBCNMU, dhule: U.KBCNMU, nandurbar: U.KBCNMU, shirpur: U.KBCNMU,
  // Solapur
  solapur: U.SOLAPUR, pandharpur: U.SOLAPUR, barshi: U.SOLAPUR,
};

const PLACE_KEYS = Object.keys(PLACE_TO_UNIVERSITY).sort(
  (a, b) => b.length - a.length
);

/** Infer the home university from a college name, or null if unrecognized. */
export function inferUniversity(collegeName: string): string | null {
  const n = collegeName.toLowerCase();
  // Prefer an explicit "Dist[.] Xxx" if present.
  const distMatch = n.match(/dist[.\s]+([a-z]+)/);
  if (distMatch && PLACE_TO_UNIVERSITY[distMatch[1]]) {
    return PLACE_TO_UNIVERSITY[distMatch[1]];
  }
  for (const key of PLACE_KEYS) {
    // whole-word match so "satara" doesn't hit inside another token
    const re = new RegExp(`(^|[^a-z])${key}([^a-z]|$)`, "i");
    if (re.test(n)) return PLACE_TO_UNIVERSITY[key];
  }
  return null;
}

/** Best-effort display city: the recognized place, else last name segment. */
export function extractCity(collegeName: string): string | null {
  const n = collegeName.toLowerCase();
  const distMatch = n.match(/dist[.\s]+([a-z]+)/);
  if (distMatch) return titleCase(distMatch[1]);
  for (const key of PLACE_KEYS) {
    const re = new RegExp(`(^|[^a-z])${key}([^a-z]|$)`, "i");
    if (re.test(n)) return titleCase(key);
  }
  // Fallback: last comma-separated segment, cleaned.
  const seg = collegeName.split(",").pop() ?? "";
  const cleaned = seg.replace(/[().]/g, "").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Coarse branch family for filtering (specific branch name is kept separately). */
export function branchFamily(name: string): string {
  const n = name.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => n.includes(w));
  if (has("computer", "information tech", "data sci", "artificial intel",
          "machine learning", "cyber", "iot", "internet of things",
          "business system", "5g", "vlsi design")) {
    return "Computer, IT & AI";
  }
  if (has("electronic", "telecommun", "communication", "vlsi", "instrument"))
    return "Electronics & Telecom";
  if (has("electrical")) return "Electrical";
  if (has("mechanical", "automobile", "mechatron", "robotic", "automation",
          "production", "manufacturing", "aeronaut", "mining", "metallurg"))
    return "Mechanical & Allied";
  if (has("civil", "structural", "environmental", "infrastructure"))
    return "Civil";
  if (has("chemical", "petro", "polymer", "plastic", "paint", "oil",
          "dyestuff", "surface coating", "pharma", "fine chemical"))
    return "Chemical & Allied";
  if (has("textile", "fibre", "fabric", "fashion")) return "Textile";
  if (has("bio", "food")) return "Bio & Food";
  return "Other";
}
