import { describe, expect, it, vi } from "vitest";

import { createCareerOsData } from "./profile-data";
import { runJobDiscoveryRefresh, selectDailyShortlist } from "./job-discovery.orchestrator";
import type {
  DiscoveryEnv,
  JobDiscoveryAdapter,
  JobDiscoveryQuery,
  RawJobListing,
} from "./job-discovery.providers";
import type { DiscoveredJob, JobSearchPreferences } from "./job-discovery.types";

const NOW = new Date("2026-08-22T10:00:00.000Z");

function preferences(): JobSearchPreferences {
  return {
    userId: "user-1",
    exactTitles: ["Head of Operations"],
    adjacentTitles: ["Programme Director"],
    seniority: ["Director / Head"],
    industries: ["Technology"],
    locations: ["London, UK"],
    salaryMin: 80000,
    salaryCurrency: "GBP",
    workplaceTypes: ["Remote", "Hybrid"],
    employmentTypes: ["Permanent", "Contract", "Fixed-term"],
    includeUk: true,
    includeGlobalUkHireable: true,
    includeRelocationSponsorship: true,
    emailAlertsEnabled: true,
    derivedFromProfileAt: NOW.toISOString(),
    manualOverrides: {},
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

function raw(overrides: Partial<RawJobListing> = {}): RawJobListing {
  return {
    provider: "Adzuna",
    sourceJobId: "source-1",
    title: "Head of Operations",
    company: "Example Ltd",
    location: "London, UK",
    description: Array.from(
      { length: 24 },
      () =>
        "Lead strategic operations transformation programme delivery stakeholder management technology services and commercial improvement across complex teams.",
    ).join(" "),
    industry: "Technology",
    seniority: "Head",
    salaryMin: 90000,
    salaryMax: 110000,
    salaryCurrency: "GBP",
    salaryText: "£90,000 to £110,000",
    workplaceType: "Hybrid",
    employmentType: "Permanent",
    datePosted: "2026-08-22",
    closingDate: "2026-09-01",
    sourceUrl: "https://jobs.example.com/123",
    applicationUrl: null,
    providerActive: true,
    ukEligibility: "confirmed",
    visaSponsorship: "unknown",
    ...overrides,
  };
}

function adapter(id: string, listings: RawJobListing[], configured = true): JobDiscoveryAdapter {
  return {
    id,
    label: id,
    isConfigured: vi.fn(() => configured),
    search: vi.fn(async (_query: JobDiscoveryQuery, _env: DiscoveryEnv) => ({
      status: "success" as const,
      jobs: listings,
    })),
  };
}

describe("runJobDiscoveryRefresh", () => {
  it("skips unconfigured sources and reports them as unavailable", async () => {
    const disabled = adapter("disabled", [], false);
    const repository = {
      listExistingJobs: vi.fn(async () => [] as DiscoveredJob[]),
      upsertJobs: vi.fn(async () => undefined),
    };

    const result = await runJobDiscoveryRefresh({
      userId: "user-1",
      preferences: preferences(),
      careerState: createCareerOsData(),
      adapters: [disabled],
      env: {},
      repository,
      now: NOW,
    });

    expect(disabled.search).not.toHaveBeenCalled();
    expect(result.sourceResults.disabled).toMatchObject({ status: "unavailable" });
  });

  it("deduplicates sources, scores reliable descriptions and persists discovery summaries only", async () => {
    const state = createCareerOsData();
    const originalScans = [...state.scans];
    const first = raw();
    const second = raw({
      provider: "Partner Feed",
      sourceJobId: "other-source-id",
      sourceUrl: "https://partner.example/jobs/abc",
    });
    const short = raw({
      sourceJobId: "short",
      title: "Programme Director",
      company: "Short Description Ltd",
      sourceUrl: "https://jobs.example.com/short",
      description: "Lead a programme team in London.",
    });
    const repository = {
      listExistingJobs: vi.fn(async () => [] as DiscoveredJob[]),
      upsertJobs: vi.fn(async () => undefined),
    };

    const result = await runJobDiscoveryRefresh({
      userId: "user-1",
      preferences: preferences(),
      careerState: state,
      adapters: [adapter("one", [first, short]), adapter("two", [second])],
      env: {},
      repository,
      now: NOW,
    });

    expect(result.jobs).toHaveLength(2);
    const merged = result.jobs.find((job) => job.company === "Example Ltd");
    expect(merged?.sourceRefs).toHaveLength(2);
    expect(merged?.fitScore).not.toBeNull();
    expect(merged?.fitVerdict).not.toBeNull();
    expect(result.jobs.find((job) => job.company === "Short Description Ltd")?.fitScore).toBeNull();
    expect(repository.upsertJobs).toHaveBeenCalledWith("user-1", result.jobs);
    expect(state.scans).toEqual(originalScans);
  });

  it("preserves saved state and first-seen history when a vacancy is refreshed", async () => {
    const initial = await runJobDiscoveryRefresh({
      userId: "user-1",
      preferences: preferences(),
      careerState: createCareerOsData(),
      adapters: [adapter("one", [raw()])],
      env: {},
      repository: {
        listExistingJobs: vi.fn(async () => [] as DiscoveredJob[]),
        upsertJobs: vi.fn(async () => undefined),
      },
      now: new Date("2026-08-21T10:00:00.000Z"),
    });
    const existing = { ...initial.jobs[0]!, saved: true };
    const repository = {
      listExistingJobs: vi.fn(async () => [existing]),
      upsertJobs: vi.fn(async () => undefined),
    };

    const refreshed = await runJobDiscoveryRefresh({
      userId: "user-1",
      preferences: preferences(),
      careerState: createCareerOsData(),
      adapters: [adapter("one", [raw()])],
      env: {},
      repository,
      now: NOW,
    });

    expect(refreshed.jobs[0]).toMatchObject({
      saved: true,
      firstSeenAt: existing.firstSeenAt,
      lastSeenAt: NOW.toISOString(),
    });
  });
});

describe("selectDailyShortlist", () => {
  it("keeps fresh active jobs, ranks by fit and excludes expired or uncertain roles", async () => {
    const repository = {
      listExistingJobs: vi.fn(async () => [] as DiscoveredJob[]),
      upsertJobs: vi.fn(async () => undefined),
    };
    const refresh = await runJobDiscoveryRefresh({
      userId: "user-1",
      preferences: preferences(),
      careerState: createCareerOsData(),
      adapters: [
        adapter("one", [
          raw({ sourceJobId: "strong", company: "Strong Ltd" }),
          raw({
            sourceJobId: "uncertain",
            company: "Uncertain Ltd",
            providerActive: null,
            sourceUrl: "https://jobs.example.com/uncertain",
          }),
          raw({
            sourceJobId: "expired",
            company: "Expired Ltd",
            providerActive: false,
            sourceUrl: "https://jobs.example.com/expired",
          }),
        ]),
      ],
      env: {},
      repository,
      now: NOW,
    });

    const shortlist = selectDailyShortlist(refresh.jobs, NOW, 10);
    expect(shortlist.map((job) => job.company)).toEqual(["Strong Ltd"]);
  });
});
