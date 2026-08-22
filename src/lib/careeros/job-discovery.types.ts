import type { ScanResult, Verdict } from "./types";

export type JobWorkplaceType = "Remote" | "Hybrid" | "On-site" | "Unspecified";
export type JobEmploymentType = "Permanent" | "Contract" | "Fixed-term" | "Unspecified";
export type JobMatchType = "exact" | "adjacent" | "other";
export type JobUkEligibility = "confirmed" | "likely" | "unknown" | "excluded";
export type JobVisaSponsorship = "confirmed" | "possible" | "unknown" | "none";
export type JobLiveStatus = "active" | "closing_soon" | "expired" | "uncertain";
export type JobDiscoveryRunKind = "scheduled" | "manual";
export type JobDiscoveryRunStatus = "running" | "success" | "partial" | "failed";
export type JobDiscoverySort = "best_fit" | "newest" | "closing_soon" | "salary";

export interface JobSearchPreferences {
  userId: string;
  exactTitles: string[];
  adjacentTitles: string[];
  seniority: string[];
  industries: string[];
  locations: string[];
  salaryMin: number | null;
  salaryCurrency: string;
  workplaceTypes: JobWorkplaceType[];
  employmentTypes: JobEmploymentType[];
  includeUk: boolean;
  includeGlobalUkHireable: boolean;
  includeRelocationSponsorship: boolean;
  emailAlertsEnabled: boolean;
  derivedFromProfileAt: string | null;
  manualOverrides: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface JobSourceRef {
  provider: string;
  sourceUrl: string | null;
  applicationUrl: string | null;
  sourceJobId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface DiscoveredJob {
  id: string;
  userId: string;
  dedupeKey: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  descriptionWordCount: number;
  industry: string | null;
  seniority: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryText: string | null;
  workplaceType: JobWorkplaceType | null;
  employmentType: JobEmploymentType | null;
  datePosted: string | null;
  closingDate: string | null;
  ukEligibility: JobUkEligibility;
  visaSponsorship: JobVisaSponsorship;
  matchType: JobMatchType;
  sourceRefs: JobSourceRef[];
  preferredSourceUrl: string | null;
  preferredApplyUrl: string | null;
  status: JobLiveStatus;
  statusReason: string;
  lastStatusCheckAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  archivedAt: string | null;
  saved: boolean;
  fitScore: number | null;
  fitVerdict: Verdict | null;
  fitStrategy: ScanResult["strategy"] | null;
  fitScoredAt: string | null;
  fitDescriptionSignature: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobDiscoveryFilters {
  search: string;
  fitBands: Verdict[];
  sources: string[];
  matchTypes: JobMatchType[];
  industries: string[];
  seniority: string[];
  locations: string[];
  workplaceTypes: JobWorkplaceType[];
  employmentTypes: JobEmploymentType[];
  ukScopes: JobUkEligibility[];
  sponsorship: JobVisaSponsorship[];
  statuses: JobLiveStatus[];
  minSalary: number | null;
  postedWithinDays: number | null;
  closingSoonOnly: boolean;
  savedOnly: boolean;
  newTodayOnly: boolean;
}

export interface JobDiscoveryRun {
  id: string;
  userId: string;
  runKind: JobDiscoveryRunKind;
  runDay: string;
  startedAt: string;
  completedAt: string | null;
  status: JobDiscoveryRunStatus;
  sourceResults: Record<string, unknown>;
  newJobs: number;
  updatedJobs: number;
  archivedJobs: number;
  emailSentAt: string | null;
  errorSummary: string | null;
}

export interface JobStatusEvaluation {
  status: JobLiveStatus;
  reason: string;
}
