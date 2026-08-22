import { describe, expect, it } from "vitest";

import {
  buildDedupeKey,
  evaluateJobStatus,
  filterAndSortJobs,
  mergeSourceRefs,
  normaliseSafeUrl,
} from "./job-discovery.domain";
import type { DiscoveredJob, JobDiscoveryFilters, JobSourceRef } from "./job-discovery.types";

const now = new Date("2026-08-22T11:00:00.000Z");

function source(overrides: Partial<JobSourceRef> = {}): JobSourceRef {
  return {
    provider: "Adzuna",
    sourceUrl: "https://example.com/jobs/1",
    applicationUrl: null,
    sourceJobId: "1",
    firstSeenAt: "2026-08-22T09:00:00.000Z",
    lastSeenAt: "2026-08-22T10:00:00.000Z",
    ...overrides,
  };
}

function job(overrides: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    id: "job-1",
    userId: "user-1",
    dedupeKey: "key-1",
    title: "Senior Product Manager",
    company: "Acme",
    location: "London",
    description: "Product role description ".repeat(50),
    descriptionWordCount: 150,
    industry: "Technology",
    seniority: "Senior",
    salaryMin: 80000,
    salaryMax: 100000,
    salaryCurrency: "GBP",
    salaryText: "£80,000 - £100,000",
    workplaceType: "Hybrid",
    employmentType: "Permanent",
    datePosted: "2026-08-22",
    closingDate: "2026-08-28",
    ukEligibility: "confirmed",
    visaSponsorship: "unknown",
    matchType: "exact",
    sourceRefs: [source()],
    preferredSourceUrl: "https://example.com/jobs/1",
    preferredApplyUrl: null,
    status: "active",
    statusReason: "Provider reports active",
    lastStatusCheckAt: "2026-08-22T10:00:00.000Z",
    firstSeenAt: "2026-08-22T09:00:00.000Z",
    lastSeenAt: "2026-08-22T10:00:00.000Z",
    archivedAt: null,
    saved: false,
    fitScore: 82,
    fitVerdict: "Strong Fit",
    fitStrategy: "Apply",
    fitScoredAt: "2026-08-22T10:00:00.000Z",
    fitDescriptionSignature: "sig",
    createdAt: "2026-08-22T09:00:00.000Z",
    updatedAt: "2026-08-22T10:00:00.000Z",
    ...overrides,
  };
}

describe("job discovery domain", () => {
  it("accepts only http and https URLs", () => {
    expect(normaliseSafeUrl(" https://example.com/job ")).toBe("https://example.com/job");
    expect(normaliseSafeUrl("http://example.com/job")).toBe("http://example.com/job");
    expect(normaliseSafeUrl("javascript:alert(1)")).toBeNull();
    expect(normaliseSafeUrl("data:text/html,test")).toBeNull();
  });

  it("builds the same dedupe key for equivalent company title and location text", () => {
    const first = buildDedupeKey({
      company: "ACME Ltd.",
      title: "Senior Product Manager",
      location: "London, UK",
      applicationUrl: null,
      sourceJobId: null,
    });
    const second = buildDedupeKey({
      company: " acme ltd ",
      title: "senior   product manager",
      location: "London UK",
      applicationUrl: null,
      sourceJobId: null,
    });
    expect(first).toBe(second);
  });

  it("merges duplicate source refs without losing first seen provenance", () => {
    const merged = mergeSourceRefs(
      [source({ firstSeenAt: "2026-08-20T09:00:00.000Z" })],
      [source({ lastSeenAt: "2026-08-22T11:00:00.000Z" })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.firstSeenAt).toBe("2026-08-20T09:00:00.000Z");
    expect(merged[0]?.lastSeenAt).toBe("2026-08-22T11:00:00.000Z");
  });

  it("treats blocked verification as uncertain rather than expired", () => {
    expect(evaluateJobStatus({ now, httpStatus: 403, closingDate: null })).toMatchObject({
      status: "uncertain",
    });
    expect(evaluateJobStatus({ now, httpStatus: 429, closingDate: null })).toMatchObject({
      status: "uncertain",
    });
  });

  it("treats reliable gone responses as expired", () => {
    expect(evaluateJobStatus({ now, httpStatus: 404, closingDate: null })).toMatchObject({
      status: "expired",
    });
    expect(evaluateJobStatus({ now, httpStatus: 410, closingDate: null })).toMatchObject({
      status: "expired",
    });
  });

  it("marks active jobs closing within seven days as closing soon", () => {
    expect(
      evaluateJobStatus({ now, providerActive: true, httpStatus: null, closingDate: "2026-08-28" }),
    ).toMatchObject({ status: "closing_soon" });
  });

  it("filters on supported metadata and sorts by best fit", () => {
    const filters: JobDiscoveryFilters = {
      search: "product",
      fitBands: ["Strong Fit"],
      sources: ["Adzuna"],
      matchTypes: ["exact"],
      industries: ["Technology"],
      seniority: ["Senior"],
      locations: ["London"],
      workplaceTypes: ["Hybrid"],
      employmentTypes: ["Permanent"],
      ukScopes: ["confirmed"],
      sponsorship: [],
      statuses: ["active", "closing_soon"],
      minSalary: 70000,
      postedWithinDays: 7,
      closingSoonOnly: false,
      savedOnly: false,
      newTodayOnly: false,
    };
    const jobs = [
      job(),
      job({ id: "job-2", title: "Programme Manager", fitScore: 90, fitVerdict: "Strong Fit" }),
      job({ id: "job-3", fitScore: 70, fitVerdict: "Competitive" }),
    ];
    const result = filterAndSortJobs(jobs, filters, "best_fit", now);
    expect(result.map((item) => item.id)).toEqual(["job-1"]);
  });

  it("sorts newest, closing soon and salary without inventing missing values", () => {
    const base: JobDiscoveryFilters = {
      search: "",
      fitBands: [],
      sources: [],
      matchTypes: [],
      industries: [],
      seniority: [],
      locations: [],
      workplaceTypes: [],
      employmentTypes: [],
      ukScopes: [],
      sponsorship: [],
      statuses: [],
      minSalary: null,
      postedWithinDays: null,
      closingSoonOnly: false,
      savedOnly: false,
      newTodayOnly: false,
    };
    const jobs = [
      job({ id: "a", datePosted: "2026-08-20", closingDate: "2026-08-30", salaryMin: 70000 }),
      job({ id: "b", datePosted: "2026-08-22", closingDate: "2026-08-24", salaryMin: 90000 }),
      job({ id: "c", datePosted: null, closingDate: null, salaryMin: null, salaryMax: null }),
    ];
    expect(filterAndSortJobs(jobs, base, "newest", now).map((item) => item.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(filterAndSortJobs(jobs, base, "closing_soon", now).map((item) => item.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(filterAndSortJobs(jobs, base, "salary", now).map((item) => item.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });
});
