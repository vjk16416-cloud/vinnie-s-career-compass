import { describe, expect, it } from "vitest";

import { buildExternalSearchLinks } from "./job-search-destinations";
import type { JobSearchPreferences } from "./job-discovery.types";

const preferences: JobSearchPreferences = {
  userId: "user-1",
  exactTitles: ["Senior Product Manager", "Programme Manager"],
  adjacentTitles: ["Product Owner"],
  seniority: ["Senior"],
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
  derivedFromProfileAt: "2026-08-22T11:00:00.000Z",
  manualOverrides: {},
  createdAt: "2026-08-22T11:00:00.000Z",
  updatedAt: "2026-08-22T11:00:00.000Z",
};

function readableUrl(value: string) {
  return decodeURIComponent(value).replace(/\+/g, " ").toLowerCase();
}

describe("external job search destinations", () => {
  it("builds one user-initiated HTTPS search for every approved major job site", () => {
    const links = buildExternalSearchLinks(preferences);
    expect(links.map((link) => link.id)).toEqual([
      "linkedin",
      "indeed",
      "reed",
      "totaljobs",
      "glassdoor",
    ]);
    for (const link of links) {
      const url = new URL(link.url);
      expect(url.protocol).toBe("https:");
      expect(link.mode).toBe("external_search");
    }
  });

  it("includes the preferred role and location terms without embedding secrets", () => {
    const links = buildExternalSearchLinks(preferences);
    for (const link of links) {
      const decoded = readableUrl(link.url);
      expect(decoded).toContain("senior product manager");
      expect(decoded).toContain("london");
      expect(decoded).not.toContain("api_key");
      expect(decoded).not.toContain("app_key");
      expect(decoded).not.toContain("token=");
    }
  });

  it("falls back to an adjacent title when no exact title is configured", () => {
    const links = buildExternalSearchLinks({
      ...preferences,
      exactTitles: [],
      adjacentTitles: ["Delivery Manager"],
    });
    expect(links).toHaveLength(5);
    for (const link of links) {
      expect(readableUrl(link.url)).toContain("delivery manager");
    }
  });

  it("still produces safe provider home-search links when location is empty", () => {
    const links = buildExternalSearchLinks({ ...preferences, locations: [] });
    for (const link of links) {
      const url = new URL(link.url);
      expect(url.protocol).toBe("https:");
      expect(readableUrl(link.url)).toContain("senior product manager");
    }
  });
});
