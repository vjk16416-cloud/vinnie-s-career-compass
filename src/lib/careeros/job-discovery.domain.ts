import type {
  DiscoveredJob,
  JobDiscoveryFilters,
  JobDiscoverySort,
  JobSourceRef,
  JobStatusEvaluation,
} from "./job-discovery.types";

function compactWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normaliseKeyText(value: string | null | undefined) {
  return compactWhitespace(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function normaliseSafeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function buildDedupeKey(input: {
  company: string;
  title: string;
  location: string | null;
  applicationUrl: string | null;
  sourceJobId: string | null;
}) {
  const directUrl = normaliseSafeUrl(input.applicationUrl);
  const identity = [
    normaliseKeyText(input.company),
    normaliseKeyText(input.title),
    normaliseKeyText(input.location),
    directUrl ? directUrl.toLowerCase() : "",
  ].join("|");
  return `job-${fnv1a(identity)}`;
}

function sourceIdentity(ref: JobSourceRef) {
  return [
    ref.provider.trim().toLowerCase(),
    ref.sourceJobId?.trim().toLowerCase() || normaliseSafeUrl(ref.sourceUrl)?.toLowerCase() || "",
  ].join("|");
}

function earlierIso(first: string, second: string) {
  return new Date(first).getTime() <= new Date(second).getTime() ? first : second;
}

function laterIso(first: string, second: string) {
  return new Date(first).getTime() >= new Date(second).getTime() ? first : second;
}

export function mergeSourceRefs(existing: JobSourceRef[], incoming: JobSourceRef[]) {
  const merged = new Map<string, JobSourceRef>();
  for (const ref of [...existing, ...incoming]) {
    const safe: JobSourceRef = {
      ...ref,
      sourceUrl: normaliseSafeUrl(ref.sourceUrl),
      applicationUrl: normaliseSafeUrl(ref.applicationUrl),
      provider: compactWhitespace(ref.provider),
      sourceJobId: ref.sourceJobId?.trim() || null,
    };
    const key = sourceIdentity(safe);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, safe);
      continue;
    }
    merged.set(key, {
      ...current,
      sourceUrl: current.sourceUrl ?? safe.sourceUrl,
      applicationUrl: current.applicationUrl ?? safe.applicationUrl,
      sourceJobId: current.sourceJobId ?? safe.sourceJobId,
      firstSeenAt: earlierIso(current.firstSeenAt, safe.firstSeenAt),
      lastSeenAt: laterIso(current.lastSeenAt, safe.lastSeenAt),
    });
  }
  return [...merged.values()];
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / 86_400_000);
}

export function evaluateJobStatus(input: {
  now: Date;
  providerActive?: boolean | null;
  httpStatus?: number | null;
  closingDate: string | null;
  directPageVerifiedActive?: boolean;
  explicitClosedPage?: boolean;
}): JobStatusEvaluation {
  const closing = parseDateOnly(input.closingDate);
  if (closing && closing.getTime() < startOfUtcDay(input.now).getTime()) {
    return { status: "expired", reason: "The stated closing date has passed." };
  }
  if (input.providerActive === false) {
    return { status: "expired", reason: "The source reports this vacancy is no longer active." };
  }
  if (input.explicitClosedPage) {
    return { status: "expired", reason: "The employer page states that this vacancy is closed." };
  }
  if (input.httpStatus === 404 || input.httpStatus === 410) {
    return { status: "expired", reason: `The vacancy page returned ${input.httpStatus}.` };
  }
  if (input.httpStatus === 403 || input.httpStatus === 429) {
    return {
      status: "uncertain",
      reason: `The source blocked automated verification with status ${input.httpStatus}.`,
    };
  }

  const verifiedActive = input.providerActive === true || input.directPageVerifiedActive === true;
  if (verifiedActive && closing) {
    const days = daysBetween(input.now, closing);
    if (days >= 0 && days <= 7) {
      return { status: "closing_soon", reason: `Closing date is within ${days} day${days === 1 ? "" : "s"}.` };
    }
  }
  if (verifiedActive) {
    return { status: "active", reason: "The source currently verifies this vacancy as active." };
  }
  return {
    status: "uncertain",
    reason: "CareerOS does not have a reliable signal proving this vacancy is still active.",
  };
}

function includesCaseInsensitive(haystack: string | null | undefined, needle: string) {
  return (haystack ?? "").toLowerCase().includes(needle.toLowerCase());
}

function listMatches(value: string | null | undefined, selected: string[]) {
  if (!selected.length) return true;
  return selected.some((candidate) => includesCaseInsensitive(value, candidate));
}

function sourceMatches(job: DiscoveredJob, selected: string[]) {
  if (!selected.length) return true;
  return job.sourceRefs.some((ref) => selected.some((name) => name.toLowerCase() === ref.provider.toLowerCase()));
}

function postedWithin(job: DiscoveredJob, days: number | null, now: Date) {
  if (days == null) return true;
  const posted = parseDateOnly(job.datePosted);
  if (!posted) return false;
  const age = daysBetween(posted, now);
  return age >= 0 && age <= days;
}

function isNewToday(job: DiscoveredJob, now: Date) {
  const firstSeen = new Date(job.firstSeenAt);
  if (Number.isNaN(firstSeen.getTime())) return false;
  return startOfUtcDay(firstSeen).getTime() === startOfUtcDay(now).getTime();
}

function dateValue(value: string | null | undefined, fallback: number) {
  if (!value) return fallback;
  const date = value.length === 10 ? parseDateOnly(value) : new Date(value);
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : fallback;
}

export function filterAndSortJobs(
  jobs: DiscoveredJob[],
  filters: JobDiscoveryFilters,
  sort: JobDiscoverySort,
  now = new Date(),
) {
  const search = filters.search.trim().toLowerCase();
  const filtered = jobs.filter((job) => {
    if (search) {
      const corpus = [job.title, job.company, job.location, job.industry, job.seniority]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!corpus.includes(search)) return false;
    }
    if (filters.fitBands.length && (!job.fitVerdict || !filters.fitBands.includes(job.fitVerdict))) return false;
    if (!sourceMatches(job, filters.sources)) return false;
    if (filters.matchTypes.length && !filters.matchTypes.includes(job.matchType)) return false;
    if (!listMatches(job.industry, filters.industries)) return false;
    if (!listMatches(job.seniority, filters.seniority)) return false;
    if (!listMatches(job.location, filters.locations)) return false;
    if (
      filters.workplaceTypes.length &&
      (!job.workplaceType || !filters.workplaceTypes.includes(job.workplaceType))
    )
      return false;
    if (
      filters.employmentTypes.length &&
      (!job.employmentType || !filters.employmentTypes.includes(job.employmentType))
    )
      return false;
    if (filters.ukScopes.length && !filters.ukScopes.includes(job.ukEligibility)) return false;
    if (filters.sponsorship.length && !filters.sponsorship.includes(job.visaSponsorship)) return false;
    if (filters.statuses.length && !filters.statuses.includes(job.status)) return false;
    if (filters.minSalary != null) {
      const comparableSalary = job.salaryMax ?? job.salaryMin;
      if (comparableSalary == null || comparableSalary < filters.minSalary) return false;
    }
    if (!postedWithin(job, filters.postedWithinDays, now)) return false;
    if (filters.closingSoonOnly && job.status !== "closing_soon") return false;
    if (filters.savedOnly && !job.saved) return false;
    if (filters.newTodayOnly && !isNewToday(job, now)) return false;
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (sort === "newest") {
      return dateValue(b.datePosted, -Infinity) - dateValue(a.datePosted, -Infinity);
    }
    if (sort === "closing_soon") {
      return dateValue(a.closingDate, Infinity) - dateValue(b.closingDate, Infinity);
    }
    if (sort === "salary") {
      const aFloor = a.salaryMin ?? a.salaryMax;
      const bFloor = b.salaryMin ?? b.salaryMax;
      if (aFloor == null && bFloor == null) return 0;
      if (aFloor == null) return 1;
      if (bFloor == null) return -1;
      if (aFloor !== bFloor) return bFloor - aFloor;
      const aMax = a.salaryMax;
      const bMax = b.salaryMax;
      if (aMax == null && bMax == null) return 0;
      if (aMax == null) return 1;
      if (bMax == null) return -1;
      return bMax - aMax;
    }
    const scoreDifference = (b.fitScore ?? -Infinity) - (a.fitScore ?? -Infinity);
    if (scoreDifference !== 0) return scoreDifference;
    return dateValue(b.datePosted, -Infinity) - dateValue(a.datePosted, -Infinity);
  });
}
