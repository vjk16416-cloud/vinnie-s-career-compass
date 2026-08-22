import type {
  JobEmploymentType,
  JobUkEligibility,
  JobVisaSponsorship,
  JobWorkplaceType,
} from "./job-discovery.types";

export type DiscoveryFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface DiscoveryEnv {
  ADZUNA_APP_ID?: string;
  ADZUNA_APP_KEY?: string;
  fetchImpl?: DiscoveryFetch;
}

export interface JobDiscoveryQuery {
  country: string;
  page: number;
  resultsPerPage: number;
  what: string;
  where: string;
  salaryMin: number | null;
  employmentTypes: JobEmploymentType[];
}

export interface RawJobListing {
  provider: string;
  sourceJobId: string | null;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
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
  sourceUrl: string | null;
  applicationUrl: string | null;
  providerActive: boolean | null;
  ukEligibility: JobUkEligibility;
  visaSponsorship: JobVisaSponsorship;
}

export type JobDiscoverySourceResult =
  | { status: "success"; jobs: RawJobListing[] }
  | { status: "unavailable"; jobs: []; message: string }
  | { status: "error"; jobs: []; message: string };

export interface JobDiscoveryAdapter {
  id: string;
  label: string;
  isConfigured(env: DiscoveryEnv): boolean;
  search(input: JobDiscoveryQuery, env: DiscoveryEnv): Promise<JobDiscoverySourceResult>;
}
