import "@/test/dom";
import "@/test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import { AppShell } from "@/components/careeros/app-shell";
import { logout } from "@/lib/auth/auth.functions";
import { AuthUserProvider, PrivateCareerOsProvider } from "@/lib/auth/auth-context";
import { writeCareerOsCache } from "@/lib/careeros/local-cache";
import { createCareerOsData } from "@/lib/careeros/profile-data";
import { getRouter } from "@/router";
import { Route as LogoutRoute } from "@/routes/logout";

const { createRepository } = vi.hoisted(() => ({ createRepository: vi.fn() }));

vi.mock("@/lib/auth/auth.functions", () => ({ logout: vi.fn() }));
vi.mock("@/lib/careeros/cloud-state.repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/careeros/cloud-state.repository")>(
    "@/lib/careeros/cloud-state.repository",
  );
  return { ...actual, createSupabaseCareerStateRepository: createRepository };
});

const authorisedUser = { id: "user-123", email: "vjk16416@gmail.com" };
const logoutAction = logout as unknown as Mock<() => Promise<{ ok: true }>>;

function cloudRow() {
  return {
    userId: authorisedUser.id,
    schemaVersion: 1,
    data: createCareerOsData(),
    createdAt: "2026-08-18T20:00:00.000Z",
    updatedAt: "2026-08-18T20:00:00.000Z",
  };
}

function resolvedRepository() {
  return {
    load: vi.fn().mockResolvedValue(cloudRow()),
    create: vi.fn().mockResolvedValue(cloudRow()),
    save: vi.fn().mockResolvedValue(cloudRow()),
  };
}

function renderAuthorisedContent(content: React.ReactNode) {
  const router = getRouter();
  const queryClient = new QueryClient();

  return render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <AuthUserProvider user={authorisedUser}>{content}</AuthUserProvider>
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

function renderPrivateContent(content: React.ReactNode) {
  const router = getRouter();
  const queryClient = new QueryClient();

  return render(
    <RouterContextProvider router={router}>
      <QueryClientProvider client={queryClient}>
        <PrivateCareerOsProvider authUser={authorisedUser}>{content}</PrivateCareerOsProvider>
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("authorised account shell", () => {
  it("includes the approved identity and truthful cloud status after bootstrap", async () => {
    createRepository.mockReturnValue(resolvedRepository());
    renderPrivateContent(
      <AppShell title="CareerOS home">
        <p>Private workspace</p>
      </AppShell>,
    );

    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
    expect(await screen.findByText("Private workspace")).toBeInTheDocument();
    expect(screen.getByText("vjk16416@gmail.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeEnabled();
    expect(screen.getByText("Cloud synced")).toBeInTheDocument();
    expect(screen.queryByText("Local seeded data")).not.toBeInTheDocument();
  });

  it("shows cached-copy degradation when cloud data cannot be read", async () => {
    writeCareerOsCache(window.localStorage, createCareerOsData());
    createRepository.mockReturnValue({
      ...resolvedRepository(),
      load: vi.fn().mockRejectedValue(new Error("network")),
    });

    renderPrivateContent(
      <AppShell title="CareerOS home">
        <p>Private workspace</p>
      </AppShell>,
    );

    expect(await screen.findByText("Private workspace")).toBeInTheDocument();
    expect(screen.getByText("Cloud unavailable: cached copy")).toBeInTheDocument();
    expect(
      screen.getByText("Cloud data is temporarily unavailable. Viewing the last saved copy."),
    ).toBeInTheDocument();
  });

  it("uses the sixth mobile slot for More and exposes secondary destinations", async () => {
    createRepository.mockReturnValue(resolvedRepository());
    renderPrivateContent(
      <AppShell title="CareerOS home">
        <p>Private workspace</p>
      </AppShell>,
    );

    expect(await screen.findByText("Private workspace")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toHaveTextContent("Job Board");
    const mobileNav = screen.getByRole("navigation", { name: "Primary mobile" });
    expect(within(mobileNav).queryByText("Add")).not.toBeInTheDocument();

    fireEvent.click(within(mobileNav).getByRole("button", { name: "More" }));

    expect(screen.getByRole("link", { name: "Job Board" })).toHaveAttribute("href", "/job-board");
    expect(screen.getByRole("link", { name: "Career Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(screen.getByRole("link", { name: "Job Market Intelligence" })).toHaveAttribute(
      "href",
      "/market",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("renders the GET logout confirmation without invoking the POST logout action", () => {
    const LogoutPage = LogoutRoute.options.component!;
    renderAuthorisedContent(<LogoutPage />);

    expect(screen.getByRole("heading", { name: "Log out of CareerOS?" })).toBeInTheDocument();
    expect(screen.getByText("Confirm to end this session on this device.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeEnabled();
    expect(logoutAction).not.toHaveBeenCalled();
  });
});
