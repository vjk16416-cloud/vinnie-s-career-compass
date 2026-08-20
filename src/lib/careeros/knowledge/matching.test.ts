import { describe, expect, it } from "vitest";
import { classifyKnowledgeForMatching, runCanonicalKnowledgeScan } from "./matching";
import type { EmploymentRole, KnowledgeItem } from "./types";
import type { JobRecord } from "../types";

function item(id: string, status: KnowledgeItem["status"], title: string, content: string, employmentRoleId: string | null = null): KnowledgeItem {
  return {
    id,
    user_id: "user-1",
    employment_role_id: employmentRoleId,
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

function role(id: string, title: string, startDate: string, endDate: string): EmploymentRole {
  return {
    id,
    user_id: "user-1",
    employer: "Example",
    title,
    start_date: startDate,
    end_date: endDate,
    is_current: false,
    summary: null,
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
  } as EmploymentRole;
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

  it("does not use unrelated career tenure to satisfy a domain-specific years requirement", () => {
    const roles = [
      role("marketing", "Senior Digital Marketing Executive", "2016-06-01", "2022-04-01"),
      role("operations", "Marketing & Operations Executive", "2023-09-01", "2024-06-01"),
      role("performance", "Performance Marketing Manager", "2025-06-01", "2025-12-01"),
    ];
    const knowledge = [
      item("workflow", "user_confirmed", "Asana delivery workflow", "Introduced Agile-style project delivery practices and ownership sequencing.", "operations"),
      item("product", "user_confirmed", "Founder-led MVP", "Product vision, MVP scope, roadmap and product development work."),
    ];
    const job: JobRecord = {
      id: "job-product",
      company: "Capital on Tap",
      title: "Associate Product Manager",
      location: "London",
      description: "You need 2+ years of experience in product management or project management. Own end-to-end feature and project delivery, collaborate with stakeholders and improve customer outcomes.",
      createdAt: "2026-08-20T00:00:00.000Z",
      sourceType: "url",
    };

    const result = runCanonicalKnowledgeScan(job, knowledge, roles);
    const experience = result.subScores.find((score) => score.key === "experience");

    expect(experience?.score).toBeLessThan(100);
    expect(experience?.reason).toContain("domain-relevant");
  });
});
