import "@/test/dom";
import "@/test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrivateCareerOsProvider } from "@/lib/auth/auth-context";
import { createCareerOsData } from "@/lib/careeros/profile-data";
import { getRouter } from "@/router";
import { Route as EvidenceRoute } from "@/routes/evidence";
import { Route as SettingsRoute } from "@/routes/settings";

const { createRepository } = vi.hoisted(() => ({ createRepository: vi.fn() }));

vi.mock("@/lib/careeros/cloud-state.repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/careeros/cloud-state.repository")>(
    "@/lib/careeros/cloud-state.repository",
  );
  return { ...actual, createSupabaseCareerStateRepository: createRepository };
});

const authorisedUser = { id: "user-123", email: "vjk16416@gmail.com" };

function makeCloudData() {
  const data = createCareerOsData();
  if (data.evidence[0]) data.evidence[0].status = "Verified";
  if (data.evidence[1]) data.evidence[1].status = "Needs Evidence";
  return data;
}

function makeRepository() {
  const row = {
    userId: authorisedUser.id,
    schemaVersion: 1,
    data: makeCloudData(),
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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("CareerOS trust controls", () => {
  it("describes Supabase as canonical storage and the browser as a local cache", async () => {
    const SettingsPage = SettingsRoute.options.component!;
    renderPrivateRoute(<SettingsPage />);

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(
      screen.getByText(/Supabase is the canonical CareerOS store/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/browser keeps a local cache/i)).toBeInTheDocument();
    expect(screen.queryByText(/Everything lives in this browser/i)).not.toBeInTheDocument();
  });

  it("does not reset cloud state until the user confirms the reset", async () => {
    const SettingsPage = SettingsRoute.options.component!;
    const repository = renderPrivateRoute(<SettingsPage />);

    await screen.findByRole("heading", { name: "Settings" });
    fireEvent.click(screen.getByRole("button", { name: "Reset to seeded data" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reset CareerOS to seeded data?" })).toBeInTheDocument();
    expect(screen.getByText(/sync across your devices/i)).toBeInTheDocument();
    expect(repository.save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reset CareerOS" }));
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));
  });

  it.each([
    ["Excluded", "Confirm Excluded"],
    ["Verified", "Confirm Verified"],
  ] as const)("requires confirmation before evidence becomes %s", async (status, confirmLabel) => {
    const EvidencePage = EvidenceRoute.options.component!;
    const repository = renderPrivateRoute(<EvidencePage />);

    await screen.findByRole("heading", { name: "Evidence Bank" });
    const action = screen.getAllByRole("button", { name: `Mark ${status}` })[0];
    fireEvent.click(action);

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: `Mark evidence as ${status}?` })).toBeInTheDocument();
    expect(repository.save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: confirmLabel }));
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));
  });
});
