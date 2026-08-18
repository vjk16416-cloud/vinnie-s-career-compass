import { describe, expect, it } from "vitest";
import { DEFAULT_SUPABASE_CONFIG, resolveSupabaseConfig } from "./config";

describe("Supabase auth configuration", () => {
  it("falls back to the public CareerOS Supabase config when build variables are absent", () => {
    expect(resolveSupabaseConfig({})).toEqual(DEFAULT_SUPABASE_CONFIG);
  });

  it("prefers explicit build variables over the public defaults", () => {
    expect(
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_override",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_override",
    });
  });
});
