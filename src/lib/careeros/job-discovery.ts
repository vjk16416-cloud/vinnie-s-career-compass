import type { CareerOsData, CareerProfile } from "./types";
import { DEFAULT_JOB_SEARCH_PREFERENCES } from "./normalise";

export type JobProvider = "arbeitnow-uk" | "remotive";

export interface DiscoveredJob {
  id: string;
  provider: JobProvider;
  providerLabel: string;
  providerJobId: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  remoteRegion: string;
  visaSponsorship: boolean | null;
  employmentType: string;
  salary: string;
  description: string;
  tags: string[];
  sourceUrl: string;
  postedAt: string;
  fetchedAt: string;
}

export interface JobSearchPreferences {
  keywords: string[];
  roleFamilies: string[];
  locations: string[];
  includeRemote: boolean;
  includeVisaSponsorship: boolean;
  includeRelocation: boolean;
  maxAgeDays: number;
}

export interface RankedDiscoveredJob extends DiscoveredJob {
  discoveryScore: number;
  matchReasons: string[];
}

type SettingsWithJobSearch = CareerOsData["settings"] & {
  jobSearchPreferences?: Partial<JobSearchPreferences>;
};

const UK_TERMS = [
  "united kingdom",
  "uk",
  "london",
  "england",
  "scotland",
  "wales",
  "northern ireland",
  "manchester",
  "birmingham",
  "bristol",
  "edinburgh",
  "glasgow",
  "leeds",
  "cambridge",
  "oxford",
];

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function defaultJobSearchPreferences(profile?: CareerProfile): JobSearchPreferences {
  const profileKeywords = profile
    ? [...profile.skills, ...profile.tools]
        .filter((value) =>
          /(product|project|delivery|technology|innovation|stakeholder|agile|digital|marketing|analytics|martech)/i.test(
            value,
          ),
        )
        .slice(0, 12)
    : [];

  return {
    roleFamilies: [...DEFAULT_JOB_SEARCH_PREFERENCES.roleFamilies],
    keywords: unique([...DEFAULT_JOB_SEARCH_PREFERENCES.keywords, ...profileKeywords]),
    locations: [...DEFAULT_JOB_SEARCH_PREFERENCES.locations],
    includeRemote: DEFAULT_JOB_SEARCH_PREFERENCES.includeRemote,
    includeVisaSponsorship: DEFAULT_JOB_SEARCH_PREFERENCES.includeVisaSponsorship,
    includeRelocation: DEFAULT_JOB_SEARCH_PREFERENCES.includeRelocation,
    maxAgeDays: DEFAULT_JOB_SEARCH_PREFERENCES.maxAgeDays,
  };
}

export function readJobSearchPreferences(data: CareerOsData): JobSearchPreferences {
  const defaults = defaultJobSearchPreferences(data.profile);
  const stored = (data.settings as SettingsWithJobSearch).jobSearchPreferences ?? {};

  return {
    ...defaults,
    ...stored,
    roleFamilies: unique(stored.roleFamilies ?? defaults.roleFamilies),
    keywords: unique(stored.keywords ?? defaults.keywords),
    locations: unique(stored.locations ?? defaults.locations),
  };
}

export function withJobSearchPreferences(
  data: CareerOsData,
  preferences: JobSearchPreferences,
): CareerOsData {
  const next = structuredClone(data);
  (next.settings as SettingsWithJobSearch).jobSearchPreferences = {
    ...preferences,
    roleFamilies: unique(preferences.roleFamilies),
    keywords: unique(preferences.keywords),
    locations: unique(preferences.locations),
  };
  return next;
}

function normalisedUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|sourceid$|campaign$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

function normalisedText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function duplicateKey(job: DiscoveredJob): string {
  const url = normalisedUrl(job.sourceUrl);
  if (url) return `url:${url}`;
  return `role:${normalisedText(job.company)}|${normalisedText(job.title)}|${normalisedText(job.location)}`;
}

export function dedupeDiscoveredJobs(jobs: DiscoveredJob[]): DiscoveredJob[] {
  const byUrl = new Map<string, DiscoveredJob>();
  const byRole = new Map<string, DiscoveredJob>();

  for (const job of jobs) {
    const urlKey = duplicateKey(job);
    const roleKey = `role:${normalisedText(job.company)}|${normalisedText(job.title)}|${normalisedText(job.location)}`;
    if (byUrl.has(urlKey) || byRole.has(roleKey)) continue;
    byUrl.set(urlKey, job);
    byRole.set(roleKey, job);
  }

  return [...byUrl.values()];
}

function ageDays(job: DiscoveredJob, now: Date): number | null {
  const posted = Date.parse(job.postedAt);
  if (!Number.isFinite(posted)) return null;
  return Math.max(0, (now.getTime() - posted) / 86_400_000);
}

function isUkLocation(job: DiscoveredJob): boolean {
  const location = normalisedText(job.location);
  return job.provider === "arbeitnow-uk" || UK_TERMS.some((term) => location.includes(term));
}

function matchesSearchTerms(job: DiscoveredJob, preferences: JobSearchPreferences): boolean {
  const haystack = normalisedText(
    `${job.title} ${job.company} ${job.tags.join(" ")} ${job.description}`,
  );
  const terms = unique([...preferences.roleFamilies, ...preferences.keywords]);
  if (terms.length === 0) return true;
  return terms.some((term) => haystack.includes(normalisedText(term)));
}

export function filterDiscoveredJobs(
  jobs: DiscoveredJob[],
  preferences: JobSearchPreferences,
  now: Date = new Date(),
): DiscoveredJob[] {
  return jobs.filter((job) => {
    const age = ageDays(job, now);
    if (age !== null && age > preferences.maxAgeDays) return false;
    if (!preferences.includeRemote && job.remote) return false;
    if (!preferences.includeVisaSponsorship && job.visaSponsorship === true) return false;

    const locationWanted = preferences.locations.length === 0 || preferences.locations.includes("Any");
    const ukWanted = preferences.locations.some((value) => /^(uk|united kingdom)$/i.test(value));
    const locationMatches =
      locationWanted ||
      (ukWanted && isUkLocation(job)) ||
      preferences.locations.some((value) =>
        normalisedText(job.location).includes(normalisedText(value)),
      ) ||
      (job.remote && preferences.includeRemote);

    return locationMatches && matchesSearchTerms(job, preferences);
  });
}

function approvedProfileSignals(data: CareerOsData): string[] {
  const approved = (data.profileItems ?? [])
    .filter((item) => item.status === "Approved")
    .filter((item) => ["Skill", "Tool", "Domain", "Employment", "Project"].includes(item.kind))
    .map((item) => item.safeWording || item.value || item.label);

  if (approved.length > 0) return unique(approved);
  return unique([...data.profile.skills, ...data.profile.tools, ...data.profile.domains]);
}

function includesTerm(text: string, term: string): boolean {
  const token = normalisedText(term);
  return token.length >= 2 && text.includes(token);
}

export function rankDiscoveredJobs(
  jobs: DiscoveredJob[],
  preferences: JobSearchPreferences,
  data: CareerOsData,
  now: Date = new Date(),
): RankedDiscoveredJob[] {
  const profileSignals = approvedProfileSignals(data);

  return jobs
    .map((job) => {
      const title = normalisedText(job.title);
      const tags = normalisedText(job.tags.join(" "));
      const description = normalisedText(job.description);
      const matchReasons: string[] = [];
      let score = 0;

      const preferenceTerms = unique([...preferences.roleFamilies, ...preferences.keywords]);
      const titleMatches = preferenceTerms.filter((term) => includesTerm(title, term));
      const tagMatches = preferenceTerms.filter((term) => includesTerm(tags, term));
      const descriptionMatches = preferenceTerms.filter((term) => includesTerm(description, term));

      if (titleMatches.length) {
        score += Math.min(45, 18 + titleMatches.length * 9);
        matchReasons.push(`Title matches ${titleMatches.slice(0, 2).join(", ")}`);
      }
      if (tagMatches.length) {
        score += Math.min(18, tagMatches.length * 6);
        matchReasons.push(`Relevant tags: ${tagMatches.slice(0, 2).join(", ")}`);
      }
      if (descriptionMatches.length) score += Math.min(12, descriptionMatches.length * 2);

      const profileMatches = profileSignals.filter((signal) =>
        includesTerm(`${title} ${tags} ${description}`, signal),
      );
      if (profileMatches.length) {
        score += Math.min(22, profileMatches.length * 4);
        matchReasons.push(`Profile overlap: ${profileMatches.slice(0, 2).join(", ")}`);
      }

      if (job.remote && preferences.includeRemote) {
        score += 3;
        matchReasons.push("Remote option");
      }
      if (job.visaSponsorship === true && preferences.includeVisaSponsorship) {
        score += 6;
        matchReasons.push("Visa sponsorship listed");
      }

      const age = ageDays(job, now);
      if (age !== null && age <= 7) {
        score += 4;
        matchReasons.push("Posted recently");
      }

      return {
        ...job,
        discoveryScore: Math.min(100, score),
        matchReasons: unique(matchReasons).slice(0, 4),
      };
    })
    .sort((left, right) => {
      if (right.discoveryScore !== left.discoveryScore) {
        return right.discoveryScore - left.discoveryScore;
      }
      return Date.parse(right.postedAt) - Date.parse(left.postedAt);
    });
}
