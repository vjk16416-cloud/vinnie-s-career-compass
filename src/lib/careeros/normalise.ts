import { createSeedData } from "./seed";
import type { CareerOsData } from "./types";

function list<T>(v: unknown, fallback: T[]): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

export const DEFAULT_JOB_SEARCH_PREFERENCES = {
  roleFamilies: [
    "Product",
    "Project / Delivery",
    "Technology / Innovation",
    "Product Marketing",
    "Digital / MarTech",
  ],
  keywords: [
    "product",
    "project",
    "delivery",
    "technology",
    "innovation",
    "product marketing",
    "digital",
    "martech",
  ],
  locations: ["UK"],
  includeRemote: true,
  includeVisaSponsorship: true,
  includeRelocation: true,
  maxAgeDays: 30,
} as const;

function normaliseJobSearchPreferences(settings: unknown) {
  const savedSettings =
    settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
  const stored =
    savedSettings.jobSearchPreferences && typeof savedSettings.jobSearchPreferences === "object"
      ? (savedSettings.jobSearchPreferences as Record<string, unknown>)
      : {};

  return {
    ...DEFAULT_JOB_SEARCH_PREFERENCES,
    ...stored,
    roleFamilies: list(stored.roleFamilies, [...DEFAULT_JOB_SEARCH_PREFERENCES.roleFamilies]),
    keywords: list(stored.keywords, [...DEFAULT_JOB_SEARCH_PREFERENCES.keywords]),
    locations: list(stored.locations, [...DEFAULT_JOB_SEARCH_PREFERENCES.locations]),
  };
}

/**
 * Merge saved (possibly stale/partial) localStorage data onto the current seed
 * shape. Valid saved values always win; only missing/invalid fields are filled.
 */
export function normaliseData(raw: unknown): CareerOsData {
  const seed = createSeedData();
  const saved = raw && typeof raw === "object" ? (raw as Partial<CareerOsData>) : {};

  const savedProfile = (saved.profile ?? {}) as Partial<CareerOsData["profile"]>;
  const profile: CareerOsData["profile"] = {
    ...seed.profile,
    ...savedProfile,
    employment: list(savedProfile.employment, seed.profile.employment),
    education: list(savedProfile.education, seed.profile.education),
    certifications: list(savedProfile.certifications, seed.profile.certifications),
    projects: list(savedProfile.projects, seed.profile.projects),
    skills: list(savedProfile.skills, seed.profile.skills),
    tools: list(savedProfile.tools, seed.profile.tools),
    domains: list(savedProfile.domains, seed.profile.domains),
  };

  const evidence = list(saved.evidence, seed.evidence).map((e) => ({
    ...e,
    skills: list<string>(e?.skills, []),
    status: e?.status ?? "Needs Evidence",
  }));

  const savedSettings = (saved.settings ?? {}) as Record<string, unknown>;
  const settings = {
    ...seed.settings,
    ...savedSettings,
    jobSearchPreferences: normaliseJobSearchPreferences(savedSettings),
  } as CareerOsData["settings"];

  return {
    ...seed,
    ...saved,
    profile,
    evidence,
    profileVersions: list(saved.profileVersions, seed.profileVersions),
    jobs: list(saved.jobs, []),
    applications: list(saved.applications, seed.applications).map((a) => ({
      ...a,
      history: list(a?.history, []),
    })),
    cvs: list(saved.cvs, seed.cvs).map((c) => ({
      ...c,
      versions: list(c?.versions, []),
      approvedVersionId: c?.approvedVersionId,
    })),
    coverLetters: list(saved.coverLetters, seed.coverLetters),
    scans: list(saved.scans, []).map((scan) => ({ ...scan })),
    reviewRuns: list(saved.reviewRuns, []),
    activity: list(saved.activity, seed.activity),
    settings,
  };
}
