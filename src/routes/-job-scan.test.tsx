import "@/test/dom";
import "@/test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrivateCareerOsProvider } from "@/lib/auth/auth-context";
import { createCareerOsData } from "@/lib/careeros/profile-data";
import type { ScanResult } from "@/lib/careeros/types";
import { getRouter } from "@/router";
import { Route as JobScanRoute, ScanResultView } from "@/routes/job-scan";

const { createRepository, extractJobFromUrl } = vi.hoisted(() => ({
  createRepository: vi.fn(),
  extractJobFromUrl: vi.fn(),
}));

vi.mock("@/lib/careeros/cloud-state.repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/careeros/cloud-state.repository")>(
    "@/lib/careeros/cloud-state.repository",
  );
  return { ...actual, createSupabaseCareerStateRepository: createRepository };
});

vi.mock("@/lib/careeros/job-extract.functions", () => ({ extractJobFromUrl }));

const authorisedUser = { id: "user-123", email: "vjk16416@gmail.com" };

function makeRepository() {
  const row = {
    userId: authorisedUser.id,
    schemaVersion: 1,
    data: createCareerOsData(),
    createdAt: "2026-08-19T09:47:05.000Z",
    updatedAt: "2026-08-19T09:48:16.000Z",
  };
  return {
    load: vi.fn().mockResolvedValue(row),
    create: vi.fn().mockResolvedValue(row),
    save: vi.fn().mockImplementation(async (data) => ({ ...row, data })),
  };
}

function renderPrivateRoute(element: React.ReactNode, repository = makeRepository()) {
  createRepository.mockReturnValue(repository);
  const router = getRouter();
  const queryClient = new QueryClient();

  render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <PrivateCareerOsProvider authUser={authorisedUser}>{element}</PrivateCareerOsProvider>
      </QueryClientProvider>
    </RouterContextProvider>,
  );

  return repository;
}

const extractedJob = {
  ok: true as const,
  confidence: "high" as const,
  completeness: "complete" as const,
  method: "structured" as const,
  wordCount: 140,
  qualityNotes: [],
  title: "Growth Marketing Manager",
  company: "Example Co",
  location: "London",
  workplaceType: "Hybrid",
  employmentType: "Permanent",
  salary: "£60,000 - £70,000",
  closingDate: "2026-08-31",
  summary: "Lead growth marketing across acquisition and optimisation.",
  responsibilities: ["Own paid media budgets", "Report to senior stakeholders"],
  requiredSkills: ["Budget ownership", "A/B testing"],
  preferredSkills: [],
  qualifications: ["Degree-level education"],
  experience: [],
  tools: ["GA4"],
  competencies: ["Stakeholder management"],
  sourceUrl: "https://example.com/job",
  applyUrl: "https://example.com/job",
  text: "Extracted job description with a different body and enough detail to analyse safely. ".repeat(
    8,
  ),
};

const manualDescription =
  "This is my manually pasted job description. It includes budget ownership, stakeholder reporting, A/B testing, project delivery and enough additional detail to make the role analysis meaningful. The role requires careful communication, planning, analytics, cross-functional delivery and evidence-based decision making across several workstreams and stakeholders.";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("trustworthy Job Scan UI", () => {
  it("does not silently replace a job description the user already pasted", async () => {
    extractJobFromUrl.mockResolvedValue(extractedJob);
    const JobScanPage = JobScanRoute.options.component!;
    renderPrivateRoute(<JobScanPage />);

    await screen.findByRole("heading", { name: "Job Scan" });
    fireEvent.change(screen.getByLabelText("Job URL"), {
      target: { value: "https://example.com/job" },
    });
    fireEvent.change(screen.getByLabelText("Job description"), {
      target: { value: manualDescription },
    });
    fireEvent.click(screen.getByRole("button", { name: "Extract job details" }));

    await waitFor(() => expect(extractJobFromUrl).toHaveBeenCalled());
    expect(screen.getByLabelText("Job description")).toHaveValue(manualDescription);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Use the extracted job description?" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep my pasted text" }));
    expect(screen.getByLabelText("Job description")).toHaveValue(manualDescription);
  });

  it("records a manually pasted JD as manual input when it is scanned", async () => {
    const JobScanPage = JobScanRoute.options.component!;
    const repository = renderPrivateRoute(<JobScanPage />);

    await screen.findByRole("heading", { name: "Job Scan" });
    fireEvent.change(screen.getByLabelText("Job description"), {
      target: { value: manualDescription },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyse role" }));

    await waitFor(() => expect(repository.save).toHaveBeenCalled());
    const savedStates = repository.save.mock.calls.map(([data]) => data);
    expect(
      savedStates.some(
        (data) =>
          data.jobs?.[0]?.description === manualDescription &&
          data.jobs?.[0]?.extractionCompleteness === "manual" &&
          data.jobs?.[0]?.extractionMethod === "manual" &&
          data.jobs?.[0]?.descriptionWordCount > 40,
      ),
    ).toBe(true);
  });

  it("renders the requirement-level Evidence Map behind the compatibility score", () => {
    const scan: ScanResult = {
      id: "scan-test",
      jobId: "job-test",
      createdAt: "2026-08-19T16:00:00.000Z",
      overall: 72,
      verdict: "Competitive",
      subScores: [],
      strengths: [],
      partials: [],
      gaps: [],
      missingKeywords: [],
      matchedKeywords: [],
      blockedEvidence: [],
      strategy: "Apply with tailored positioning",
      reasons: ["Evidence-map test."],
      evidenceMap: [
        {
          id: "responsibility-budget-ownership",
          requirement: "Budget ownership",
          category: "Responsibility",
          priority: "Required",
          status: "Covered",
          score: 100,
          evidenceIds: ["ev-budget"],
          profileItemIds: ["pi-budget"],
          sourceIds: ["source-m01"],
          explanation: "Covered by verified evidence for £140k+ annual media budget ownership.",
        },
      ],
    };

    render(<ScanResultView scan={scan} />);

    expect(screen.getByRole("heading", { name: "Evidence Map" })).toBeInTheDocument();
    expect(screen.getByText("Budget ownership")).toBeInTheDocument();
    expect(screen.getByText("Covered")).toBeInTheDocument();
    expect(screen.getByText(/£140k\+ annual media budget ownership/i)).toBeInTheDocument();
  });
});
