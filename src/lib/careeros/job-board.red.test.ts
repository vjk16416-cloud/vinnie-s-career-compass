import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/components/careeros/app-shell";
import { normaliseData } from "./normalise";

describe("Job Board foundation", () => {
  it("normalises persisted state with usable job-search preferences", () => {
    const data = normaliseData({ settings: { googleDriveFolder: "Career OS" } });
    const preferences = (data.settings as unknown as { jobSearchPreferences?: unknown })
      .jobSearchPreferences as
      | {
          roleFamilies?: string[];
          locations?: string[];
          includeRemote?: boolean;
          includeVisaSponsorship?: boolean;
          maxAgeDays?: number;
        }
      | undefined;

    expect(preferences).toBeDefined();
    expect(preferences?.roleFamilies?.length).toBeGreaterThan(0);
    expect(preferences?.locations).toContain("UK");
    expect(preferences?.includeRemote).toBe(true);
    expect(preferences?.includeVisaSponsorship).toBe(true);
    expect(preferences?.maxAgeDays).toBe(30);
  });

  it("adds Job Board to the primary CareerOS navigation", () => {
    expect(NAV_ITEMS.some((item) => item.to === "/jobs" && item.label === "Job Board")).toBe(true);
  });
});
