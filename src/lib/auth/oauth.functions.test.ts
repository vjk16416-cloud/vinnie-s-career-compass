import "@/test/dom";

import { isRedirect } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GOOGLE_SIGN_IN_ERROR, handleOAuthCallback, startGoogleSignIn } from "./oauth.functions";

function createBrowserSupabase(error: Error | null = null) {
  const signInWithOAuth = vi
    .fn()
    .mockResolvedValue({ data: { provider: "google", url: null }, error });
  const supabase = { auth: { signInWithOAuth } };
  return { supabase, signInWithOAuth };
}

function createRequestSupabase(exchangeError: Error | null = null) {
  const exchangeCodeForSession = vi.fn().mockResolvedValue({
    data: { session: exchangeError ? null : { access_token: "test-token" }, user: null },
    error: exchangeError,
  });
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const supabase = { auth: { exchangeCodeForSession, signOut } };
  return { supabase, exchangeCodeForSession, signOut };
}

async function captureRedirect(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    expect(isRedirect(error)).toBe(true);
    return error as Response & { options: Record<string, unknown> };
  }

  throw new Error("Expected a TanStack Router redirect");
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("startGoogleSignIn", () => {
  it("starts Google OAuth with the current origin and a retained safe return path", async () => {
    const { supabase, signInWithOAuth } = createBrowserSupabase();

    await expect(
      startGoogleSignIn("/applications/123?tab=notes", () => supabase as never),
    ).resolves.toEqual({ error: null });

    expect(signInWithOAuth).toHaveBeenCalledOnce();
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(
          "/applications/123?tab=notes",
        )}`,
      },
    });
  });

  it("replaces an external return path before starting Google OAuth", async () => {
    const { supabase, signInWithOAuth } = createBrowserSupabase();

    await startGoogleSignIn("https://evil.example/steal", () => supabase as never);

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?returnTo=%2F`,
      },
    });
  });

  it("returns a non-secret message when OAuth initiation fails", async () => {
    const { supabase } = createBrowserSupabase(new Error("provider error containing a secret"));

    await expect(startGoogleSignIn("/", () => supabase as never)).resolves.toEqual({
      error: GOOGLE_SIGN_IN_ERROR,
    });
    expect(GOOGLE_SIGN_IN_ERROR).toBe("CareerOS could not start Google Sign-In. Please try again.");
  });

  it("explains when the Google provider is not enabled without exposing raw provider JSON", async () => {
    const providerError = Object.assign(
      new Error("Unsupported provider: provider is not enabled"),
      { code: "validation_failed" },
    );
    const { supabase } = createBrowserSupabase(providerError);

    await expect(startGoogleSignIn("/", () => supabase as never)).resolves.toEqual({
      error: "Google Sign-In is not enabled yet. Finish the CareerOS Google setup, then try again.",
    });
  });

  it("returns the same non-secret message when auth configuration throws", async () => {
    await expect(
      startGoogleSignIn("/", () => {
        throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is missing");
      }),
    ).resolves.toEqual({ error: GOOGLE_SIGN_IN_ERROR });
  });
});

describe("handleOAuthCallback", () => {
  it("exchanges the code exactly once, authorises on the same client and redirects safely", async () => {
    const { supabase, exchangeCodeForSession, signOut } = createRequestSupabase();
    const getAuthorisedUser = vi.fn().mockResolvedValue({
      id: "allowed-user",
      email: "vjk16416@gmail.com",
    });

    const result = await captureRedirect(() =>
      handleOAuthCallback(
        { code: "one-time-code", returnTo: "/applications/123" },
        () => supabase as never,
        getAuthorisedUser,
      ),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledOnce();
    expect(exchangeCodeForSession).toHaveBeenCalledWith("one-time-code");
    expect(getAuthorisedUser).toHaveBeenCalledOnce();
    expect(getAuthorisedUser).toHaveBeenCalledWith(supabase);
    expect(signOut).not.toHaveBeenCalled();
    expect(result.options).toMatchObject({ href: "/applications/123" });
  });

  it("normalises an external callback return path to the workspace root", async () => {
    const { supabase } = createRequestSupabase();
    const getAuthorisedUser = vi.fn().mockResolvedValue({
      id: "allowed-user",
      email: "vjk16416@gmail.com",
    });

    const result = await captureRedirect(() =>
      handleOAuthCallback(
        { code: "one-time-code", returnTo: "https://evil.example/steal" },
        () => supabase as never,
        getAuthorisedUser,
      ),
    );

    expect(result.options).toMatchObject({ href: "/" });
  });

  it("clears a disallowed session and redirects with only the unauthorised error state", async () => {
    const { supabase, signOut } = createRequestSupabase();
    const getAuthorisedUser = vi.fn().mockResolvedValue(null);

    const result = await captureRedirect(() =>
      handleOAuthCallback(
        { code: "sensitive-code", returnTo: "/settings" },
        () => supabase as never,
        getAuthorisedUser,
      ),
    );

    expect(signOut).toHaveBeenCalledOnce();
    expect(result.options).toMatchObject({
      to: "/login",
      search: { error: "unauthorised" },
    });
    expect(JSON.stringify(result.options)).not.toContain("sensitive-code");
  });

  it("redirects a missing code to the non-secret authentication error state", async () => {
    const { supabase, exchangeCodeForSession } = createRequestSupabase();
    const getAuthorisedUser = vi.fn();

    const result = await captureRedirect(() =>
      handleOAuthCallback(
        { code: undefined, returnTo: "/settings" },
        () => supabase as never,
        getAuthorisedUser,
      ),
    );

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(getAuthorisedUser).not.toHaveBeenCalled();
    expect(result.options).toMatchObject({
      to: "/login",
      search: { error: "authentication" },
    });
  });

  it("redirects a whitespace-only code to the non-secret authentication error state", async () => {
    const { supabase, exchangeCodeForSession } = createRequestSupabase();
    const getAuthorisedUser = vi.fn();

    const result = await captureRedirect(() =>
      handleOAuthCallback(
        { code: " \t\n ", returnTo: "/settings" },
        () => supabase as never,
        getAuthorisedUser,
      ),
    );

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(getAuthorisedUser).not.toHaveBeenCalled();
    expect(result.options).toMatchObject({
      to: "/login",
      search: { error: "authentication" },
    });
  });

  it("redirects an exchange error without exposing the OAuth code", async () => {
    const { supabase } = createRequestSupabase(new Error("invalid grant"));
    const getAuthorisedUser = vi.fn();

    const result = await captureRedirect(() =>
      handleOAuthCallback(
        { code: "never-leak-this-code", returnTo: "/settings" },
        () => supabase as never,
        getAuthorisedUser,
      ),
    );

    expect(getAuthorisedUser).not.toHaveBeenCalled();
    expect(result.options).toMatchObject({
      to: "/login",
      search: { error: "authentication" },
    });
    expect(JSON.stringify(result.options)).not.toContain("never-leak-this-code");
  });

  it("redirects a server auth configuration failure without exposing the OAuth code", async () => {
    const getAuthorisedUser = vi.fn();

    const result = await captureRedirect(() =>
      handleOAuthCallback(
        { code: "never-leak-this-code", returnTo: "/settings" },
        () => {
          throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is missing");
        },
        getAuthorisedUser,
      ),
    );

    expect(getAuthorisedUser).not.toHaveBeenCalled();
    expect(result.options).toMatchObject({
      to: "/login",
      search: { error: "authentication" },
    });
    expect(JSON.stringify(result.options)).not.toContain("never-leak-this-code");
  });
});
