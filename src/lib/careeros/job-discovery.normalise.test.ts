import { describe, expect, it } from "vitest";

import { normaliseRawJob } from "./job-discovery.normalise";
import type { RawJobListing } from "./job-discovery.providers";
import type { JobSearchPreferences } from "./job-discovery.types";

const preferences: JobSearchPreferences = {
  userId: "user-1",
  exactTitles: ["Senior Product Manager"],
  adjacentTitles: ["Product Lead", "Product Owner"],
  seniority: ["Senior"],
  industries: ["Technology"],
  locations: ["London, UK"],
  salaryMin: 80000,
  salaryCurrency: "GBP",
  workplaceTypes: ["Remote", "Hybrid", "On-site"],
  employmentTypes: ["Permanent", "Contract", "Fixed-term"],
  includeUk: true,
  includeGlobalUkHireable: true,
  includeRelocationSponsorship: true,
  emailAlertsEnabled: true,
  derivedFromProfileAt: "2026-08-22T11:00:00.000Z",
  manualOverrides: {},
  createdAt: "2026-08-22T11:00:00.000Z",
  updatedAt: "2026-08-22T11:00:00.000Z",
};

function raw(overrides: Partial<RawJobListing> = {}): RawJobListing {
  return {
    provider: "Adzuna",
    sourceJobId: "adz-1",
    title: "Senior Product Manager",
    company: "Acme",
    location: "London, UK",
    description: "Own product strategy, discovery and delivery. ".repeat(20),
    industry: "Technology",
    seniority: null,
    salaryMin: 85000,
    salaryMax: 100000,
    salaryCurrency: "GBP",
    salaryText: null,
    workplaceType: "Hybrid",
    employmentType: "Permanent",
    datePosted: "2026-08-22",
    closingDate: null,
    sourceUrl: "https://jobs.example.com/source/1",
    applicationUrl: "https://careers.acme.com/job/1",
    providerActive: true,
    ukEligibility: "confirmed",
    visaSponsorship: "unknown",
    ...overrides,
  };
}

describe("job discovery normalisation", () => {
  it("normalises an exact title match without losing supplied metadata", () => {
    const result = normaliseRawJob(raw(), preferences, new Date("2026-08-22T11:00:00.000Z"));

    expect(result).toMatchObject({
      title: "Senior Product Manager",
      company: "Acme",
      location: "London, UK",
      industry: "Technology",
      salaryMin: 85000,
      salaryMax: 100000,
      salaryCurrency: "GBP",
      workplaceType: "Hybrid",
      employmentType: "Permanent",
      datePosted: "2026-08-22",
      matchType: "exact",
      preferredApplyUrl: "https://careers.acme.com/job/1",
      preferredSourceUrl: "https://jobs.example.com/source/1",
      ukEligibility: "confirmed",
      visaSponsorship: "unknown",
    });
    expect(result.descriptionWordCount).toBeGreaterThan(40);
    expect(result.sourceRefs).toEqual([
      expect.objectContaining({ provider: "Adzuna", sourceJobId: "adz-1" }),
    ]);
  });

  it("classifies configured adjacent titles separately from exact matches", () => {
    const result = normaliseRawJob(
      raw({ title: "Product Lead" }),
      preferences,
      new Date("2026-08-22T11:00:00.000Z"),
    );
    expect(result.matchType).toBe("adjacent");
  });

  it("keeps unrecognised titles as other rather than pretending they are adjacent", () => {
    const result = normaliseRawJob(
      raw({ title: "Finance Director" }),
      preferences,
      new Date("2026-08-22T11:00:00.000Z"),
    );
    expect(result.matchType).toBe("other");
  });

  it("rejects unsafe URLs while preserving the job record", () => {
    const result = normaliseRawJob(
      raw({ sourceUrl: "javascript:alert(1)", applicationUrl: "data:text/html,test" }),
      preferences,
      new Date("2026-08-22T11:00:00.000Z"),
    );
    expect(result.preferredSourceUrl).toBeNull();
    expect(result.preferredApplyUrl).toBeNull();
    expect(result.sourceRefs[0]).toMatchObject({ sourceUrl: null, applicationUrl: null });
  });

  it("leaves unknown salary, workplace, eligibility and sponsorship values unknown", () => {
    const result = normaliseRawJob(
      raw({
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryText: null,
        workplaceType: null,
        employmentType: null,
        ukEligibility: "unknown",
        visaSponsorship: "unknown",
      }),
      preferences,
      new Date("2026-08-22T11:00:00.000Z"),
    );
    expect(result.salaryMin).toBeNull();
    expect(result.salaryMax).toBeNull();
    expect(result.salaryCurrency).toBeNull();
    expect(result.workplaceType).toBeNull();
    expect(result.employmentType).toBeNull();
    expect(result.ukEligibility).toBe("unknown");
    expect(result.visaSponsorship).toBe("unknown");
  });

  it("prefers an employer application URL over a provider source URL", () => {
    const result = normaliseRawJob(raw(), preferences, new Date("2026-08-22T11:00:00.000Z"));
    expect(result.preferredApplyUrl).toBe("https://careers.acme.com/job/1");
    expect(result.preferredSourceUrl).toBe("https://jobs.example.com/source/1");
  });
});
