import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: authMock },
}));

import { AuthProvider, useAuth } from "./auth-context";

function Probe({ children }: { children?: ReactNode }) {
  const { user, loading, signIn, signUp, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="email">{user?.email ?? "signed-out"}</span>
      <button type="button" onClick={() => void signIn(" vjk16416@gmail.com ", "secret-pass")}>
        Sign in Vinnie
      </button>
      <button type="button" onClick={() => void signIn(" other.user@example.com ", "other-pass")}>
        Sign in another user
      </button>
      <button
        type="button"
        onClick={() => void signUp(" new.user@example.com ", "new-secret-pass", "Alex Taylor")}
      >
        Create another account
      </button>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
      {user ? children : null}
    </div>
  );
}

const unsubscribe = vi.fn();

function sessionFor(email: string) {
  return {
    access_token: "access",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: `user-${email}`,
      email,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-08-16T00:00:00.000Z",
    },
  };
}

describe("CareerOS auth context", () => {
  beforeEach(() => {
    localStorage.clear();
    unsubscribe.mockReset();
    authMock.getSession.mockReset();
    authMock.onAuthStateChange.mockReset();
    authMock.signInWithPassword.mockReset();
    authMock.signUp.mockReset();
    authMock.signOut.mockReset();
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    });
    authMock.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    authMock.signUp.mockResolvedValue({ data: { user: {}, session: null }, error: null });
    authMock.signOut.mockResolvedValue({ error: null });
  });

  it("blocks unauthenticated CareerOS content", async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(
      <AuthProvider>
        <Probe>
          <div>Private CareerOS content</div>
        </Probe>
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.queryByText("Private CareerOS content")).not.toBeInTheDocument();
    expect(screen.getByTestId("email")).toHaveTextContent("signed-out");
  });

  it("restores a valid Supabase session", async () => {
    authMock.getSession.mockResolvedValue({
      data: { session: sessionFor("vjk16416@gmail.com") },
      error: null,
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent("vjk16416@gmail.com"),
    );
  });

  it("signs out and clears authenticated content", async () => {
    authMock.getSession.mockResolvedValue({
      data: { session: sessionFor("vjk16416@gmail.com") },
      error: null,
    });

    render(
      <AuthProvider>
        <Probe>
          <div>Private CareerOS content</div>
        </Probe>
      </AuthProvider>,
    );

    await screen.findByText("Private CareerOS content");
    await act(async () => screen.getByRole("button", { name: "Sign out" }).click());

    await waitFor(() => expect(screen.getByTestId("email")).toHaveTextContent("signed-out"));
    expect(authMock.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Private CareerOS content")).not.toBeInTheDocument();
  });

  it("does not treat browser data as authorisation", async () => {
    localStorage.setItem(
      "careeros-user",
      JSON.stringify({ email: "vjk16416@gmail.com", authorised: true }),
    );
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("email")).toHaveTextContent("signed-out");
  });

  it("uses Supabase authentication for both the initial account and future users", async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await act(async () => screen.getByRole("button", { name: "Sign in Vinnie" }).click());
    await act(async () => screen.getByRole("button", { name: "Sign in another user" }).click());

    expect(authMock.signInWithPassword).toHaveBeenNthCalledWith(1, {
      email: "vjk16416@gmail.com",
      password: "secret-pass",
    });
    expect(authMock.signInWithPassword).toHaveBeenNthCalledWith(2, {
      email: "other.user@example.com",
      password: "other-pass",
    });
  });

  it("creates a new Supabase account without a permanent email allowlist", async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    await act(async () => screen.getByRole("button", { name: "Create another account" }).click());

    expect(authMock.signUp).toHaveBeenCalledWith({
      email: "new.user@example.com",
      password: "new-secret-pass",
      options: { data: { full_name: "Alex Taylor" } },
    });
  });
});
