import { describe, expect, it } from "vitest";

import { deriveJobSearchPreferences, mergePreferenceOverrides } from "./job-search-preferences";
import type { CareerProfile } from "./types";
import type { JobSearchPreferences } from "./job-discovery.types";

const profile: CareerProfile = {
  name: "Test User",
  location: "London, UK",
  headline: "Senior Product and Programme Leader",
  summary: "Product, programme and digital transformation leader.",
  employment: [
    {
      id: "e1",
      title: "Senior Product Manager",
      company: "Acme",
      employmentType: "Permanent",
      start: "2023",
      end: "Present",
      location: "London",
      summary: "Owned digital products and delivery.",
      highlights: [],
      skills: ["Product Management", "Stakeholder Management"],
    },
    {
      id: "e2",
      title: "Programme Manager",
      company: "Example",
      employmentType: "Contract",
      start: "2020",
      end: "2023",
      location: "London",
      summary: "Led transformation programmes.",
      highlights: [],
      skills: ["Programme Management", "Delivery"],
    },
  ],
  education: [],
  certifications: [],
  projects: [],
  skills: ["Product Management", "Programme Management", "Digital Transformation"],
  tools: ["Jira"],
  domains: ["Technology", "Financial Services"],
};

function stored(overrides: Partial<JobSearchPreferences> = {}): JobSearchPreferences {
  return {
    userId: "user-1",
    exactTitles: ["Custom Role"],
    adjacentTitles: ["Custom Adjacent"],
    seniority: ["Director"],
    industries: ["Healthcare"],
    locations: ["Manchester"],
    salaryMin: 95000,
    salaryCurrency: "GBP",
    workplaceTypes: ["Remote"],
    employmentTypes: ["Contract"],
    includeUk: true,
    includeGlobalUkHireable: false,
    includeRelocationSponsorship: false,
    emailAlertsEnabled: false,
    derivedFromProfileAt: "2026-08-20T09:00:00.000Z",
    manualOverrides: {},
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-21T09:00:00.000Z",
    ...overrides,
  };
}

describe("job search preferences", () => {
  it("derives conservative defaults from the Career Profile", () => {
    const result = deriveJobSearchPreferences({
      userId: "user-1",
      profile,
      profileItems: [],
      now: new Date("2026-08-22T11:00:00.000Z"),
    });

    expect(result.exactTitles).toEqual(["Senior Product Manager", "Programme Manager"]);
    expect(result.adjacentTitles).toContain("Product Owner");
    expect(result.adjacentTitles).toContain("Delivery Manager");
    expect(result.seniority).toContain("Senior");
    expect(result.industries).toEqual(["Technology", "Financial Services"]);
    expect(result.locations).toEqual(["London, UK"]);
    expect(result.salaryMin).toBeNull();
    expect(result.workplaceTypes).toEqual(["Remote", "Hybrid", "On-site"]);
    expect(result.employmentTypes).toEqual(["Permanent", "Contract", "Fixed-term"]);
    expect(result.includeUk).toBe(true);
    expect(result.includeGlobalUkHireable).toBe(true);
    expect(result.includeRelocationSponsorship).toBe(true);
    expect(result.emailAlertsEnabled).toBe(true);
  });

  it("does not pretend the Career Profile contains a salary when it does not", () => {
    const result = deriveJobSearchPreferences({
      userId: "user-1",
      profile,
      profileItems: [],
      now: new Date("2026-08-22T11:00:00.000Z"),
    });
    expect(result.salaryMin).toBeNull();
  });

  it("preserves only fields explicitly marked as manual overrides", () => {
    const derived = deriveJobSearchPreferences({
      userId: "user-1",
      profile,
      profileItems: [],
      now: new Date("2026-08-22T11:00:00.000Z"),
    });
    const existing = stored({
      manualOverrides: {
        exactTitles: true,
        salaryMin: true,
        emailAlertsEnabled: true,
        includeGlobalUkHireable: true,
      },
    });

    const merged = mergePreferenceOverrides(derived, existing);

    expect(merged.exactTitles).toEqual(["Custom Role"]);
    expect(merged.salaryMin).toBe(95000);
    expect(merged.emailAlertsEnabled).toBe(false);
    expect(merged.includeGlobalUkHireable).toBe(false);
    expect(merged.industries).toEqual(["Technology", "Financial Services"]);
    expect(merged.locations).toEqual(["London, UK"]);
    expect(merged.createdAt).toBe(existing.createdAt);
    expect(merged.updatedAt).toBe(derived.updatedAt);
  });

  it("deduplicates profile-derived titles and adjacent titles", () => {
    const duplicated: CareerProfile = {
      ...profile,
      employment: [profile.employment[0]!, profile.employment[0]!, profile.employment[1]!],
    };
    const result = deriveJobSearchPreferences({
      userId: "user-1",
      profile: duplicated,
      profileItems: [],
      now: new Date("2026-08-22T11:00:00.000Z"),
    });
    expect(new Set(result.exactTitles).size).toBe(result.exactTitles.length);
    expect(new Set(result.adjacentTitles).size).toBe(result.adjacentTitles.length);
    expect(result.adjacentTitles.every((title) => !result.exactTitles.includes(title))).toBe(true);
  });
});
