import { describe, expect, it, vi } from "vitest";

import { remotiveAdapter } from "./job-discovery.remotive";
import type { DiscoveryEnv, JobDiscoveryQuery } from "./job-discovery.providers";

const query: JobDiscoveryQuery = {
  country: "gb",
  page: 1,
  resultsPerPage: 25,
  what: "Product Marketing Manager",
  where: "London, UK",
  salaryMin: null,
  employmentTypes: ["Permanent", "Contract", "Fixed-term"],
};

describe("Remotive discovery adapter", () => {
  it("is configured without private credentials", () => {
    expect(remotiveAdapter.isConfigured({})).toBe(true);
  });

  it("uses the documented public API and maps the Remotive URL as the source link", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jobs: [
            {
              id: 123,
              url: "https://remotive.com/remote-jobs/marketing/product-marketing-manager-123",
              title: "Product Marketing Manager",
              company_name: "Example Co",
              category: "Marketing",
              job_type: "full_time",
              publication_date: "2026-08-21T10:00:00Z",
              candidate_required_location: "Worldwide",
              salary: "$80,000 - $100,000",
              description:
                "<p>Lead product marketing strategy and launches for a global SaaS business.</p>",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const env: DiscoveryEnv = { fetchImpl };

    const result = await remotiveAdapter.search(query, env);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const requested = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(requested.origin + requested.pathname).toBe("https://remotive.com/api/remote-jobs");
    expect(requested.searchParams.get("search")).toBe("Product Marketing Manager");
    expect(requested.searchParams.get("limit")).toBe("25");
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.jobs[0]).toMatchObject({
      provider: "Remotive",
      sourceJobId: "123",
      title: "Product Marketing Manager",
      company: "Example Co",
      workplaceType: "Remote",
      ukEligibility: "confirmed",
      sourceUrl: "https://remotive.com/remote-jobs/marketing/product-marketing-manager-123",
      applicationUrl: "https://remotive.com/remote-jobs/marketing/product-marketing-manager-123",
      providerActive: true,
    });
  });

  it("marks explicitly US-only roles as ineligible from the UK", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jobs: [
            {
              id: 456,
              url: "https://remotive.com/remote-jobs/marketing/marketing-manager-456",
              title: "Marketing Manager",
              company_name: "US Co",
              candidate_required_location: "USA only",
              description:
                "<p>Marketing role restricted to candidates based in the United States.</p>",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await remotiveAdapter.search(query, { fetchImpl });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.jobs[0]?.ukEligibility).toBe("excluded");
  });

  it("returns a source-level error rather than throwing", async () => {
    const result = await remotiveAdapter.search(query, {
      fetchImpl: vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })),
    });
    expect(result).toEqual({
      status: "error",
      jobs: [],
      message: "Remotive returned status 429.",
    });
  });
});
