import { describe, expect, it } from "vitest";
import type { KnowledgeItem } from "@/lib/careeros/knowledge/types";
import { rankEvidenceForJob } from "./evidence-ranker";

function item(
  id: string,
  title: string,
  content: string,
  overrides: Partial<KnowledgeItem> = {},
): KnowledgeItem {
  return {
    id,
    user_id: "user-a",
    employment_role_id: null,
    category: "achievement",
    title,
    content,
    star_context: null,
    star_action: null,
    star_result: null,
    metrics: {},
    status: "user_confirmed",
    source_type: "user_input",
    source_reference: null,
    created_at: "2026-08-21T00:00:00.000Z",
    updated_at: "2026-08-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("CV evidence ranking", () => {
  it("ranks JD-aligned product and project evidence above unrelated eligible evidence", () => {
    const ranked = rankEvidenceForJob(
      [
        item(
          "product",
          "Founder-led MVP",
          "Owned product vision, roadmap, MVP scope, stakeholder decisions and product delivery.",
          { category: "project" },
        ),
        item(
          "crm",
          "CRM migration",
          "Owned a cross-functional CRM migration project with stakeholders and delivery planning.",
          { category: "project" },
        ),
        item(
          "paid-search",
          "Paid search optimisation",
          "Optimised PPC campaigns, keywords and media spend.",
        ),
      ],
      "Associate Product Manager owning product roadmap, customer outcomes, stakeholder collaboration and end-to-end project delivery.",
    );

    expect(ranked[0]?.item.id).toBe("product");
    expect(ranked.findIndex((row) => row.item.id === "crm")).toBeLessThan(
      ranked.findIndex((row) => row.item.id === "paid-search"),
    );
    expect(ranked[0]?.matchedTerms).toEqual(
      expect.arrayContaining(["product", "roadmap", "stakeholder", "delivery"]),
    );
  });

  it("does not rank context-only or blocked evidence as factual CV evidence", () => {
    const ranked = rankEvidenceForJob(
      [
        item("verified", "Product roadmap", "Owned product roadmap and delivery.", { status: "verified" }),
        item("imported", "Imported product claim", "Product management claim from CV.", { status: "imported_cv" }),
        item("verify", "Unverified product metric", "Product outcome needs verification.", { status: "needs_verification" }),
        item("excluded", "Excluded product claim", "Conflicting product claim.", { status: "excluded" }),
      ],
      "Product Manager responsible for product roadmap and delivery.",
    );

    expect(ranked.map((row) => row.item.id)).toEqual(["verified"]);
  });
});
