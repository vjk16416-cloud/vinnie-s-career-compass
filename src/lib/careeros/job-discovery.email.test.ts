import { describe, expect, it, vi } from "vitest";

import { sendDailyJobShortlist } from "./job-discovery.email";
import type { DiscoveredJob, JobSearchPreferences } from "./job-discovery.types";

const NOW = new Date("2026-08-22T08:00:00.000Z");

const preferences: JobSearchPreferences = {
  userId: "user-1",
  exactTitles: ["Head of Operations"],
  adjacentTitles: [],
  seniority: [],
  industries: [],
  locations: ["London, UK"],
  salaryMin: null,
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

function job(overrides: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    dedupeKey: crypto.randomUUID(),
    title: "Head of Operations",
    company: "Example Ltd",
    location: "London, UK",
    description: null,
    descriptionWordCount: 0,
    industry: null,
    seniority: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryText: null,
    workplaceType: "Hybrid",
    employmentType: "Permanent",
    datePosted: "2026-08-22",
    closingDate: null,
    ukEligibility: "confirmed",
    visaSponsorship: "unknown",
    matchType: "exact",
    sourceRefs: [],
    preferredSourceUrl: "https://example.com/jobs/1",
    preferredApplyUrl: "https://example.com/jobs/1",
    status: "active",
    statusReason: "Active",
    lastStatusCheckAt: NOW.toISOString(),
    firstSeenAt: NOW.toISOString(),
    lastSeenAt: NOW.toISOString(),
    archivedAt: null,
    saved: false,
    fitScore: 82,
    fitVerdict: "Strong Fit",
    fitStrategy: "Apply",
    fitScoredAt: NOW.toISOString(),
    fitDescriptionSignature: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

const configured = {
  RESEND_API_KEY: "test-key",
  JOB_DISCOVERY_FROM_EMAIL: "CareerOS <jobs@example.com>",
  PUBLIC_APP_URL: "https://careeros.example.com",
};

describe("daily job shortlist email", () => {
  it("includes fresh active jobs and excludes expired jobs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const result = await sendDailyJobShortlist(
      {
        preferences,
        jobs: [job(), job({ title: "Expired role", status: "expired" })],
        to: "vinnie@example.com",
        now: NOW,
        runAlreadyEmailed: false,
      },
      configured,
      fetchImpl,
    );

    expect(result.status).toBe("sent");
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.html).toContain("Head of Operations");
    expect(body.html).not.toContain("Expired role");
  });

  it("sends nothing when alerts are disabled", async () => {
    const fetchImpl = vi.fn();
    const result = await sendDailyJobShortlist(
      {
        preferences: { ...preferences, emailAlertsEnabled: false },
        jobs: [job()],
        to: "vinnie@example.com",
        now: NOW,
        runAlreadyEmailed: false,
      },
      configured,
      fetchImpl,
    );
    expect(result.status).toBe("disabled");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports unavailable when Resend is not configured", async () => {
    const result = await sendDailyJobShortlist(
      { preferences, jobs: [job()], to: "vinnie@example.com", now: NOW, runAlreadyEmailed: false },
      {},
      vi.fn(),
    );
    expect(result.status).toBe("unavailable");
  });

  it("does not email twice for the same scheduled run", async () => {
    const fetchImpl = vi.fn();
    const result = await sendDailyJobShortlist(
      { preferences, jobs: [job()], to: "vinnie@example.com", now: NOW, runAlreadyEmailed: true },
      configured,
      fetchImpl,
    );
    expect(result.status).toBe("duplicate");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
