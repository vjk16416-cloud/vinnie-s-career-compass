import { describe, expect, it, vi } from "vitest";

import { adzunaAdapter } from "./job-discovery.adzuna";
import type { DiscoveryEnv, JobDiscoveryQuery } from "./job-discovery.providers";

const query: JobDiscoveryQuery = {
  country: "gb",
  page: 1,
  resultsPerPage: 20,
  what: "Senior Product Manager",
  where: "London",
  salaryMin: 80000,
  employmentTypes: ["Permanent"],
};

function env(overrides: Partial<DiscoveryEnv> = {}): DiscoveryEnv {
  return {
    ADZUNA_APP_ID: "app-id",
    ADZUNA_APP_KEY: "app-key",
    fetchImpl: vi.fn(),
    ...overrides,
  };
}

describe("Adzuna discovery adapter", () => {
  it("does not make a request when Adzuna credentials are missing", async () => {
    const fetchImpl = vi.fn();
    const result = await adzunaAdapter.search(query, {
      ADZUNA_APP_ID: undefined,
      ADZUNA_APP_KEY: undefined,
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "unavailable",
      jobs: [],
      message: "Adzuna is not configured.",
    });
  });

  it("uses the official HTTPS search endpoint and server-side credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: "adz-1",
              title: "Senior Product Manager",
              description: "Own product strategy and delivery.",
              redirect_url: "https://www.adzuna.co.uk/jobs/details/adz-1",
              created: "2026-08-22T08:30:00Z",
              salary_min: 85000,
              salary_max: 100000,
              company: { display_name: "Acme" },
              location: { display_name: "London" },
              category: { label: "IT Jobs" },
              contract_type: "permanent",
              contract_time: "full_time",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await adzunaAdapter.search(query, env({ fetchImpl }));

    expect(result.status).toBe("success");
    expect(result.jobs).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetchImpl.mock.calls[0]!;
    const url = new URL(String(requestUrl));
    expect(url.origin).toBe("https://api.adzuna.com");
    expect(url.pathname).toBe("/v1/api/jobs/gb/search/1");
    expect(url.searchParams.get("app_id")).toBe("app-id");
    expect(url.searchParams.get("app_key")).toBe("app-key");
    expect(url.searchParams.get("what")).toBe("Senior Product Manager");
    expect(url.searchParams.get("where")).toBe("London");
    expect(url.searchParams.get("salary_min")).toBe("80000");
    expect(url.searchParams.get("permanent")).toBe("1");
    expect(url.searchParams.get("results_per_page")).toBe("20");
    expect(init).toMatchObject({ headers: { Accept: "application/json" } });
  });

  it("maps Adzuna results to the provider-neutral raw listing contract", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: "adz-1",
              title: "Product Lead",
              description: "Lead product discovery, delivery and stakeholder alignment.",
              redirect_url: "https://www.adzuna.co.uk/jobs/details/adz-1",
              created: "2026-08-21T08:30:00Z",
              salary_min: 90000,
              salary_max: 110000,
              company: { display_name: "Example Co" },
              location: { display_name: "Remote, UK" },
              category: { label: "IT Jobs" },
              contract_type: "contract",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await adzunaAdapter.search(query, env({ fetchImpl }));
    expect(result).toEqual({
      status: "success",
      jobs: [
        expect.objectContaining({
          provider: "Adzuna",
          sourceJobId: "adz-1",
          title: "Product Lead",
          company: "Example Co",
          location: "Remote, UK",
          industry: "IT Jobs",
          salaryMin: 90000,
          salaryMax: 110000,
          employmentType: "Contract",
          sourceUrl: "https://www.adzuna.co.uk/jobs/details/adz-1",
          providerActive: true,
        }),
      ],
    });
  });

  it("returns a source-level error instead of crashing the discovery run", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("Rate limit", { status: 429 }));
    const result = await adzunaAdapter.search(query, env({ fetchImpl }));

    expect(result.status).toBe("error");
    expect(result.jobs).toEqual([]);
    expect(result.message).toContain("429");
  });

  it("returns a source-level error for invalid JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("not-json", { status: 200 }));
    const result = await adzunaAdapter.search(query, env({ fetchImpl }));

    expect(result.status).toBe("error");
    expect(result.jobs).toEqual([]);
  });
});
