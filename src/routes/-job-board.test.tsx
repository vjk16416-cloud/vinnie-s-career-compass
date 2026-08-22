import "@/test/dom";
import "@/test/setup";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { JobBoardContent } from "@/routes/job-board";
import type { DiscoveredJob, JobSearchPreferences } from "@/lib/careeros/job-discovery.types";

const NOW = new Date("2026-08-22T10:00:00.000Z");

const preferences: JobSearchPreferences = {
  userId: "user-1",
  exactTitles: ["Head of Operations"],
  adjacentTitles: ["Programme Director"],
  seniority: ["Director / Head"],
  industries: ["Technology"],
  locations: ["London, UK"],
  salaryMin: 90000,
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
    id: "job-1",
    userId: "user-1",
    dedupeKey: "job-1",
    title: "Head of Operations",
    company: "Example Ltd",
    location: "London, UK",
    description: "Job description",
    descriptionWordCount: 120,
    industry: "Technology",
    seniority: "Head",
    salaryMin: 90000,
    salaryMax: 110000,
    salaryCurrency: "GBP",
    salaryText: "£90,000 to £110,000",
    workplaceType: "Hybrid",
    employmentType: "Permanent",
    datePosted: "2026-08-22",
    closingDate: "2026-08-29",
    ukEligibility: "confirmed",
    visaSponsorship: "unknown",
    matchType: "exact",
    sourceRefs: [
      {
        provider: "Adzuna",
        sourceUrl: "https://example.com/jobs/1",
        applicationUrl: "https://careers.example.com/jobs/1",
        sourceJobId: "1",
        firstSeenAt: NOW.toISOString(),
        lastSeenAt: NOW.toISOString(),
      },
    ],
    preferredSourceUrl: "https://example.com/jobs/1",
    preferredApplyUrl: "https://careers.example.com/jobs/1",
    status: "active",
    statusReason: "Source verifies this vacancy as active.",
    lastStatusCheckAt: NOW.toISOString(),
    firstSeenAt: NOW.toISOString(),
    lastSeenAt: NOW.toISOString(),
    archivedAt: null,
    saved: false,
    fitScore: 84,
    fitVerdict: "Strong Fit",
    fitStrategy: "Apply",
    fitScoredAt: NOW.toISOString(),
    fitDescriptionSignature: "sig-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

afterEach(cleanup);

describe("Job Board", () => {
  it("shows personalised external searches on the major job-board main sites", () => {
    render(
      <JobBoardContent
        preferences={preferences}
        jobs={[job()]}
        now={NOW}
        lastRefreshedAt={NOW.toISOString()}
      />,
    );

    for (const name of ["LinkedIn", "Indeed", "Reed", "Totaljobs", "Glassdoor"]) {
      expect(screen.getByRole("link", { name: `Search ${name}` })).toHaveAttribute(
        "href",
        expect.stringMatching(/^https:\/\//),
      );
    }
  });

  it("shows New today, daily shortlist, filters and the full active board", () => {
    render(
      <JobBoardContent
        preferences={preferences}
        jobs={[job()]}
        now={NOW}
        lastRefreshedAt={NOW.toISOString()}
      />,
    );

    expect(screen.getByRole("heading", { name: "New today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Daily shortlist" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All active jobs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Refresh jobs" })).toBeEnabled();
    expect(screen.getAllByText("Strong Fit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
  });

  it("keeps email alerts visible and switchable in Job Search Preferences", () => {
    render(
      <JobBoardContent
        preferences={preferences}
        jobs={[job()]}
        now={NOW}
        lastRefreshedAt={NOW.toISOString()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Job Search Preferences" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Email daily shortlist" })).toBeChecked();
    expect(screen.getByText("Head of Operations")).toBeInTheDocument();
    expect(screen.getByText("Programme Director")).toBeInTheDocument();
  });

  it("keeps expired jobs out of the active board and available in Archived", () => {
    render(
      <JobBoardContent
        preferences={preferences}
        jobs={[
          job(),
          job({
            id: "expired-1",
            dedupeKey: "expired-1",
            title: "Operations Director",
            company: "Old Co",
            status: "expired",
            statusReason: "The vacancy closed.",
            archivedAt: NOW.toISOString(),
            firstSeenAt: "2026-08-20T08:00:00.000Z",
          }),
        ]}
        now={NOW}
        lastRefreshedAt={NOW.toISOString()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Archived / expired" })).toBeInTheDocument();
    expect(screen.getByText("Old Co")).toBeInTheDocument();
  });
});
