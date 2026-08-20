import "@/test/dom";
import "@/test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrivateCareerOsProvider } from "@/lib/auth/auth-context";
import { createCareerOsData } from "@/lib/careeros/profile-data";
import { textSignature } from "@/lib/careeros/review-signature";
import { getRouter } from "@/router";
import { Route as ApplicationRoute } from "@/routes/applications.$id";

const { createRepository } = vi.hoisted(() => ({
  createRepository: vi.fn(),
}));

vi.mock("@/lib/careeros/cloud-state.repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/careeros/cloud-state.repository")>(
    "@/lib/careeros/cloud-state.repository",
  );
  return { ...actual, createSupabaseCareerStateRepository: createRepository };
});

const authorisedUser = { id: "user-123", email: "vjk16416@gmail.com" };

function makeRepository() {
  const data = createCareerOsData();
  const description =
    "Own paid media budgets, report to senior stakeholders, run A/B tests and deliver cross-functional growth projects. ".repeat(
      6,
    );

  data.jobs = [
    {
      id: "job-test",
      company: "Example Co",
      title: "Growth Marketing Manager",
      location: "London",
      description,
      createdAt: "2026-08-20T00:00:00.000Z",
      sourceType: "paste",
      extractionMethod: "manual",
      extractionCompleteness: "manual",
      descriptionWordCount: 72,
    },
  ];
  data.applications = [
    {
      id: "app-test",
      jobId: "job-test",
      company: "Example Co",
      title: "Growth Marketing Manager",
      location: "London",
      workingArrangement: "Hybrid",
      employmentType: "Permanent",
      priority: "High",
      stage: "Preparing",
      dateAdded: "2026-08-20T00:00:00.000Z",
      notes: "Reviewer regression fixture",
      nextAction: "Run final review",
      compatibilityScore: 75,
      linkedCvId: "cv-test",
      history: [],
    },
  ];
  data.cvs = [
    {
      id: "cv-test",
      name: "Growth Marketing Manager | Example Co",
      category: "General",
      status: "Draft",
      applicationId: "app-test",
      jobId: "job-test",
      updatedAt: "2026-08-20T00:00:00.000Z",
      versions: [
        {
          id: "cvv-2",
          version: 2,
          createdAt: "2026-08-20T00:00:00.000Z",
          note: "Latest draft",
          body: [
            "# Vinnie Jegathees",
            "## Professional Experience",
            "- Managed paid media budgets and reported performance to senior stakeholders.",
            "- Delivered landing-page and A/B testing work with website and stakeholder teams.",
          ].join("\n"),
          evidenceIds: ["ev-budget", "ev-ab"],
        },
      ],
    },
  ];
  data.coverLetters = [
    {
      id: "cl-2",
      applicationId: "app-test",
      jobId: "job-test",
      status: "Draft",
      body: [
        "Dear Hiring Team,",
        "",
        "I am applying for the Growth Marketing Manager role at Example Co.",
        "My verified experience includes paid media budget management, stakeholder reporting and A/B testing.",
        "",
        "Yours sincerely,",
        "Vinnie Jegathees",
      ].join("\n"),
      emailVersion: "Application for Growth Marketing Manager at Example Co",
      evidenceIds: ["ev-budget", "ev-ab"],
      createdAt: "2026-08-20T00:00:00.000Z",
    },
  ];
  data.scans = [
    {
      id: "scan-test",
      jobId: "job-test",
      createdAt: "2026-08-20T00:00:00.000Z",
      jobDescriptionSignature: textSignature(description),
      overall: 75,
      verdict: "Competitive",
      subScores: [],
      strengths: [],
      partials: [],
      gaps: [],
      missingKeywords: [],
      matchedKeywords: [],
      blockedEvidence: [],
      strategy: "Apply with tailored positioning",
      reasons: ["Regression scan"],
      evidenceMap: [
        {
          id: "requirement-test",
          requirement: "Own paid media budgets and report to senior stakeholders",
          category: "Responsibility",
          priority: "Required",
          status: "Covered",
          score: 100,
          evidenceIds: ["ev-budget"],
          profileItemIds: [],
          sourceIds: ["source-test"],
          explanation: "Covered by Verified evidence.",
        },
      ],
    },
  ];

  const row = {
    userId: authorisedUser.id,
    schemaVersion: 1,
    data,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };

  return {
    load: vi.fn().mockResolvedValue(row),
    create: vi.fn().mockResolvedValue(row),
    save: vi.fn().mockImplementation(async (_userId, nextData) => ({ ...row, data: nextData })),
  };
}

function renderWorkspace() {
  const repository = makeRepository();
  createRepository.mockReturnValue(repository);
  vi.spyOn(ApplicationRoute, "useParams").mockReturnValue({ id: "app-test" });
  const router = getRouter();
  const queryClient = new QueryClient();
  const Workspace = ApplicationRoute.options.component!;

  render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <PrivateCareerOsProvider authUser={authorisedUser}>
          <Workspace />
        </PrivateCareerOsProvider>
      </QueryClientProvider>
    </RouterContextProvider>,
  );

  return repository;
}

function openTab(name: "Job" | "Match" | "Evidence" | "CV" | "Cover Letter" | "Apply") {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), {
    button: 0,
    ctrlKey: false,
  });
}

async function runPassingReview() {
  openTab("Apply");
  fireEvent.click(screen.getByRole("button", { name: "Run final review" }));
  expect(screen.getByText("Reviewer status: READY FOR VINNIE APPROVAL")).toBeInTheDocument();
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("Sprint 6 final-review regressions", () => {
  it("reaches READY TO APPLY only after review and both explicit approvals", async () => {
    renderWorkspace();
    await screen.findByRole("heading", { name: "Growth Marketing Manager" });
    await runPassingReview();

    openTab("CV");
    fireEvent.click(screen.getByRole("button", { name: "Approve latest version" }));
    openTab("Cover Letter");
    fireEvent.click(screen.getByRole("button", { name: "Approve latest cover letter" }));
    openTab("Apply");

    expect(screen.getByText("Reviewer status: READY TO APPLY")).toBeInTheDocument();
    expect(screen.getByText("Reviewer: READY TO APPLY")).toBeInTheDocument();
  });

  it("marks the previous review outdated after a new CV draft", async () => {
    renderWorkspace();
    await screen.findByRole("heading", { name: "Growth Marketing Manager" });
    await runPassingReview();

    openTab("CV");
    fireEvent.click(screen.getByRole("button", { name: "New draft" }));
    openTab("Apply");

    expect(screen.getByText("Reviewer status: REVIEW OUTDATED")).toBeInTheDocument();
  });

  it("marks the previous review outdated after a new cover-letter draft", async () => {
    renderWorkspace();
    await screen.findByRole("heading", { name: "Growth Marketing Manager" });
    await runPassingReview();

    openTab("Cover Letter");
    fireEvent.click(screen.getByRole("button", { name: "New cover letter draft" }));
    openTab("Apply");

    expect(screen.getByText("Reviewer status: REVIEW OUTDATED")).toBeInTheDocument();
  });

  it("blocks final review when the JD has unsaved changes", async () => {
    renderWorkspace();
    await screen.findByRole("heading", { name: "Growth Marketing Manager" });

    openTab("Job");
    fireEvent.change(screen.getByLabelText("Job description"), {
      target: { value: `${screen.getByLabelText("Job description").getAttribute("value") ?? ""} Changed` },
    });
    openTab("Apply");

    expect(screen.getByText("Scan: Needs re-scan")).toBeInTheDocument();
    expect(
      screen.getByText("Save the job description and re-run the role scan before final review."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run final review" })).toBeDisabled();
  });

  it("marks the previous review outdated after a new role scan", async () => {
    renderWorkspace();
    await screen.findByRole("heading", { name: "Growth Marketing Manager" });
    await runPassingReview();

    openTab("Job");
    fireEvent.click(screen.getByRole("button", { name: "Run scan" }));
    openTab("Apply");

    expect(screen.getByText("Reviewer status: REVIEW OUTDATED")).toBeInTheDocument();
  });

  it("persists every final-review run as immutable history", async () => {
    const repository = renderWorkspace();
    await screen.findByRole("heading", { name: "Growth Marketing Manager" });

    openTab("Apply");
    fireEvent.click(screen.getByRole("button", { name: "Run final review" }));
    fireEvent.click(screen.getByRole("button", { name: "Re-run final review" }));

    await waitFor(() => {
      const savedStates = repository.save.mock.calls.map((call) => call[1]);
      expect(savedStates.some((state) => (state.reviewRuns ?? []).length >= 2)).toBe(true);
    });
  });
});
