import { describe, expect, it, vi } from "vitest";
import type { EmploymentRole, KnowledgeItem } from "@/lib/careeros/knowledge/types";
import type { CareerOsData, JobRecord } from "@/lib/careeros/types";
import { createTailoredCvWorkflow } from "./generate-workflow";
import { buildTailoredCvFromKnowledge } from "./tailored-cv";

const minimalData = {
  profile: { employment: [] },
} as unknown as CareerOsData;

const job = {
  id: "job-1",
  title: "Marketing Manager",
  company: "Example Ltd",
  location: "London",
  description: "Marketing role",
  createdAt: "2026-08-16T00:00:00.000Z",
  sourceType: "paste",
} as JobRecord;

function knowledge(
  id: string,
  title: string,
  content: string,
  overrides: Partial<KnowledgeItem> = {},
): KnowledgeItem {
  return {
    id,
    user_id: "user-a",
    employment_role_id: "role-a",
    category: "achievement",
    title,
    content,
    star_context: null,
    star_action: content,
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

describe("authenticated tailored CV workflow", () => {
  it("loads current-user Knowledge Bank data before generating the CV", async () => {
    const knowledgeItems = [{ id: "knowledge-1" }];
    const employmentRoles = [{ id: "role-1" }];
    const loadKnowledgeItems = vi.fn().mockResolvedValue(knowledgeItems);
    const loadEmploymentRoles = vi.fn().mockResolvedValue(employmentRoles);
    const generate = vi.fn().mockReturnValue({ ready: true, body: "CV" });

    const workflow = createTailoredCvWorkflow({
      loadKnowledgeItems: loadKnowledgeItems as never,
      loadEmploymentRoles: loadEmploymentRoles as never,
      generate: generate as never,
    });

    const result = await workflow(minimalData, job, undefined);

    expect(loadKnowledgeItems).toHaveBeenCalledTimes(1);
    expect(loadEmploymentRoles).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith(minimalData, job, undefined, {
      knowledgeItems,
      employmentRoles,
    });
    expect(result).toEqual({ ready: true, body: "CV" });
  });

  it("builds a Product proposal whose experience claims preserve chronology and eligible provenance", () => {
    const data = {
      profile: {
        name: "Vinnie Example",
        location: "London",
        headline: "Product & Project Delivery",
        summary: "Cross-functional technology and delivery professional.",
        employment: [
          {
            id: "profile-role-a",
            title: "Marketing & Operations Executive",
            company: "IDEA StatiCa UK",
            employmentType: "Contract",
            start: "Sep 2023",
            end: "Jun 2024",
            location: "London",
            summary: "Enterprise software adoption and delivery.",
            highlights: [],
            skills: ["Project Delivery"],
          },
        ],
        education: [],
        certifications: [],
        projects: [],
        skills: ["Product Development", "Project Delivery", "Stakeholder Management"],
        tools: ["Asana", "Power BI"],
        domains: ["Technology"],
      },
      profileVersions: [],
      evidence: [],
      jobs: [],
      applications: [],
      cvs: [],
      coverLetters: [],
      scans: [],
      activity: [],
      settings: {} as CareerOsData["settings"],
    } as CareerOsData;

    const productJob = {
      id: "job-product",
      company: "Capital on Tap",
      title: "Associate Product Manager",
      location: "London",
      description: "Own product roadmap, customer outcomes, stakeholder collaboration and end-to-end project delivery.",
      createdAt: "2026-08-21T00:00:00.000Z",
      sourceType: "url",
    } as JobRecord;

    const role = {
      id: "role-a",
      user_id: "user-a",
      employer: "IDEA StatiCa UK",
      title: "Marketing & Operations Executive",
      employment_type: "Contract",
      start_date: "2023-09-01",
      end_date: "2024-06-01",
      is_current: false,
      summary: null,
      created_at: "2026-08-21T00:00:00.000Z",
      updated_at: "2026-08-21T00:00:00.000Z",
    } as EmploymentRole;

    const result = buildTailoredCvFromKnowledge(data, productJob, undefined, {
      employmentRoles: [role],
      knowledgeItems: [
        knowledge("roadmap", "Product roadmap delivery", "Owned roadmap and stakeholder delivery for a technology initiative.", { category: "project" }),
        knowledge("workflow", "Agile delivery workflow", "Introduced Agile-style project delivery, sequencing and ownership.", { category: "achievement" }),
        knowledge("reporting", "Stakeholder reporting", "Built reporting to improve stakeholder visibility and decisions.", { category: "achievement" }),
        knowledge("imported", "Imported product claim", "Imported product management claim.", { status: "imported_cv" }),
        knowledge("excluded", "Excluded product claim", "Conflicting product claim.", { status: "excluded" }),
      ],
    });

    expect(result.masterFamily).toBe("Product / Product Management");
    expect(result.body).toContain("Sep 2023 – Jun 2024 | London");
    const experienceClaims = result.claims.filter((claim) => claim.section === "experience");
    expect(experienceClaims.length).toBeGreaterThanOrEqual(3);
    expect(experienceClaims.every((claim) => claim.evidenceIds.length > 0)).toBe(true);
    expect(result.evidenceIds).not.toContain("imported");
    expect(result.evidenceIds).not.toContain("excluded");
  });
});
