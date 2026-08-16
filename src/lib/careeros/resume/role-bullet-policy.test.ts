import { describe, expect, it } from "vitest";
import type { KnowledgeItem } from "@/lib/careeros/knowledge/types";
import { selectRoleEvidence } from "./evidence-selector";
import {
  MAX_ROLE_BULLETS,
  MIN_ROLE_BULLETS,
  assessRoleBulletCoverage,
  buildRoleBulletPlan,
} from "./role-bullet-policy";

function item(
  id: string,
  overrides: Partial<KnowledgeItem> = {},
): KnowledgeItem {
  return {
    id,
    user_id: "user-a",
    employment_role_id: "role-a",
    category: "achievement",
    title: `Achievement ${id}`,
    content: `Supported career fact ${id}`,
    star_context: `Context ${id}`,
    star_action: `Led action ${id}`,
    star_result: `Delivered result ${id}`,
    metrics: {},
    status: "user_confirmed",
    source_type: "user_input",
    source_reference: null,
    created_at: "2026-08-16T00:00:00.000Z",
    updated_at: "2026-08-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("CareerOS role bullet policy", () => {
  it("returns at least three supported bullets for a role when enough evidence exists", () => {
    const plan = buildRoleBulletPlan(
      [item("k1"), item("k2"), item("k3"), item("k4")],
      "role-a",
    );

    expect(plan.coverage.complete).toBe(true);
    expect(plan.bullets).toHaveLength(4);
    expect(plan.bullets.every((bullet) => bullet.evidenceId.startsWith("k"))).toBe(true);
    expect(plan.gap).toBeNull();
  });

  it("never returns more than five bullets for one role", () => {
    const plan = buildRoleBulletPlan(
      Array.from({ length: 8 }, (_, index) => item(`k${index + 1}`)),
      "role-a",
    );

    expect(plan.bullets).toHaveLength(MAX_ROLE_BULLETS);
    expect(plan.coverage.count).toBe(MAX_ROLE_BULLETS);
  });

  it("does not fabricate a result when no supported result exists", () => {
    const plan = buildRoleBulletPlan(
      [
        item("k1", {
          star_action: "Reworked campaign targeting",
          star_result: null,
          content: "Reworked campaign targeting across paid social.",
        }),
      ],
      "role-a",
    );

    expect(plan.bullets[0]?.text).toBe("Reworked campaign targeting");
    expect(plan.bullets[0]?.text).not.toMatch(/result|increase|improved|%/i);
    expect(plan.strengthening[0]?.reason).toMatch(/result/i);
  });

  it("labels weak evidence as needing strengthening", () => {
    const plan = buildRoleBulletPlan(
      [
        item("k1", {
          status: "needs_verification",
          content: "Potentially increased conversion rate.",
          star_result: "Potential uplift not yet confirmed.",
        }),
      ],
      "role-a",
    );

    expect(plan.bullets).toHaveLength(0);
    expect(plan.strengthening).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceId: "k1",
          reason: expect.stringMatching(/verification/i),
        }),
      ]),
    );
    expect(plan.gap).toMatchObject({
      missing: MIN_ROLE_BULLETS,
      options: ["strengthen", "use_as_is", "exclude"],
    });
  });

  it("keeps archived and excluded knowledge out of the candidate set", () => {
    const selection = selectRoleEvidence(
      [
        item("verified", { status: "verified" }),
        item("archived", { status: "archived" }),
        item("excluded", { status: "excluded" }),
      ],
      "role-a",
    );

    expect(selection.supported.map((entry) => entry.id)).toEqual(["verified"]);
    expect(selection.blocked.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["archived", "excluded"]),
    );
  });

  it("prefers items with a supported action and result while retaining provenance", () => {
    const plan = buildRoleBulletPlan(
      [
        item("weak", {
          star_action: null,
          star_result: null,
          status: "imported_cv",
          source_type: "cv",
        }),
        item("strong", {
          status: "imported_linkedin",
          source_type: "linkedin",
        }),
      ],
      "role-a",
    );

    expect(plan.bullets[0]).toMatchObject({
      evidenceId: "strong",
      status: "imported_linkedin",
      sourceType: "linkedin",
    });
  });

  it("reports the 3 to 5 target consistently", () => {
    expect(assessRoleBulletCoverage(2)).toEqual({
      complete: false,
      count: 2,
      target: "3-5",
    });
    expect(assessRoleBulletCoverage(3).complete).toBe(true);
  });
});
