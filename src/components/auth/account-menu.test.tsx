import "@/test/dom";
import "@/test/setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { AuthUserProvider } from "@/lib/auth/auth-context";
import { logout } from "@/lib/auth/auth.functions";

vi.mock("@/lib/auth/auth.functions", () => ({ logout: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useRouter: vi.fn() }));

import { AccountMenu } from "./account-menu";

const authorisedUser = { id: "user-123", email: "vjk16416@gmail.com" };
const router = {
  invalidate: vi.fn<() => Promise<void>>(),
  navigate: vi.fn<() => Promise<void>>(),
};
const logoutAction = logout as unknown as Mock<() => Promise<{ ok: true }>>;
const mockedUseRouter = useRouter as unknown as { mockReturnValue: (value: unknown) => void };

function renderAccountMenu(props?: { replaceLocation?: (to: string) => void }) {
  const queryClient = new QueryClient();
  const clearClientCache = vi.spyOn(queryClient, "clear");

  render(
    <QueryClientProvider client={queryClient}>
      <AuthUserProvider user={authorisedUser}>
        <AccountMenu {...props} />
      </AuthUserProvider>
    </QueryClientProvider>,
  );

  return { clearClientCache };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockedUseRouter.mockReturnValue(router);
});

describe("AccountMenu", () => {
  it("shows the signed-in approved email with an accessible logout control", () => {
    renderAccountMenu();

    expect(screen.getByText("vjk16416@gmail.com")).toBeInTheDocument();
    const logoutButton = screen.getByRole("button", { name: "Log out" });
    expect(logoutButton).toBeEnabled();
    expect(logoutButton.closest("form")).toHaveAttribute("method", "post");
  });

  it("clears local auth state and goes to login after the POST logout action succeeds", async () => {
    let finishLogout!: (result: { ok: true }) => void;
    logoutAction.mockReturnValue(
      new Promise((resolve) => {
        finishLogout = resolve;
      }),
    );
    router.invalidate.mockResolvedValue(undefined);
    router.navigate.mockResolvedValue(undefined);
    const { clearClientCache } = renderAccountMenu();

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(logoutAction).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Logging out…" })).toBeDisabled();
    expect(clearClientCache).not.toHaveBeenCalled();
    expect(router.invalidate).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();

    finishLogout({ ok: true });

    await waitFor(() => expect(clearClientCache).toHaveBeenCalledOnce());
    expect(router.invalidate).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith({ to: "/login", replace: true });
  });

  it("announces a retryable non-secret error when logout fails", async () => {
    logoutAction.mockRejectedValue(new Error("Bearer very-secret-token"));
    const { clearClientCache } = renderAccountMenu();

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    const retry = await screen.findByRole("button", { name: "Try logging out again" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "CareerOS could not log you out. Please try again.",
    );
    expect(screen.queryByText("Bearer very-secret-token")).not.toBeInTheDocument();
    expect(retry).toHaveFocus();
    expect(clearClientCache).not.toHaveBeenCalled();
    expect(router.invalidate).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("uses a hard login replacement without a false logout error when client navigation fails", async () => {
    logoutAction.mockResolvedValue({ ok: true });
    router.invalidate.mockResolvedValue(undefined);
    router.navigate.mockRejectedValue(new Error("router transition failed"));
    const replaceLocation = vi.fn();
    const { clearClientCache } = renderAccountMenu({ replaceLocation });

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(replaceLocation).toHaveBeenCalledWith("/login"));
    expect(clearClientCache).toHaveBeenCalledOnce();
    expect(router.invalidate).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "CareerOS could not log you out. Please try again.",
    );
  });

  it("continues to login when router invalidation fails after server logout succeeds", async () => {
    logoutAction.mockResolvedValue({ ok: true });
    router.invalidate.mockRejectedValue(new Error("stale router state"));
    router.navigate.mockResolvedValue(undefined);
    const { clearClientCache } = renderAccountMenu();

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() =>
      expect(router.navigate).toHaveBeenCalledWith({ to: "/login", replace: true }),
    );
    expect(clearClientCache).toHaveBeenCalledOnce();
    expect(router.invalidate).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "CareerOS could not log you out. Please try again.",
    );
  });
});
