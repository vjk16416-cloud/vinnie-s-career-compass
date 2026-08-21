import { describe, expect, it } from "vitest";
import type { EmploymentRole, KnowledgeItem } from "@/lib/careeros/knowledge/types";
import type { CareerOsData, JobRecord } from "@/lib/careeros/types";
import { rankEvidenceForJob } from "./evidence-ranker";
import { selectMasterCvFamily } from "./master-selector";
import { buildTailoredCvFromKnowledge } from "./tailored-cv";

function item(
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
    source_type: "evidence_bank",
    source_reference: null,
    created_at: "2026-08-21T00:00:00.000Z",
    updated_at: "2026-08-21T00:00:00.000Z",
    ...overrides,
  };
}

const capitalOnTapJob: JobRecord = {
  id: "capital-on-tap-8604164002",
  company: "Capital on Tap",
  title: "Associate Product Manager",
  location: "London",
  description: [
    "2+ years of experience in product management or project management.",
    "Own end-to-end feature and project delivery.",
    "Collaborate with senior stakeholders and cross-functional teams.",
    "Use commercial thinking to improve customer outcomes.",
    "Strong organisation and communication skills.",
  ].join(" "),
  createdAt: "2026-08-21T00:00:00.000Z",
  sourceType: "url",
};

const profile = {
  name: "Vinnie Example",
  location: "London",
  headline: "Product & Project Delivery",
  summary: "Technology, project delivery and commercial professional.",
  employment: [
    {
      id: "profile-role-a",
      title: "Marketing & Operations Executive",
      company: "IDEA StatiCa UK",
      employmentType: "Contract",
      start: "Sep 2023",
      end: "Jun 2024",
      location: "London",
      summary: "Technology and delivery role.",
      highlights: [],
      skills: ["Project Delivery", "Stakeholder Management"],
    },
  ],
  education: [],
  certifications: [],
  projects: [],
  skills: ["Product Development", "Project Delivery", "Stakeholder Management", "Commercial Analysis"],
  tools: ["Asana", "Power BI", "Salesforce"],
  domains: ["Technology"],
};

const data = {
  profile,
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

const knowledgeItems = [
  item(
    "intentionally",
    "Intentionally founder-led MVP",
    "Owned product vision, problem framing, MVP scope, roadmap, success metrics, customer proposition and QA planning.",
    { employment_role_id: null, category: "project" },
  ),
  item(
    "crm",
    "Salesforce to Zoho CRM migration",
    "Owned and coordinated a cross-functional CRM migration project with stakeholders and delivery planning.",
    { category: "project" },
  ),
  item(
    "asana",
    "Asana and Agile-style workflow improvements",
    "Introduced Agile-style project delivery practices to improve ownership, sequencing and stakeholder visibility.",
    { category: "achievement" },
  ),
  item(
    "commercial",
    "15% conversion uplift / 36% ROI improvement",
    "Commercial performance outcome linked to analytics and stakeholder decisions.",
    { category: "metric", status: "verified" },
  ),
  item(
    "unrelated",
    "Paid-search keyword optimisation",
    "Optimised PPC keywords and paid-search targeting.",
  ),
  item(
    "imported",
    "Imported product management claim",
    "Product management claim imported from a CV.",
    { status: "imported_cv" },
  ),
  item(
    "excluded",
    "Conflicting product claim",
    "Conflicting historical product claim.",
    { status: "excluded" },
  ),
];

describe("Capital on Tap tailoring regression", () => {
  it("selects the Product master and prioritises relevant eligible evidence", () => {
    expect(selectMasterCvFamily(capitalOnTapJob)).toBe("Product / Product Management");

    const ranked = rankEvidenceForJob(knowledgeItems, capitalOnTapJob.description);
    expect(ranked.findIndex((row) => row.item.id === "crm")).toBeLessThan(
      ranked.findIndex((row) => row.item.id === "unrelated"),
    );
    expect(ranked.map((row) => row.item.id)).not.toContain("imported");
    expect(ranked.map((row) => row.item.id)).not.toContain("excluded");
  });

  it("generates only traceable factual experience claims and keeps the result ready for Draft review", () => {
    const result = buildTailoredCvFromKnowledge(data, capitalOnTapJob, undefined, {
      employmentRoles: [role],
      knowledgeItems,
    });

    const experienceClaims = result.claims.filter((claim) => claim.section === "experience");
    expect(result.masterFamily).toBe("Product / Product Management");
    expect(result.ready).toBe(true);
    expect(experienceClaims).toHaveLength(3);
    expect(experienceClaims.every((claim) => claim.evidenceIds.length === 1)).toBe(true);
    expect(result.evidenceIds).not.toContain("imported");
    expect(result.evidenceIds).not.toContain("excluded");
  });
});
