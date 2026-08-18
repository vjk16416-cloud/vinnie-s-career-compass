import { describe, expect, it } from "vitest";

import { DEFAULT_SUPABASE_CONFIG, resolveSupabaseConfig } from "./config";

describe("Supabase auth configuration", () => {
  it("uses the CareerOS public project defaults when build variables are absent", () => {
    expect(resolveSupabaseConfig({})).toEqual(DEFAULT_SUPABASE_CONFIG);
    expect(DEFAULT_SUPABASE_CONFIG.url).toBe("https://gieehxdyzcrrmgxnfsxs.supabase.co");
    expect(DEFAULT_SUPABASE_CONFIG.publishableKey).toMatch(/^sb_publishable_/);
  });

  it("prefers environment overrides when they are supplied", () => {
    expect(
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: "https://override.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_override",
      }),
    ).toEqual({
      url: "https://override.supabase.co",
      publishableKey: "sb_publishable_override",
    });
  });
});
