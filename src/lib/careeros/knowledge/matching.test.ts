import { describe, expect, it } from "vitest";
import { classifyKnowledgeForMatching, runCanonicalKnowledgeScan } from "./matching";
import type { EmploymentRole, KnowledgeItem } from "./types";
import type { JobRecord } from "../types";

function item(id: string, status: KnowledgeItem["status"], title: string, content: string): KnowledgeItem {
  return {
    id,
    user_id: "user-1",
    employment_role_id: null,
    category: "achievement",
    title,
    content,
    metrics: {},
    source_reference: "source",
    source_type: "evidence_bank",
    star_action: null,
    star_context: null,
    star_result: null,
    status,
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
  };
}

describe("canonical Knowledge Bank matching", () => {
  it("separates reusable, caution and blocked evidence by status", () => {
    const rows = [
      item("verified", "verified", "Power BI reporting", "Built a Power BI reporting layer."),
      item("confirmed", "user_confirmed", "CRM migration", "Owned a Salesforce to Zoho migration."),
      item("imported", "imported_cv", "Imported claim", "Imported from a CV only."),
      item("verify", "needs_verification", "Unverified metric", "Claim needs primary evidence."),
      item("archived", "archived", "Old claim", "Archived."),
      item("excluded", "excluded", "Conflicting metric", "Conflicting versions."),
    ];

    const classified = classifyKnowledgeForMatching(rows);

    expect(classified.eligible.map((row) => row.id)).toEqual(["verified", "confirmed"]);
    expect(classified.caution.map((row) => row.id)).toEqual(["imported", "verify"]);
    expect(classified.blocked.map((row) => row.id)).toEqual(["archived", "excluded"]);
  });

  it("uses only eligible evidence for strengths and never promotes excluded or unverified claims", () => {
    const knowledge = [
      item("confirmed", "user_confirmed", "Power BI reporting", "Built Power BI dashboards using Salesforce data for stakeholder reporting."),
      item("verify", "needs_verification", "36% ROI improvement", "Requires dashboard verification."),
      item("excluded", "excluded", "25% project completion improvement", "Conflicting versions, do not use."),
    ];
    const roles: EmploymentRole[] = [];
    const job: JobRecord = {
      id: "job-1",
      company: "Example",
      title: "Project Analyst",
      location: "London",
      description: "We need Power BI, Salesforce, stakeholder reporting and project delivery experience. Candidates should analyse dashboards and communicate findings.",
      createdAt: "2026-08-20T00:00:00.000Z",
      sourceType: "paste",
    };

    const result = runCanonicalKnowledgeScan(job, knowledge, roles);

    expect(result.strengths.some((strength) => strength.evidenceId === "confirmed")).toBe(true);
    expect(result.strengths.some((strength) => strength.evidenceId === "verify")).toBe(false);
    expect(result.strengths.some((strength) => strength.evidenceId === "excluded")).toBe(false);
    expect(result.partials.join(" ")).toContain("36% ROI improvement");
    expect(result.blockedEvidence.some((row) => row.id === "excluded")).toBe(true);
  });
});
