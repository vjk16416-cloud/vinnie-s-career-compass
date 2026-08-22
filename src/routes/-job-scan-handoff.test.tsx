import "@/test/dom";
import "@/test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivateCareerOsProvider } from "@/lib/auth/auth-context";
import { storeDiscoveredJobForAnalysis } from "@/lib/careeros/job-handoff";
import { createCareerOsData } from "@/lib/careeros/profile-data";
import type { DiscoveredJob } from "@/lib/careeros/job-discovery";
import { getRouter } from "@/router";
import { Route as JobScanRoute } from "@/routes/job-scan";

const { createRepository } = vi.hoisted(() => ({ createRepository: vi.fn() }));

vi.mock("@/lib/careeros/cloud-state.repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/careeros/cloud-state.repository")>(
    "@/lib/careeros/cloud-state.repository",
  );
  return { ...actual, createSupabaseCareerStateRepository: createRepository };
});

const authorisedUser = { id: "user-123", email: "vjk16416@gmail.com" };

function repository() {
  const row = {
    userId: authorisedUser.id,
    schemaVersion: 1,
    data: createCareerOsData(),
    createdAt: "2026-08-22T12:00:00.000Z",
    updatedAt: "2026-08-22T12:00:00.000Z",
  };
  return {
    load: vi.fn().mockResolvedValue(row),
    create: vi.fn().mockResolvedValue(row),
    save: vi.fn().mockImplementation(async (_userId, data) => ({ ...row, data })),
  };
}

const discoveredJob: DiscoveredJob = {
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
  employmentType: "Permanent",
  salary: "£65k - £80k",
  description:
    "Own product strategy, roadmap, stakeholder management, agile delivery and cross-functional product launches. ".repeat(
      12,
    ),
  tags: ["Product", "Strategy"],
  sourceUrl: "https://remotive.com/remote-jobs/product/product-manager-42",
  postedAt: "2026-08-21T12:00:00.000Z",
  fetchedAt: "2026-08-22T12:00:00.000Z",
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.clearAllMocks();
});

describe("Job Board to Job Scan handoff", () => {
  it("prefills Job Scan without creating an application or scan", async () => {
    const repo = repository();
    createRepository.mockReturnValue(repo);
    const key = storeDiscoveredJobForAnalysis(discoveredJob);
    window.history.replaceState({}, "", `/job-scan?discovered=${encodeURIComponent(key)}`);

    const router = getRouter();
    const queryClient = new QueryClient();
    const JobScan = JobScanRoute.options.component!;
    render(
      <RouterContextProvider router={router}>
        <QueryClientProvider client={queryClient}>
          <PrivateCareerOsProvider authUser={authorisedUser}>
            <JobScan />
          </PrivateCareerOsProvider>
        </QueryClientProvider>
      </RouterContextProvider>,
    );

    await screen.findByRole("heading", { name: "Job Scan" });
    expect(screen.getByLabelText("Role title")).toHaveValue("Product Manager");
    expect(screen.getByLabelText("Company")).toHaveValue("Remote Co");
    expect(screen.getByLabelText("Location")).toHaveValue("UK, Europe");
    expect(screen.getByLabelText("Working arrangement")).toHaveValue("Remote");
    expect(screen.getByLabelText("Job description")).toHaveValue(discoveredJob.description);
    expect(screen.getByRole("button", { name: "Analyse role" })).toBeEnabled();
    expect(repo.save).not.toHaveBeenCalled();
  });
});
