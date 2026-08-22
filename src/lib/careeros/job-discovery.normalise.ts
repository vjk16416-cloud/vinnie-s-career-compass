import { buildDedupeKey, evaluateJobStatus, normaliseSafeUrl } from "./job-discovery.domain";
import type { RawJobListing } from "./job-discovery.providers";
import type { DiscoveredJob, JobMatchType, JobSearchPreferences } from "./job-discovery.types";

function compact(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function sameText(left: string, right: string) {
  return compact(left).toLowerCase() === compact(right).toLowerCase();
}

function matchTypeFor(title: string, preferences: JobSearchPreferences): JobMatchType {
  if (preferences.exactTitles.some((candidate) => sameText(candidate, title))) return "exact";
  if (preferences.adjacentTitles.some((candidate) => sameText(candidate, title))) return "adjacent";
  return "other";
}

function wordCount(value: string | null) {
  if (!value?.trim()) return 0;
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function normaliseRawJob(
  raw: RawJobListing,
  preferences: JobSearchPreferences,
  now = new Date(),
): DiscoveredJob {
  const timestamp = now.toISOString();
  const sourceUrl = normaliseSafeUrl(raw.sourceUrl);
  const applicationUrl = normaliseSafeUrl(raw.applicationUrl);
  const status = evaluateJobStatus({
    now,
    providerActive: raw.providerActive,
    httpStatus: null,
    closingDate: raw.closingDate,
  });
  const dedupeKey = buildDedupeKey({
    company: raw.company,
    title: raw.title,
    location: raw.location,
    applicationUrl,
    sourceJobId: raw.sourceJobId,
  });

  return {
    id: crypto.randomUUID(),
    userId: preferences.userId,
    dedupeKey,
    title: compact(raw.title),
    company: compact(raw.company),
    location: raw.location ? compact(raw.location) : null,
    description: raw.description?.trim() || null,
    descriptionWordCount: wordCount(raw.description),
    industry: raw.industry?.trim() || null,
    seniority: raw.seniority?.trim() || null,
    salaryMin: raw.salaryMin,
    salaryMax: raw.salaryMax,
    salaryCurrency: raw.salaryCurrency?.trim() || null,
    salaryText: raw.salaryText?.trim() || null,
    workplaceType: raw.workplaceType,
    employmentType: raw.employmentType,
    datePosted: raw.datePosted,
    closingDate: raw.closingDate,
    ukEligibility: raw.ukEligibility,
    visaSponsorship: raw.visaSponsorship,
    matchType: matchTypeFor(raw.title, preferences),
    sourceRefs: [
      {
        provider: compact(raw.provider),
        sourceUrl,
        applicationUrl,
        sourceJobId: raw.sourceJobId?.trim() || null,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
      },
    ],
    preferredSourceUrl: sourceUrl,
    preferredApplyUrl: applicationUrl,
    status: status.status,
    statusReason: status.reason,
    lastStatusCheckAt: timestamp,
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    archivedAt: status.status === "expired" ? timestamp : null,
    saved: false,
    fitScore: null,
    fitVerdict: null,
    fitStrategy: null,
    fitScoredAt: null,
    fitDescriptionSignature: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
