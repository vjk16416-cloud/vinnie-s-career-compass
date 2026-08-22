import { describe, expect, it } from "vitest";
import { combineJobProviders } from "./job-board.functions";
import type { DiscoveredJob } from "./job-discovery";

function job(id: string, sourceUrl: string): DiscoveredJob {
  return {
    id,
    provider: id.startsWith("remotive") ? "remotive" : "arbeitnow-uk",
    providerLabel: id.startsWith("remotive") ? "Remotive" : "Arbeitnow UK",
    providerJobId: id,
    title: "Product Manager",
    company: "Example Co",
    location: "London, UK",
    remote: false,
    remoteRegion: "",
    visaSponsorship: null,
    employmentType: "Permanent",
    salary: "",
    description: "Product delivery and stakeholder management.",
    tags: ["Product"],
    sourceUrl,
    postedAt: "2026-08-21T12:00:00.000Z",
    fetchedAt: "2026-08-22T12:00:00.000Z",
  };
}

describe("Job Board provider orchestration", () => {
  it("keeps successful results when one provider fails", async () => {
    const result = await combineJobProviders(
      [
        { label: "Arbeitnow UK", load: async () => [job("arbeitnow-1", "https://example.com/1")] },
        { label: "Remotive", load: async () => Promise.reject(new Error("offline")) },
      ],
      "2026-08-22T12:00:00.000Z",
    );

    expect(result.jobs).toHaveLength(1);
    expect(result.warnings).toEqual(["Remotive is temporarily unavailable."]);
  });

  it("deduplicates provider results before returning them", async () => {
    const result = await combineJobProviders([
      { label: "Arbeitnow UK", load: async () => [job("arbeitnow-1", "https://example.com/1")] },
      { label: "Remotive", load: async () => [job("remotive-1", "https://example.com/1")] },
    ]);

    expect(result.jobs).toHaveLength(1);
  });

  it("throws a clear blocking error when every provider fails", async () => {
    await expect(
      combineJobProviders([
        { label: "Arbeitnow UK", load: async () => Promise.reject(new Error("offline")) },
        { label: "Remotive", load: async () => Promise.reject(new Error("offline")) },
      ]),
    ).rejects.toThrow("Live job sources are temporarily unavailable");
  });
});
