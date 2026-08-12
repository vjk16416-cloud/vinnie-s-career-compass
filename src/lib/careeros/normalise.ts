import { createSeedData } from "./seed";
import type { CareerOsData, CvRules, Settings } from "./types";

const AUGUST_SYNC_VERSION = "pv-2026-08-12-career-sync";
const SOUTHEASTERN_JOB_ID = "job-southeastern-apm-3577";
const SOUTHEASTERN_APP_ID = "app-southeastern-apm-3577";
const SOUTHEASTERN_CV_ID = "cv-southeastern-apm-3577";
const SOUTHEASTERN_URL =
  "https://jobs.southeasternrailway.co.uk/jobs/job/Assistant-Project-Manager/3577";

const STALE_HEADLINE = "Performance Marketing Manager | UCL MSc Technology Management candidate";
const STALE_SUMMARY =
  "Performance Marketing Manager and part-time UCL MSc Technology Management candidate, combining multi-market digital acquisition experience with technology evaluation, new product development, analytics, stakeholder management, project delivery, and product/innovation work.";
const STALE_NUL_SUMMARY =
  "Own paid acquisition across PPC, paid social, display and third-party platforms for a multi-market student recruitment portfolio.";
const STALE_NUL_BUDGET_HIGHLIGHT =
  "Own an annual digital media budget of £140k+ across PPC, paid social, display and third-party platforms.";

function list<T>(v: unknown, fallback: T[]): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function findSeedJob(seed: CareerOsData) {
  return seed.jobs.find((job) => job.id === SOUTHEASTERN_JOB_ID)!;
}

function findSeedApplication(seed: CareerOsData) {
  return seed.applications.find((app) => app.id === SOUTHEASTERN_APP_ID)!;
}

function findSeedCv(seed: CareerOsData) {
  return seed.cvs.find((cv) => cv.id === SOUTHEASTERN_CV_ID)!;
}

function isSoutheasternJob(job: CareerOsData["jobs"][number]) {
  return (
    job.id === SOUTHEASTERN_JOB_ID ||
    job.url === SOUTHEASTERN_URL ||
    (job.company.toLowerCase() === "southeastern" &&
      job.title.toLowerCase() === "assistant project manager")
  );
}

function isSoutheasternApplication(app: CareerOsData["applications"][number]) {
  return (
    app.id === SOUTHEASTERN_APP_ID ||
    app.url === SOUTHEASTERN_URL ||
    (app.company.toLowerCase() === "southeastern" &&
      app.title.toLowerCase() === "assistant project manager")
  );
}

function isSoutheasternCv(cv: CareerOsData["cvs"][number]) {
  return cv.id === SOUTHEASTERN_CV_ID || cv.name.toLowerCase().includes("southeastern");
}

function applyAugust2026Sync(data: CareerOsData, seed: CareerOsData): CareerOsData {
  if (data.profileVersions.some((version) => version.id === AUGUST_SYNC_VERSION)) {
    return data;
  }

  if (data.profile.headline === STALE_HEADLINE) {
    data.profile.headline = seed.profile.headline;
  }
  if (data.profile.summary === STALE_SUMMARY) {
    data.profile.summary = seed.profile.summary;
  }

  const savedNul = data.profile.employment.find((role) => role.id === "emp-nul");
  const seedNul = seed.profile.employment.find((role) => role.id === "emp-nul");
  if (savedNul && seedNul) {
    if (savedNul.end === "Present") savedNul.end = "Dec 2025";
    if (savedNul.summary === STALE_NUL_SUMMARY) savedNul.summary = seedNul.summary;
    savedNul.highlights = savedNul.highlights.map((highlight) =>
      highlight === STALE_NUL_BUDGET_HIGHLIGHT ? (seedNul.highlights[0] ?? highlight) : highlight,
    );
  }

  let job = data.jobs.find(isSoutheasternJob);
  if (!job) {
    job = clone(findSeedJob(seed));
    data.jobs.push(job);
  }

  let app = data.applications.find(isSoutheasternApplication);
  let cv = data.cvs.find(isSoutheasternCv);

  if (!cv) {
    cv = clone(findSeedCv(seed));
    cv.jobId = job.id;
    if (app) cv.applicationId = app.id;
    data.cvs.push(cv);
  }

  if (!app) {
    app = clone(findSeedApplication(seed));
    app.jobId = job.id;
    app.linkedCvId = cv.id;
    data.applications.push(app);
  } else {
    app.jobId = job.id;
    if (!app.linkedCvId) app.linkedCvId = cv.id;
  }

  if (!cv.jobId) cv.jobId = job.id;
  if (!cv.applicationId) cv.applicationId = app.id;

  const seedVersion = seed.profileVersions.find((version) => version.id === AUGUST_SYNC_VERSION)!;
  data.profileVersions.push(clone(seedVersion));

  for (const id of ["act-sync-2026-08-12", "act-southeastern-app", "act-southeastern-cv"]) {
    if (data.activity.some((entry) => entry.id === id)) continue;
    const entry = seed.activity.find((item) => item.id === id);
    if (entry) data.activity.unshift(clone(entry));
  }

  return data;
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

  const savedSettings = (saved.settings ?? {}) as Partial<Settings> & {
    cvRules?: Partial<CvRules>;
  };
  const settings: Settings = {
    ...seed.settings,
    ...savedSettings,
    cvRules: {
      ...seed.settings.cvRules,
      ...(savedSettings.cvRules ?? {}),
    },
  };

  const normalised: CareerOsData = {
    ...seed,
    ...saved,
    profile,
    evidence,
    profileVersions: list(saved.profileVersions, []),
    jobs: list(saved.jobs, []),
    applications: list(saved.applications, seed.applications).map((a) => ({
      ...a,
      history: list(a?.history, []),
    })),
    cvs: list(saved.cvs, seed.cvs).map((c) => ({ ...c, versions: list(c?.versions, []) })),
    coverLetters: list(saved.coverLetters, seed.coverLetters),
    scans: list(saved.scans, []),
    activity: list(saved.activity, []),
    settings,
  };

  return applyAugust2026Sync(normalised, seed);
}
