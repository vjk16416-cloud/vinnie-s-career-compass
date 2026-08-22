import { htmlToText } from "./job-extract.server";
import type {
  DiscoveryEnv,
  JobDiscoveryAdapter,
  JobDiscoveryQuery,
  JobDiscoverySourceResult,
  RawJobListing,
} from "./job-discovery.providers";
import type { JobEmploymentType, JobUkEligibility } from "./job-discovery.types";

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dateOnly(value: unknown): string | null {
  const valueText = text(value);
  if (!valueText) return null;
  const date = new Date(valueText);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function employmentType(value: unknown): JobEmploymentType | null {
  const normalised = text(value)?.toLowerCase().replace(/[- ]/g, "_");
  if (normalised === "contract" || normalised === "freelance") return "Contract";
  if (normalised === "fixed_term" || normalised === "temporary") return "Fixed-term";
  return null;
}

function salaryCurrency(value: string | null) {
  if (!value) return null;
  if (value.includes("£")) return "GBP";
  if (value.includes("€")) return "EUR";
  if (value.includes("$")) return "USD";
  return null;
}

function ukEligibility(value: unknown): JobUkEligibility {
  const location = text(value)?.toLowerCase();
  if (!location) return "unknown";
  if (/\b(worldwide|anywhere|global)\b/.test(location)) return "confirmed";
  if (/\b(united kingdom|uk|great britain|england|scotland|wales|northern ireland)\b/.test(location)) {
    return "confirmed";
  }
  if (/\b(europe|emea)\b/.test(location)) return "likely";
  if (
    /\b(usa|u\.s\.|united states|canada)\b/.test(location) &&
    !/\b(europe|emea|worldwide|anywhere|global|united kingdom|uk)\b/.test(location)
  ) {
    return "excluded";
  }
  return "unknown";
}

function mapJob(value: unknown): RawJobListing | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const title = text(row.title);
  const company = text(row.company_name);
  const url = text(row.url);
  if (!title || !company || !url) return null;

  const salary = text(row.salary);
  const rawDescription = text(row.description);
  const description = rawDescription ? htmlToText(rawDescription) : null;
  const location = text(row.candidate_required_location);

  return {
    provider: "Remotive",
    sourceJobId: text(row.id),
    title,
    company,
    location,
    description,
    industry: text(row.category),
    seniority: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: salaryCurrency(salary),
    salaryText: salary,
    workplaceType: "Remote",
    employmentType: employmentType(row.job_type),
    datePosted: dateOnly(row.publication_date),
    closingDate: null,
    sourceUrl: url,
    applicationUrl: url,
    providerActive: true,
    ukEligibility: ukEligibility(row.candidate_required_location),
    visaSponsorship: "unknown",
  };
}

async function search(
  input: JobDiscoveryQuery,
  env: DiscoveryEnv,
): Promise<JobDiscoverySourceResult> {
  const url = new URL("https://remotive.com/api/remote-jobs");
  if (input.what.trim()) url.searchParams.set("search", input.what.trim());
  url.searchParams.set("limit", String(Math.min(50, Math.max(1, Math.trunc(input.resultsPerPage)))));

  const fetchImpl = env.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return {
        status: "error",
        jobs: [],
        message: `Remotive returned status ${response.status}.`,
      };
    }

    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== "object") {
      return { status: "error", jobs: [], message: "Remotive returned an invalid response." };
    }
    const jobs = (payload as Record<string, unknown>).jobs;
    if (!Array.isArray(jobs)) {
      return { status: "error", jobs: [], message: "Remotive returned an invalid response." };
    }

    return {
      status: "success",
      jobs: jobs.map(mapJob).filter((job): job is RawJobListing => Boolean(job)),
    };
  } catch {
    return { status: "error", jobs: [], message: "Remotive could not be reached." };
  }
}

export const remotiveAdapter: JobDiscoveryAdapter = {
  id: "remotive",
  label: "Remotive",
  isConfigured: () => true,
  search,
};
