import { describe, expect, it } from "vitest";
import { createCareerOsData } from "./profile-data";
import {
  dedupeDiscoveredJobs,
  defaultJobSearchPreferences,
  filterDiscoveredJobs,
  rankDiscoveredJobs,
  readJobSearchPreferences,
  type DiscoveredJob,
} from "./job-discovery";

const NOW = new Date("2026-08-22T12:00:00.000Z");

function job(overrides: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    id: "arbeitnow-uk:1",
    provider: "arbeitnow-uk",
    providerLabel: "Arbeitnow UK",
    providerJobId: "1",
    title: "Product Manager",
    company: "Example Co",
    location: "London, UK",
    remote: false,
    remoteRegion: "",
    visaSponsorship: null,
    employmentType: "Permanent",
    salary: "",
    description: "Lead product delivery, stakeholder management and agile roadmaps.",
    tags: ["Product", "Agile"],
    sourceUrl: "https://example.com/jobs/1",
    postedAt: "2026-08-20T12:00:00.000Z",
    fetchedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("Job Board discovery model", () => {
  it("derives usable default preferences from the Career Profile", () => {
    const data = createCareerOsData();
    const preferences = defaultJobSearchPreferences(data.profile);

    expect(preferences.roleFamilies).toContain("Product");
    expect(preferences.roleFamilies).toContain("Project / Delivery");
    expect(preferences.locations).toEqual(["UK"]);
    expect(preferences.includeRemote).toBe(true);
    expect(preferences.includeVisaSponsorship).toBe(true);
    expect(preferences.maxAgeDays).toBe(30);
  });

  it("reads defaults when an existing cloud snapshot has no Job Board preferences", () => {
    const data = createCareerOsData();
    const preferences = readJobSearchPreferences(data);

    expect(preferences.keywords.length).toBeGreaterThan(5);
    expect(preferences.locations).toContain("UK");
  });

  it("deduplicates the same vacancy by canonical URL", () => {
    const first = job({ sourceUrl: "https://example.com/jobs/1?utm_source=feed" });
    const duplicate = job({
      id: "remotive:99",
      provider: "remotive",
      providerLabel: "Remotive",
      providerJobId: "99",
      sourceUrl: "https://example.com/jobs/1",
    });

    expect(dedupeDiscoveredJobs([first, duplicate])).toHaveLength(1);
  });

  it("filters out stale and unrelated roles while retaining UK and remote matches", () => {
    const preferences = {
      ...defaultJobSearchPreferences(),
      keywords: ["product", "project"],
      roleFamilies: [],
      maxAgeDays: 30,
    };
    const jobs = [
      job(),
      job({
        id: "remotive:2",
        provider: "remotive",
        providerLabel: "Remotive",
        providerJobId: "2",
        title: "Remote Project Manager",
        location: "Worldwide",
        remote: true,
        sourceUrl: "https://remotive.com/remote-jobs/2",
      }),
      job({
        id: "old",
        title: "Product Owner",
        postedAt: "2026-05-01T00:00:00.000Z",
        sourceUrl: "https://example.com/jobs/old",
      }),
      job({
        id: "nurse",
        title: "Senior Nurse",
        description: "Clinical nursing role in a hospital.",
        tags: ["Nursing"],
        sourceUrl: "https://example.com/jobs/nurse",
      }),
    ];

    expect(filterDiscoveredJobs(jobs, preferences, NOW).map((item) => item.id)).toEqual([
      "arbeitnow-uk:1",
      "remotive:2",
    ]);
  });

  it("ranks a recent product role above a loosely related role and explains why", () => {
    const data = createCareerOsData();
    const preferences = {
      ...defaultJobSearchPreferences(data.profile),
      keywords: ["product", "stakeholder management", "agile"],
      roleFamilies: ["Product"],
    };
    const ranked = rankDiscoveredJobs(
      [
        job(),
        job({
          id: "marketing",
          title: "Marketing Coordinator",
          description: "Coordinate campaigns and content calendars.",
          tags: ["Marketing"],
          sourceUrl: "https://example.com/jobs/marketing",
        }),
      ],
      preferences,
      data,
      NOW,
    );

    expect(ranked[0]?.id).toBe("arbeitnow-uk:1");
    expect(ranked[0]?.discoveryScore).toBeGreaterThan(ranked[1]?.discoveryScore ?? 0);
    expect(ranked[0]?.matchReasons.join(" ")).toMatch(/title matches|profile overlap/i);
  });
});
