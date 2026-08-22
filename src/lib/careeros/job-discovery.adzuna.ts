import type {
  DiscoveryEnv,
  JobDiscoveryAdapter,
  JobDiscoveryQuery,
  JobDiscoverySourceResult,
  RawJobListing,
} from "./job-discovery.providers";
import type { JobEmploymentType } from "./job-discovery.types";

function mappedEmploymentType(value: unknown): JobEmploymentType | null {
  if (value === "permanent") return "Permanent";
  if (value === "contract") return "Contract";
  if (value === "fixed-term" || value === "fixed_term") return "Fixed-term";
  return null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dateOnly(value: unknown): string | null {
  const text = stringValue(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function mapResult(value: unknown, country: string): RawJobListing | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const title = stringValue(row.title);
  const companyRow = row.company && typeof row.company === "object"
    ? (row.company as Record<string, unknown>)
    : null;
  const locationRow = row.location && typeof row.location === "object"
    ? (row.location as Record<string, unknown>)
    : null;
  const categoryRow = row.category && typeof row.category === "object"
    ? (row.category as Record<string, unknown>)
    : null;
  const company = stringValue(companyRow?.display_name);
  if (!title || !company) return null;

  return {
    provider: "Adzuna",
    sourceJobId: stringValue(row.id),
    title,
    company,
    location: stringValue(locationRow?.display_name),
    description: stringValue(row.description),
    industry: stringValue(categoryRow?.label),
    seniority: null,
    salaryMin: numberValue(row.salary_min),
    salaryMax: numberValue(row.salary_max),
    salaryCurrency: country.toLowerCase() === "gb" ? "GBP" : null,
    salaryText: null,
    workplaceType: null,
    employmentType: mappedEmploymentType(row.contract_type),
    datePosted: dateOnly(row.created),
    closingDate: null,
    sourceUrl: stringValue(row.redirect_url),
    applicationUrl: null,
    providerActive: true,
    ukEligibility: "unknown",
    visaSponsorship: "unknown",
  };
}

function addEmploymentFilters(url: URL, employmentTypes: JobEmploymentType[]) {
  if (employmentTypes.includes("Permanent")) url.searchParams.set("permanent", "1");
  if (employmentTypes.includes("Contract")) url.searchParams.set("contract", "1");
}

function configured(env: DiscoveryEnv) {
  return Boolean(env.ADZUNA_APP_ID?.trim() && env.ADZUNA_APP_KEY?.trim());
}

async function search(
  input: JobDiscoveryQuery,
  env: DiscoveryEnv,
): Promise<JobDiscoverySourceResult> {
  if (!configured(env)) {
    return { status: "unavailable", jobs: [], message: "Adzuna is not configured." };
  }

  const fetchImpl = env.fetchImpl ?? fetch;
  const country = input.country.trim().toLowerCase() || "gb";
  const page = Math.max(1, Math.trunc(input.page || 1));
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/${page}`);
  url.searchParams.set("app_id", env.ADZUNA_APP_ID!.trim());
  url.searchParams.set("app_key", env.ADZUNA_APP_KEY!.trim());
  url.searchParams.set("results_per_page", String(Math.max(1, Math.trunc(input.resultsPerPage))));
  if (input.what.trim()) url.searchParams.set("what", input.what.trim());
  if (input.where.trim()) url.searchParams.set("where", input.where.trim());
  if (input.salaryMin != null && Number.isFinite(input.salaryMin)) {
    url.searchParams.set("salary_min", String(Math.round(input.salaryMin)));
  }
  addEmploymentFilters(url, input.employmentTypes);

  try {
    const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return {
        status: "error",
        jobs: [],
        message: `Adzuna returned status ${response.status}.`,
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        status: "error",
        jobs: [],
        message: "Adzuna returned an unreadable response.",
      };
    }

    if (!payload || typeof payload !== "object") {
      return { status: "error", jobs: [], message: "Adzuna returned an invalid response." };
    }

    const results = (payload as Record<string, unknown>).results;
    if (!Array.isArray(results)) {
      return { status: "error", jobs: [], message: "Adzuna returned an invalid response." };
    }

    return {
      status: "success",
      jobs: results
        .map((item) => mapResult(item, country))
        .filter((item): item is RawJobListing => Boolean(item)),
    };
  } catch {
    return {
      status: "error",
      jobs: [],
      message: "Adzuna could not be reached.",
    };
  }
}

export const adzunaAdapter: JobDiscoveryAdapter = {
  id: "adzuna",
  label: "Adzuna",
  isConfigured: configured,
  search,
};
