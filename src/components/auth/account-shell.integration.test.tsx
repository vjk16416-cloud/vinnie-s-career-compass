import "@/test/dom";
import "@/test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContextProvider } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import { AppShell } from "@/components/careeros/app-shell";
import { logout } from "@/lib/auth/auth.functions";
import { AuthUserProvider } from "@/lib/auth/auth-context";
import { getRouter } from "@/router";
import { Route as LogoutRoute } from "@/routes/logout";

vi.mock("@/lib/auth/auth.functions", () => ({ logout: vi.fn() }));

const authorisedUser = { id: "user-123", email: "vjk16416@gmail.com" };
const logoutAction = logout as unknown as Mock<() => Promise<{ ok: true }>>;

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("authorised account shell", () => {
  it("includes the approved identity and logout control in AppShell", () => {
    renderAuthorisedContent(
      <AppShell title="CareerOS home">
        <p>Private workspace</p>
      </AppShell>,
    );

    expect(screen.getByText("vjk16416@gmail.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeEnabled();
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
