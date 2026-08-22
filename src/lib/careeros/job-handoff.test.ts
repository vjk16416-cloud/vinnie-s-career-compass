import { afterEach, describe, expect, it } from "vitest";
import {
  consumeDiscoveredJobForAnalysis,
  storeDiscoveredJobForAnalysis,
} from "./job-handoff";
import type { DiscoveredJob } from "./job-discovery";

const job: DiscoveredJob = {
  id: "remotive:42",
  provider: "remotive",
  providerLabel: "Remotive",
  providerJobId: "42",
  title: "Product Manager",
  company: "Remote Co",
  location: "UK, Europe",
  remote: true,
  remoteRegion: "UK, Europe",
  visaSponsorship: null,
  employmentType: "full_time",
  salary: "",
  description: "Own product strategy and cross-functional delivery. ".repeat(12),
  tags: ["Product"],
  sourceUrl: "https://remotive.com/remote-jobs/product/product-manager-42",
  postedAt: "2026-08-21T12:00:00.000Z",
  fetchedAt: "2026-08-22T12:00:00.000Z",
};

afterEach(() => window.sessionStorage.clear());

describe("Job Board analysis handoff", () => {
  it("stores and consumes a discovered vacancy exactly once", () => {
    const key = storeDiscoveredJobForAnalysis(job);

    expect(consumeDiscoveredJobForAnalysis(key)).toEqual(job);
    expect(consumeDiscoveredJobForAnalysis(key)).toBeNull();
  });

  it("rejects malformed handoff payloads", () => {
    window.sessionStorage.setItem("careeros:discovered-job:bad", JSON.stringify({ title: "Only title" }));

    expect(consumeDiscoveredJobForAnalysis("bad")).toBeNull();
  });
});
