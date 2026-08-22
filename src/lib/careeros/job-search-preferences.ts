import type { JobSearchPreferences } from "./job-discovery.types";
import type { CareerProfile, CareerProfileItem } from "./types";

const USER_OVERRIDE_FIELDS = [
  "exactTitles",
  "adjacentTitles",
  "seniority",
  "industries",
  "locations",
  "salaryMin",
  "salaryCurrency",
  "workplaceTypes",
  "employmentTypes",
  "includeUk",
  "includeGlobalUkHireable",
  "includeRelocationSponsorship",
  "emailAlertsEnabled",
] as const satisfies readonly (keyof JobSearchPreferences)[];

function unique(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw?.trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function adjacentForTitle(title: string) {
  const lower = title.toLowerCase();
  const adjacent: string[] = [];

  if (lower.includes("product")) {
    adjacent.push("Product Owner", "Product Lead", "Product Marketing Manager");
  }
  if (lower.includes("programme") || lower.includes("program")) {
    adjacent.push("Delivery Manager", "Project Manager", "Transformation Programme Manager");
  }
  if (lower.includes("project")) {
    adjacent.push("Programme Manager", "Delivery Manager");
  }
  if (lower.includes("marketing")) {
    adjacent.push(
      "Product Marketing Manager",
      "Marketing Strategy Manager",
      "Growth Marketing Manager",
    );
  }
  if (lower.includes("consult")) {
    adjacent.push("Technology Consultant", "Digital Transformation Consultant");
  }
  if (lower.includes("delivery")) {
    adjacent.push("Programme Manager", "Project Manager");
  }

  return adjacent;
}

function inferSeniority(titles: string[], headline: string) {
  const corpus = [...titles, headline].join(" ").toLowerCase();
  const values: string[] = [];
  if (/\b(chief|vice president|vp|director|head)\b/.test(corpus)) values.push("Director / Head");
  if (/\b(principal|lead|senior)\b/.test(corpus)) values.push("Senior");
  if (/\bmanager\b/.test(corpus)) values.push("Manager");
  return values.length ? unique(values) : ["Experienced"];
}

function approvedProfileDomains(items: CareerProfileItem[]) {
  return items
    .filter((item) => item.status === "Approved" && item.kind === "Domain")
    .map((item) => item.safeWording ?? item.value ?? item.label);
}

export function deriveJobSearchPreferences(input: {
  userId: string;
  profile: CareerProfile;
  profileItems?: CareerProfileItem[];
  now?: Date;
}): JobSearchPreferences {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const exactTitles = unique(input.profile.employment.map((role) => role.title)).slice(0, 6);
  const exactTitleKeys = new Set(exactTitles.map((title) => title.toLowerCase()));
  const adjacentTitles = unique(exactTitles.flatMap(adjacentForTitle)).filter(
    (title) => !exactTitleKeys.has(title.toLowerCase()),
  );
  const industries = unique([
    ...input.profile.domains,
    ...approvedProfileDomains(input.profileItems ?? []),
  ]);
  const locations = unique([input.profile.location]);

  return {
    userId: input.userId,
    exactTitles,
    adjacentTitles,
    seniority: inferSeniority(exactTitles, input.profile.headline),
    industries,
    locations,
    salaryMin: null,
    salaryCurrency: "GBP",
    workplaceTypes: ["Remote", "Hybrid", "On-site"],
    employmentTypes: ["Permanent", "Contract", "Fixed-term"],
    includeUk: true,
    includeGlobalUkHireable: true,
    includeRelocationSponsorship: true,
    emailAlertsEnabled: true,
    derivedFromProfileAt: timestamp,
    manualOverrides: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function mergePreferenceOverrides(
  derived: JobSearchPreferences,
  stored: JobSearchPreferences | null | undefined,
): JobSearchPreferences {
  if (!stored) return derived;

  const result: JobSearchPreferences = {
    ...derived,
    manualOverrides: { ...stored.manualOverrides },
    createdAt: stored.createdAt,
  };

  for (const field of USER_OVERRIDE_FIELDS) {
    if (!stored.manualOverrides[field]) continue;
    Object.assign(result, { [field]: stored[field] });
  }

  return result;
}
