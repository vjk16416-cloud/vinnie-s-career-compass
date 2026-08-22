import type { DiscoveryFetch } from "./job-discovery.providers";
import type { JobStatusEvaluation } from "./job-discovery.types";

const PROTECTED_HOSTS = [
  "linkedin.com",
  "indeed.com",
  "indeed.co.uk",
  "reed.co.uk",
  "totaljobs.com",
  "glassdoor.com",
  "glassdoor.co.uk",
];

function protectedHost(url: URL) {
  const host = url.hostname.toLowerCase();
  return PROTECTED_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export async function checkDirectJobStatus(
  value: string,
  fetchImpl: DiscoveryFetch = fetch,
): Promise<JobStatusEvaluation> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { status: "uncertain", reason: "The vacancy URL is not valid." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { status: "uncertain", reason: "Only normal web vacancy URLs can be checked." };
  }
  if (protectedHost(url)) {
    return {
      status: "uncertain",
      reason: "CareerOS does not automate status checks against protected job-board pages.",
    };
  }

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "CareerOS vacancy status checker",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 404 || response.status === 410) {
      return { status: "expired", reason: `The vacancy page returned ${response.status}.` };
    }
    if (response.status === 403 || response.status === 429) {
      return {
        status: "uncertain",
        reason: `The source blocked automated verification with status ${response.status}.`,
      };
    }
    if (!response.ok) {
      return {
        status: "uncertain",
        reason: `The vacancy page returned status ${response.status}, so CareerOS cannot verify it.`,
      };
    }

    const text = (await response.text()).toLowerCase().replace(/\s+/g, " ");
    const explicitlyClosed = [
      "applications are now closed",
      "applications have now closed",
      "this job is no longer available",
      "this vacancy is no longer available",
      "vacancy is closed",
      "position has been filled",
      "role has been filled",
      "job has expired",
      "vacancy has expired",
    ].some((phrase) => text.includes(phrase));

    if (explicitlyClosed) {
      return { status: "expired", reason: "The employer page states that this vacancy is closed." };
    }

    return {
      status: "uncertain",
      reason: "The page loaded, but CareerOS found no reliable signal proving the vacancy is still active.",
    };
  } catch {
    return {
      status: "uncertain",
      reason: "CareerOS could not verify the vacancy page without bypassing site protections.",
    };
  }
}
