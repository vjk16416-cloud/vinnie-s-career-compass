import type { JobSearchPreferences } from "./job-discovery.types";

export type ExternalSearchDestinationId =
  "linkedin" | "indeed" | "reed" | "totaljobs" | "glassdoor";

export interface ExternalSearchDestination {
  id: ExternalSearchDestinationId;
  label: string;
  url: string;
  mode: "external_search";
}

function firstSearchTerm(preferences: JobSearchPreferences) {
  return preferences.exactTitles[0]?.trim() || preferences.adjacentTitles[0]?.trim() || "jobs";
}

function firstLocation(preferences: JobSearchPreferences) {
  return preferences.locations[0]?.trim() || "";
}

function queryUrl(base: string, values: Record<string, string>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

export function buildExternalSearchLinks(
  preferences: JobSearchPreferences,
): ExternalSearchDestination[] {
  const role = firstSearchTerm(preferences);
  const location = firstLocation(preferences);

  return [
    {
      id: "linkedin",
      label: "Search LinkedIn",
      url: queryUrl("https://www.linkedin.com/jobs/search/", {
        keywords: role,
        location,
      }),
      mode: "external_search",
    },
    {
      id: "indeed",
      label: "Search Indeed",
      url: queryUrl("https://uk.indeed.com/jobs", {
        q: role,
        l: location,
      }),
      mode: "external_search",
    },
    {
      id: "reed",
      label: "Search Reed",
      url: queryUrl("https://www.reed.co.uk/jobs", {
        keywords: role,
        location,
      }),
      mode: "external_search",
    },
    {
      id: "totaljobs",
      label: "Search Totaljobs",
      url: queryUrl("https://www.totaljobs.com/jobs", {
        keywords: role,
        location,
      }),
      mode: "external_search",
    },
    {
      id: "glassdoor",
      label: "Search Glassdoor",
      url: queryUrl("https://www.glassdoor.co.uk/Job/jobs.htm", {
        "sc.keyword": role,
        locKeyword: location,
      }),
      mode: "external_search",
    },
  ];
}
