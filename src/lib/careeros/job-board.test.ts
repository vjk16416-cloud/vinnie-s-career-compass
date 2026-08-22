import { describe, expect, it } from "vitest";
import { createCareerOsData, withMasterProfileFoundation } from "./profile-data";
import {
  filterJobBoardListings,
  jobBoardFilterOptions,
  latestAnalysisForListing,
  listingToJobRecord,
  normaliseJobBoardListing,
} from "./job-board";
import type { CareerOsData, JobBoardListing, ScanResult } from "./types";

const longDescription = Array.from(
  { length: 48 },
  (_, index) => `word${index + 1}`,
).join(" ");

function listing(overrides: Partial<JobBoardListing> = {}): JobBoardListing {
  return {
    id: "board-1",
    title: "Senior Product Manager",
    company: "Acme",
    location: "London",
    description: longDescription,
    sourceKind: "imported",
    sourceName: "Acme Careers",
    sourceUrl: "https://example.com/jobs/1",
    applyUrl: "https://example.com/jobs/1/apply",
    salary: "£80,000-£95,000",
    workplaceType: "Hybrid",
    employmentType: "Permanent",
    closingDate: "2026-09-30",
    postedAt: "2026-08-20",
    importedAt: "2026-08-22T09:00:00.000Z",
    saved: false,
    ...overrides,
  };
}

describe("structured Job Board domain", () => {
  it("normalises imported text fields without inventing missing metadata", () => {
    const result = normaliseJobBoardListing(
      listing({
        title: "  Senior Product Manager  ",
        company: "  Acme  ",
        location: "  London  ",
        sourceName: "  Acme Careers  ",
        salary: undefined,
      }),
    );

    expect(result.title).toBe("Senior Product Manager");
    expect(result.company).toBe("Acme");
    expect(result.location).toBe("London");
    expect(result.sourceName).toBe("Acme Careers");
    expect(result.salary).toBeUndefined();
  });

  it("converts a listing to a complete structured JobRecord with provenance", () => {
    const result = listingToJobRecord(listing(), "job-board-1", "2026-08-22T10:00:00.000Z");

    expect(result).toMatchObject({
      id: "job-board-1",
      title: "Senior Product Manager",
      company: "Acme",
      location: "London · Hybrid",
      description: longDescription,
      sourceType: "board",
      extractionCompleteness: "complete",
      extractionMethod: "structured",
      boardListingId: "board-1",
      url: "https://example.com/jobs/1",
      createdAt: "2026-08-22T10:00:00.000Z",
    });
    expect(result.descriptionWordCount).toBe(48);
  });

  it("uses the apply URL when no source URL is available", () => {
    const result = listingToJobRecord(
      listing({ sourceUrl: undefined, applyUrl: "https://example.com/apply" }),
      "job-board-2",
      "2026-08-22T10:00:00.000Z",
    );

    expect(result.url).toBe("https://example.com/apply");
  });

  it("associates the latest scan only with jobs created from the listing", () => {
    const jobs = [
      listingToJobRecord(listing(), "job-old", "2026-08-22T09:00:00.000Z"),
      listingToJobRecord(listing(), "job-new", "2026-08-22T10:00:00.000Z"),
      listingToJobRecord(listing({ id: "board-2" }), "job-other", "2026-08-22T11:00:00.000Z"),
    ];
    const scans = [
      { id: "scan-old", jobId: "job-old", createdAt: "2026-08-22T09:01:00.000Z", overall: 61, verdict: "Competitive" },
      { id: "scan-new", jobId: "job-new", createdAt: "2026-08-22T10:01:00.000Z", overall: 82, verdict: "Strong Fit" },
      { id: "scan-other", jobId: "job-other", createdAt: "2026-08-22T11:01:00.000Z", overall: 99, verdict: "Strong Fit" },
    ] as ScanResult[];

    const result = latestAnalysisForListing("board-1", jobs, scans);

    expect(result?.job.id).toBe("job-new");
    expect(result?.scan.id).toBe("scan-new");
    expect(result?.scan.overall).toBe(82);
  });

  it("filters by free text, saved state, workplace type and employment type", () => {
    const listings = [
      listing({ id: "one", saved: true }),
      listing({
        id: "two",
        title: "Programme Manager",
        company: "Beta",
        location: "Manchester",
        description: `${longDescription} transformation delivery`,
        workplaceType: "Remote",
        employmentType: "Contract",
        saved: false,
      }),
    ];

    expect(filterJobBoardListings(listings, { query: "acme", savedOnly: false })).toHaveLength(1);
    expect(filterJobBoardListings(listings, { query: "transformation", savedOnly: false })[0]?.id).toBe("two");
    expect(filterJobBoardListings(listings, { query: "", savedOnly: true })[0]?.id).toBe("one");
    expect(
      filterJobBoardListings(listings, {
        query: "",
        savedOnly: false,
        workplaceType: "Remote",
        employmentType: "Contract",
      })[0]?.id,
    ).toBe("two");
  });

  it("derives distinct non-empty workplace and employment filter options", () => {
    const options = jobBoardFilterOptions([
      listing({ workplaceType: "Hybrid", employmentType: "Permanent" }),
      listing({ id: "two", workplaceType: "Remote", employmentType: "Contract" }),
      listing({ id: "three", workplaceType: "Hybrid", employmentType: "Permanent" }),
    ]);

    expect(options.workplaceTypes).toEqual(["Hybrid", "Remote"]);
    expect(options.employmentTypes).toEqual(["Contract", "Permanent"]);
  });

  it("does not treat malformed source URLs as safe external links", () => {
    const result = normaliseJobBoardListing(
      listing({ sourceUrl: "javascript:alert(1)", applyUrl: "not a url" }),
    );

    expect(result.sourceUrl).toBeUndefined();
    expect(result.applyUrl).toBeUndefined();
  });

  it("defaults older CareerOS snapshots to an empty Job Board collection", () => {
    const current = createCareerOsData();
    const olderSnapshot = { ...current } as CareerOsData & { jobBoardListings?: JobBoardListing[] };
    delete olderSnapshot.jobBoardListings;

    const hydrated = withMasterProfileFoundation(olderSnapshot as CareerOsData);

    expect(hydrated.jobBoardListings).toEqual([]);
  });
});
