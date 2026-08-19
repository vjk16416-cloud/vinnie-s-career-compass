import { describe, expect, it } from "vitest";

import { addUnmappedRequirementGaps } from "./generic-requirements";
import type { EvidenceMapItem } from "./types";

const budgetItem: EvidenceMapItem = {
  id: "responsibility-budget-ownership",
  requirement: "Budget ownership",
  category: "Responsibility",
  priority: "Required",
  status: "Covered",
  score: 100,
  evidenceIds: ["ev-budget"],
  profileItemIds: [],
  sourceIds: [],
  explanation: "Covered by verified evidence.",
};

describe("generic requirement gap extraction", () => {
  it("keeps an unfamiliar must-have criterion even when the next criterion is already mapped", () => {
    const result = addUnmappedRequirementGaps(
      [budgetItem],
      "You must have advanced financial modelling experience for investment cases. Budget ownership is also required.",
    );

    expect(result.map((item) => item.requirement)).toContain(
      "advanced financial modelling experience for investment cases",
    );
  });
});
