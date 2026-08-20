import "@/test/dom";
import "@/test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrivateCareerOsProvider } from "@/lib/auth/auth-context";
import { createCareerOsData } from "@/lib/careeros/profile-data";
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
  data.jobs = [
    {
      id: "job-test",
      company: "Example Co",
      title: "Growth Marketing Manager",
      location: "London",
      description:
        "Own paid media budgets, report to senior stakeholders, run A/B tests and deliver cross-functional growth projects. ".repeat(
          6,
        ),
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
      notes: "Founder note",
      nextAction: "Review tailored CV",
      compatibilityScore: 75,
      history: [],
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
  createRepository.mockReturnValue(makeRepository());
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
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("application workspace workflow", () => {
  it("uses six clear stages and folds tracking plus interview prep into Apply", async () => {
    renderWorkspace();

    await screen.findByRole("heading", { name: "Growth Marketing Manager" });

    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Job", "Match", "Evidence", "CV", "Cover Letter", "Apply"]);
    expect(screen.queryByRole("tab", { name: "Notes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Interview Prep" })).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Apply" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByRole("heading", { name: "Application tracking" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Interview prep" })).toBeInTheDocument();
  });
});
