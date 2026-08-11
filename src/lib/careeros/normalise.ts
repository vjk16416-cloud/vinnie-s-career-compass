import { createSeedData } from "./seed";
import type { CareerOsData } from "./types";

function list<T>(v: unknown, fallback: T[]): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

/**
 * Merge saved (possibly stale/partial) localStorage data onto the current seed
 * shape. Valid saved values always win; only missing/invalid fields are filled.
 */
export function normaliseData(raw: unknown): CareerOsData {
  const seed = createSeedData();
  if (!raw || typeof raw !== "object") return seed;
  const saved = raw as Partial<CareerOsData>;

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
    cvs: list(saved.cvs, seed.cvs).map((c) => ({ ...c, versions: list(c?.versions, []) })),
    coverLetters: list(saved.coverLetters, seed.coverLetters),
    scans: list(saved.scans, []),
    activity: list(saved.activity, seed.activity),
    settings: { ...seed.settings, ...(saved.settings ?? {}) },
  };
}
