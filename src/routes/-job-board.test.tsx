import "@/test/dom";
import "@/test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrivateCareerOsProvider } from "@/lib/auth/auth-context";
import { createCareerOsData } from "@/lib/careeros/profile-data";
import { getRouter } from "@/router";
import { Route as JobBoardRoute } from "@/routes/job-board";

const { createRepository } = vi.hoisted(() => ({ createRepository: vi.fn() }));

vi.mock("@/lib/careeros/cloud-state.repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/careeros/cloud-state.repository")>(
    "@/lib/careeros/cloud-state.repository",
  );
  return { ...actual, createSupabaseCareerStateRepository: createRepository };
});

const authorisedUser = { id: "user-123", email: "vjk16416@gmail.com" };
const fullDescription =
  "Lead a cross-functional product programme covering discovery, roadmap planning, stakeholder management, analytics, experimentation, vendor coordination and delivery. The successful candidate will work with product, engineering, marketing and commercial teams, define priorities, manage risks, communicate progress, analyse customer and performance data, support go-to-market activity, improve operating processes and deliver measurable outcomes across multiple workstreams in a fast-moving environment.";

function makeRepository() {
  const data = createCareerOsData();
  data.jobBoardListings = [];
  const row = {
    userId: authorisedUser.id,
    schemaVersion: 1,
    data,
    createdAt: "2026-08-19T09:47:05.000Z",
    updatedAt: "2026-08-19T09:48:16.000Z",
  };
  return {
    load: vi.fn().mockResolvedValue(row),
    create: vi.fn().mockResolvedValue(row),
    save: vi.fn().mockImplementation(async (_userId, nextData) => ({ ...row, data: nextData })),
  };
}

function renderJobBoard(repository = makeRepository()) {
  createRepository.mockReturnValue(repository);
  const router = getRouter();
  const queryClient = new QueryClient();
  const JobBoardPage = JobBoardRoute.options.component!;

  render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <PrivateCareerOsProvider authUser={authorisedUser}>
          <JobBoardPage />
        </PrivateCareerOsProvider>
      </QueryClientProvider>
    </RouterContextProvider>,
  );

  return { repository, router };
}

async function addListing() {
  fireEvent.change(screen.getByLabelText("Role title"), {
    target: { value: "Senior Product Manager" },
  });
  fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Acme" } });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "London" } });
  fireEvent.change(screen.getByLabelText("Job description"), {
    target: { value: fullDescription },
  });
  fireEvent.change(screen.getByLabelText("Source name"), {
    target: { value: "Acme Careers" },
  });
  fireEvent.change(screen.getByLabelText("Original source URL"), {
    target: { value: "https://example.com/jobs/123" },
  });
  fireEvent.change(screen.getByLabelText("Application URL"), {
    target: { value: "https://example.com/jobs/123/apply" },
  });
  fireEvent.change(screen.getByLabelText("Salary"), {
    target: { value: "£80,000 - £95,000" },
  });
  fireEvent.change(
    screen.getByLabelText("Working arrangement", { selector: "#job-board-workplace" }),
    { target: { value: "Hybrid" } },
  );
  fireEvent.change(
    screen.getByLabelText("Employment type", { selector: "#job-board-employment" }),
    { target: { value: "Permanent" } },
  );
  fireEvent.change(screen.getByLabelText("Closing date"), {
    target: { value: "2026-09-30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add to Job Board" }));

  await screen.findByRole("heading", { name: "Senior Product Manager" });
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("structured Job Board workflow", () => {
  it("requires title, company and description before adding a listing", async () => {
    renderJobBoard();
    await screen.findByRole("heading", { name: "Job Board" });

    fireEvent.click(screen.getByRole("button", { name: "Add to Job Board" }));

    expect(
      await screen.findByText("Add a role title, company and job description."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Unspecified role" })).not.toBeInTheDocument();
  });

  it("persists structured source data and lets the user save and filter a listing", async () => {
    const { repository } = renderJobBoard();
    await screen.findByRole("heading", { name: "Job Board" });
    await addListing();

    await waitFor(() => {
      const savedStates = repository.save.mock.calls.map((call) => call[1]);
      expect(
        savedStates.some((data) => {
          const listing = data.jobBoardListings?.[0];
          return (
            listing?.title === "Senior Product Manager" &&
            listing.company === "Acme" &&
            listing.sourceName === "Acme Careers" &&
            listing.sourceUrl === "https://example.com/jobs/123" &&
            listing.applyUrl === "https://example.com/jobs/123/apply" &&
            listing.salary === "£80,000 - £95,000" &&
            listing.workplaceType === "Hybrid" &&
            listing.employmentType === "Permanent" &&
            listing.closingDate === "2026-09-30"
          );
        }),
      ).toBe(true);
    });

    expect(screen.getByRole("link", { name: "Open original" })).toHaveAttribute(
      "href",
      "https://example.com/jobs/123",
    );
    expect(screen.getByRole("link", { name: "Apply at source" })).toHaveAttribute(
      "href",
      "https://example.com/jobs/123/apply",
    );

    fireEvent.click(screen.getByRole("button", { name: "Save job" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Unsave job" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByLabelText("Saved jobs only"));
    expect(screen.getByRole("heading", { name: "Senior Product Manager" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search jobs"), { target: { value: "no-match" } });
    expect(screen.queryByRole("heading", { name: "Senior Product Manager" })).not.toBeInTheDocument();
  });

  it("analyses a structured listing with the existing scoring engine before creating an application", async () => {
    const { repository, router } = renderJobBoard();
    await screen.findByRole("heading", { name: "Job Board" });
    await addListing();

    expect(screen.getByRole("button", { name: "Create application" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Analyse role" }));

    await waitFor(() => {
      const savedStates = repository.save.mock.calls.map((call) => call[1]);
      expect(
        savedStates.some((data) => {
          const job = data.jobs?.[0];
          const scan = data.scans?.[0];
          return (
            job?.sourceType === "board" &&
            job.boardListingId &&
            job.description === fullDescription &&
            job.extractionMethod === "structured" &&
            scan?.jobId === job.id
          );
        }),
      ).toBe(true);
    });

    expect(await screen.findByText(/compatibility/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create application" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Create application" }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/applications\//));
    await waitFor(() => {
      const savedStates = repository.save.mock.calls.map((call) => call[1]);
      expect(
        savedStates.some((data) => {
          const application = data.applications?.[0];
          return (
            application?.company === "Acme" &&
            application.title === "Senior Product Manager" &&
            application.workingArrangement === "Hybrid" &&
            application.employmentType === "Permanent" &&
            application.salary === "£80,000 - £95,000" &&
            application.deadline === "2026-09-30" &&
            application.url === "https://example.com/jobs/123/apply" &&
            typeof application.compatibilityScore === "number"
          );
        }),
      ).toBe(true);
    });
  });

  it("blocks analysis when the stored description is too short", async () => {
    renderJobBoard();
    await screen.findByRole("heading", { name: "Job Board" });

    fireEvent.change(screen.getByLabelText("Role title"), { target: { value: "Product Manager" } });
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Job description"), {
      target: { value: "Short description with too little detail to analyse safely." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to Job Board" }));

    await screen.findByRole("heading", { name: "Product Manager" });
    fireEvent.click(screen.getByRole("button", { name: "Analyse role" }));

    expect(
      await screen.findByText("Add at least 40 words before analysing this role."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create application" })).toBeDisabled();
  });
});
