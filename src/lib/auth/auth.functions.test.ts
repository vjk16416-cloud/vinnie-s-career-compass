import { afterEach, describe, expect, it, vi } from "vitest";

import { LogoutError, logoutCurrentSession } from "./auth.functions";

function createLogoutSession(signOutResult: { error: Error | null }) {
  const signOut = vi.fn().mockResolvedValue(signOutResult);
  const commitCookies = vi.fn();

  return {
    signOut,
    commitCookies,
    session: {
      supabase: { auth: { signOut } },
      commitCookies,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logoutCurrentSession", () => {
  it("commits cleared auth cookies only after local Supabase logout succeeds", async () => {
    const { signOut, commitCookies, session } = createLogoutSession({ error: null });

    await expect(logoutCurrentSession(() => session as never)).resolves.toEqual({ ok: true });

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(commitCookies).toHaveBeenCalledOnce();
  });

  it("rejects a resolved Supabase logout error without committing cookie changes", async () => {
    const providerError = new Error("refresh failed for token=never-expose-this");
    const { signOut, commitCookies, session } = createLogoutSession({ error: providerError });

    let receivedError: unknown;
    try {
      await logoutCurrentSession(() => session as never);
    } catch (error) {
      receivedError = error;
    }

    expect(receivedError).toEqual(new LogoutError());
    expect(receivedError).not.toHaveProperty(
      "message",
      "refresh failed for token=never-expose-this",
    );
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(commitCookies).not.toHaveBeenCalled();
  });
});
