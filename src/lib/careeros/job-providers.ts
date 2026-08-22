import { htmlToText } from "./job-extract.server";
import type { DiscoveredJob } from "./job-discovery";

type FetchLike = typeof fetch;

const ARBEITNOW_UK_URL = "https://www.arbeitnow.co.uk/api/job-board-api";
const REMOTIVE_URL = "https://remotive.com/api/remote-jobs";

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isoFromEpoch(value: unknown): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  const milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function isoDate(value: unknown): string {
  const text = stringValue(value);
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function responseError(provider: string, status: number): Error {
  return new Error(`${provider} responded with status ${status}.`);
}

async function fetchJson(fetchImpl: FetchLike, url: string, provider: string): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw responseError(provider, response.status);
  return response.json();
}

function normaliseArbeitnowItem(
  raw: unknown,
  fetchedAt: string,
  sponsoredFeed: boolean,
): DiscoveredJob | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const providerJobId = stringValue(item.slug);
  const title = stringValue(item.title);
  const company = stringValue(item.company_name);
  const sourceUrl = stringValue(item.url);
  const rawDescription = stringValue(item.description);

  if (!providerJobId || !title || !company || !sourceUrl || !rawDescription) return null;

  const explicitVisa =
    typeof item.visa_sponsorship === "boolean" ? item.visa_sponsorship : sponsoredFeed ? true : null;

  return {
    id: `arbeitnow-uk:${providerJobId}`,
    provider: "arbeitnow-uk",
    providerLabel: "Arbeitnow UK",
    providerJobId,
    title,
    company,
    location: stringValue(item.location) || "United Kingdom",
    remote: item.remote === true,
    remoteRegion: item.remote === true ? "United Kingdom / provider specified" : "",
    visaSponsorship: explicitVisa,
    employmentType: stringList(item.job_types).join(", "),
    salary: "",
    description: htmlToText(rawDescription),
    tags: stringList(item.tags),
    sourceUrl,
    postedAt: isoFromEpoch(item.created_at),
    fetchedAt,
  };
}

export async function fetchArbeitnowUkJobs({
  fetchImpl = fetch,
  includeVisaSponsorship = true,
}: {
  fetchImpl?: FetchLike;
  includeVisaSponsorship?: boolean;
} = {}): Promise<DiscoveredJob[]> {
  const fetchedAt = new Date().toISOString();
  const requests: Promise<{ payload: unknown; sponsoredFeed: boolean }>[] = [
    fetchJson(fetchImpl, ARBEITNOW_UK_URL, "Arbeitnow UK").then((payload) => ({
      payload,
      sponsoredFeed: false,
    })),
  ];

  if (includeVisaSponsorship) {
    requests.push(
      fetchJson(fetchImpl, `${ARBEITNOW_UK_URL}?visa_sponsorship=true`, "Arbeitnow UK").then(
        (payload) => ({ payload, sponsoredFeed: true }),
      ),
    );
  }

  const responses = await Promise.all(requests);
  const jobs: DiscoveredJob[] = [];
  const seen = new Set<string>();

  for (const { payload, sponsoredFeed } of responses) {
    const data =
      payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).data)
        ? ((payload as Record<string, unknown>).data as unknown[])
        : [];

    for (const raw of data) {
      const job = normaliseArbeitnowItem(raw, fetchedAt, sponsoredFeed);
      if (!job) continue;
      const existingIndex = jobs.findIndex((item) => item.providerJobId === job.providerJobId);
      if (existingIndex >= 0) {
        if (job.visaSponsorship === true) jobs[existingIndex] = job;
        continue;
      }
      if (seen.has(job.id)) continue;
      seen.add(job.id);
      jobs.push(job);
    }
  }

  return jobs;
}

function normaliseRemotiveItem(raw: unknown, fetchedAt: string): DiscoveredJob | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const providerJobId = String(item.id ?? "").trim();
  const title = stringValue(item.title);
  const company = stringValue(item.company_name);
  const sourceUrl = stringValue(item.url);
  const rawDescription = stringValue(item.description);

  if (!providerJobId || !title || !company || !sourceUrl || !rawDescription) return null;

  return {
    id: `remotive:${providerJobId}`,
    provider: "remotive",
    providerLabel: "Remotive",
    providerJobId,
    title,
    company,
    location: stringValue(item.candidate_required_location) || "Remote",
    remote: true,
    remoteRegion: stringValue(item.candidate_required_location) || "Worldwide",
    visaSponsorship: null,
    employmentType: stringValue(item.job_type),
    salary: stringValue(item.salary),
    description: htmlToText(rawDescription),
    tags: stringList(item.tags),
    sourceUrl,
    postedAt: isoDate(item.publication_date),
    fetchedAt,
  };
}

export async function fetchRemotiveJobs({
  fetchImpl = fetch,
}: {
  fetchImpl?: FetchLike;
} = {}): Promise<DiscoveredJob[]> {
  const fetchedAt = new Date().toISOString();
  const payload = await fetchJson(fetchImpl, REMOTIVE_URL, "Remotive");
  const jobs =
    payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).jobs)
      ? ((payload as Record<string, unknown>).jobs as unknown[])
      : [];

  return jobs
    .map((raw) => normaliseRemotiveItem(raw, fetchedAt))
    .filter((job): job is DiscoveredJob => Boolean(job));
}
