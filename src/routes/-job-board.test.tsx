import "@/test/dom";
import "@/test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivateCareerOsProvider } from "@/lib/auth/auth-context";
import { createCareerOsData } from "@/lib/careeros/profile-data";
import { getRouter } from "@/router";
import { Route as JobBoardRoute } from "@/routes/jobs";

const { createRepository, discoverJobs } = vi.hoisted(() => ({
  createRepository: vi.fn(),
  discoverJobs: vi.fn(),
}));

vi.mock("@/lib/careeros/cloud-state.repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/careeros/cloud-state.repository")>(
    "@/lib/careeros/cloud-state.repository",
  );
  return { ...actual, createSupabaseCareerStateRepository: createRepository };
});

vi.mock("@/lib/careeros/job-board.functions", () => ({ discoverJobs }));

const authorisedUser = { id: "user-123", email: "vjk16416@gmail.com" };

function makeRepository() {
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

function renderBoard(repository = makeRepository()) {
  createRepository.mockReturnValue(repository);
  const router = getRouter();
  const queryClient = new QueryClient();
  const JobBoard = JobBoardRoute.options.component!;

  render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <PrivateCareerOsProvider authUser={authorisedUser}>
          <JobBoard />
        </PrivateCareerOsProvider>
      </QueryClientProvider>
    </RouterContextProvider>,
  );

  return repository;
}

const remotiveJob = {
  id: "remotive:42",
  provider: "remotive" as const,
  providerLabel: "Remotive",
  providerJobId: "42",
  title: "Product Manager",
  company: "Remote Co",
  location: "UK, Europe",
  remote: true,
  remoteRegion: "UK, Europe",
  visaSponsorship: null,
  employmentType: "full_time",
  salary: "£65k - £80k",
  description:
    "Own product strategy, roadmap, stakeholder management, agile delivery and cross-functional product launches. ".repeat(
      8,
    ),
  tags: ["Product Management", "Strategy"],
  sourceUrl: "https://remotive.com/remote-jobs/product/product-manager-42",
  postedAt: new Date().toISOString(),
  fetchedAt: new Date().toISOString(),
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe("CareerOS Job Board", () => {
  it("renders ranked live jobs with Remotive attribution and source link", async () => {
    discoverJobs.mockResolvedValue({
      jobs: [remotiveJob],
      warnings: [],
      fetchedAt: new Date().toISOString(),
    });
    renderBoard();

    expect(await screen.findByRole("heading", { name: "Product Manager" })).toBeInTheDocument();
    expect(screen.getByText("Source: Remotive")).toBeInTheDocument();
    expect(screen.getByText("Remote")).toBeInTheDocument();
    expect(screen.getAllByText(/discovery match/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /open source/i })).toHaveAttribute(
      "href",
      remotiveJob.sourceUrl,
    );
    expect(screen.getByRole("button", { name: "Analyse role" })).toBeEnabled();
  });

  it("shows available results alongside a partial-provider warning", async () => {
    discoverJobs.mockResolvedValue({
      jobs: [remotiveJob],
      warnings: ["Arbeitnow UK is temporarily unavailable."],
      fetchedAt: new Date().toISOString(),
    });
    renderBoard();

    expect(await screen.findByText(/Arbeitnow UK is temporarily unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Product Manager" })).toBeInTheDocument();
  });

  it("persists edited Job Board preferences through the existing cloud state save", async () => {
    discoverJobs.mockResolvedValue({
      jobs: [remotiveJob],
      warnings: [],
      fetchedAt: new Date().toISOString(),
    });
    const repository = renderBoard();

    await screen.findByRole("heading", { name: "Product Manager" });
    const remoteToggle = screen.getByLabelText("Include genuine remote roles");
    fireEvent.click(remoteToggle);
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => {
      const savedStates = repository.save.mock.calls.map((call) => call[1]);
      expect(
        savedStates.some(
          (data) =>
            (data.settings as { jobSearchPreferences?: { includeRemote?: boolean } })
              .jobSearchPreferences?.includeRemote === false,
        ),
      ).toBe(true);
    });
  });
});
