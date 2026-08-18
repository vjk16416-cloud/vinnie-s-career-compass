import { describe, expect, it } from "vitest";
import { withMasterProfileFoundation } from "./profile-data";
import { PROFILE_ITEMS, PROFILE_SOURCES } from "./profile-foundation";
import { createSeedData } from "./seed";

describe("master-profile data migration", () => {
  it("adds new foundation records to previously stored PR 1 data without overwriting user edits", () => {
    const oldData = createSeedData();
    oldData.profileSources = PROFILE_SOURCES.map((source) => ({ ...source }));
    oldData.profileItems = PROFILE_ITEMS.map((item) => ({ ...item }));
    const editedBudget = oldData.profileItems.find((item) => item.id === "pi-budget");
    if (!editedBudget) throw new Error("Expected seeded budget item");
    editedBudget.safeWording = "User-edited budget wording";

    const migrated = withMasterProfileFoundation(oldData);

    expect(
      migrated.profileSources.find((source) => source.auditId === "M01")?.extractionStatus,
    ).toBe("Reconciled");
    expect(migrated.profileSources.some((source) => source.id === "source-metrics-register")).toBe(
      true,
    );
    expect(migrated.profileItems.some((item) => item.id === "pi-apm-pfq")).toBe(true);
    expect(migrated.profileItems.find((item) => item.id === "pi-budget")?.safeWording).toBe(
      "User-edited budget wording",
    );
  });
});
