/**
 * Crosswalk from CETu branch families to job-market roles/categories. This is
 * the curated glue between admission branches and the open labour market: there
 * is no dataset that maps "Computer Engineering" directly to jobs, so we map each
 * family to an Adzuna job category + a representative role keyword. Pure data —
 * safe to import anywhere.
 */

export type RoleMapping = {
  category: string; // Adzuna India category tag
  what: string; // representative role keyword for salary/geodata queries
  label: string; // human-facing role label
};

const FAMILY_ROLES: Record<string, RoleMapping> = {
  "Computer, IT & AI": {
    category: "it-jobs",
    what: "software engineer",
    label: "Software & IT roles",
  },
  "Electronics & Telecom": {
    category: "engineering-jobs",
    what: "electronics engineer",
    label: "Electronics & embedded roles",
  },
  Electrical: {
    category: "engineering-jobs",
    what: "electrical engineer",
    label: "Electrical & power roles",
  },
  "Mechanical & Allied": {
    category: "engineering-jobs",
    what: "mechanical engineer",
    label: "Mechanical & design roles",
  },
  Civil: {
    category: "engineering-jobs",
    what: "civil engineer",
    label: "Civil & construction roles",
  },
  "Chemical & Allied": {
    category: "engineering-jobs",
    what: "chemical engineer",
    label: "Chemical & process roles",
  },
  Textile: {
    category: "engineering-jobs",
    what: "textile engineer",
    label: "Textile & manufacturing roles",
  },
  "Bio & Food": {
    category: "scientific-qa-jobs",
    what: "biotechnology",
    label: "Bio, food & QA roles",
  },
  Other: {
    category: "engineering-jobs",
    what: "engineer",
    label: "Engineering roles",
  },
};

export const FAMILY_LIST = Object.keys(FAMILY_ROLES);

export function roleForFamily(family: string | null | undefined): RoleMapping {
  return (family && FAMILY_ROLES[family]) || FAMILY_ROLES.Other;
}
