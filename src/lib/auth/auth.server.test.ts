import { afterEach, describe, expect, it, vi } from "vitest";

import { getAuthorisedUser } from "./auth.server";

type UserResponse = {
  data: {
    user: {
      id: string;
      email?: string | null;
      user_metadata?: { email?: string };
    } | null;
  };
  error: Error | null;
};

function createSupabase(response: UserResponse) {
  const signOut = vi.fn().mockResolvedValue({ error: null });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(response),
      signOut,
    },
    signOut,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getAuthorisedUser", () => {
  it("returns the minimal identity for the allowed top-level email", async () => {
    const supabase = createSupabase({
      data: {
        user: {
          id: "user-123",
          email: "vjk16416@gmail.com",
          user_metadata: { email: "attacker@example.com" },
        },
      },
      error: null,
    });

    await expect(getAuthorisedUser(supabase as never)).resolves.toEqual({
      id: "user-123",
      email: "vjk16416@gmail.com",
    });
  });

  it("normalises the allowed email before returning it", async () => {
    const supabase = createSupabase({
      data: {
        user: { id: "user-123", email: "  VJK16416@GMAIL.COM " },
      },
      error: null,
    });

    await expect(getAuthorisedUser(supabase as never)).resolves.toEqual({
      id: "user-123",
      email: "vjk16416@gmail.com",
    });
  });

  it("returns null when Supabase has no user", async () => {
    const supabase = createSupabase({ data: { user: null }, error: null });

    await expect(getAuthorisedUser(supabase as never)).resolves.toBeNull();
    expect(supabase.signOut).not.toHaveBeenCalled();
  });

  it("rejects a user without a top-level email even when metadata has the allowed email", async () => {
    const supabase = createSupabase({
      data: {
        user: {
          id: "user-123",
          user_metadata: { email: "vjk16416@gmail.com" },
        },
      },
      error: null,
    });

    await expect(getAuthorisedUser(supabase as never)).resolves.toBeNull();
    expect(supabase.signOut).toHaveBeenCalledOnce();
  });

  it("signs out and rejects an account whose email is not allowed", async () => {
    const supabase = createSupabase({
      data: { user: { id: "other-user", email: "someone@example.com" } },
      error: null,
    });

    await expect(getAuthorisedUser(supabase as never)).resolves.toBeNull();
    expect(supabase.signOut).toHaveBeenCalledOnce();
  });

  it("treats provider errors as unauthenticated without logging token-bearing errors", async () => {
    const supabase = createSupabase({
      data: { user: null },
      error: new Error("refresh failed for token=never-log-this"),
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(getAuthorisedUser(supabase as never)).resolves.toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });
});
