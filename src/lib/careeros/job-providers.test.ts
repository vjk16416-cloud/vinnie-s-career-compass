import { describe, expect, it, vi } from "vitest";
import { fetchArbeitnowUkJobs, fetchRemotiveJobs } from "./job-providers";

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

describe("Job Board providers", () => {
  it("normalises Arbeitnow UK jobs and marks roles returned by the sponsorship feed", async () => {
    const base = {
      data: [
        {
          slug: "product-manager-london-1",
          company_name: "Example Co",
          title: "Product Manager",
          description: "<p>Lead <strong>product delivery</strong> and stakeholder work.</p>",
          remote: false,
          url: "https://www.arbeitnow.co.uk/jobs/product-manager-london-1",
          tags: ["Product"],
          job_types: ["Full-time"],
          location: "London",
          created_at: 1787300000,
        },
      ],
    };
    const sponsored = { data: [{ ...base.data[0], visa_sponsorship: true }] };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(base))
      .mockResolvedValueOnce(jsonResponse(sponsored)) as unknown as typeof fetch;

    const jobs = await fetchArbeitnowUkJobs({ fetchImpl, includeVisaSponsorship: true });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      provider: "arbeitnow-uk",
      providerLabel: "Arbeitnow UK",
      title: "Product Manager",
      company: "Example Co",
      location: "London",
      employmentType: "Full-time",
      visaSponsorship: true,
    });
    expect(jobs[0]?.description).toContain("Lead product delivery");
    expect(jobs[0]?.description).not.toContain("<strong>");
  });

  it("normalises Remotive jobs and preserves Remotive as the application source", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        jobs: [
          {
            id: 42,
            url: "https://remotive.com/remote-jobs/product/product-manager-42",
            title: "Product Manager",
            company_name: "Remote Co",
            category: "Product",
            job_type: "full_time",
            publication_date: "2026-08-21T12:00:00Z",
            candidate_required_location: "UK, Europe",
            salary: "£65k - £80k",
            description: "<p>Own product strategy and cross-functional delivery.</p>",
            tags: ["Product Management", "Strategy"],
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const jobs = await fetchRemotiveJobs({ fetchImpl });

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: "remotive:42",
      provider: "remotive",
      providerLabel: "Remotive",
      remote: true,
      remoteRegion: "UK, Europe",
      sourceUrl: "https://remotive.com/remote-jobs/product/product-manager-42",
      salary: "£65k - £80k",
    });
  });

  it("throws a provider-specific error on a failed feed request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 503)) as unknown as typeof fetch;

    await expect(fetchRemotiveJobs({ fetchImpl })).rejects.toThrow("Remotive responded with status 503");
  });
});
