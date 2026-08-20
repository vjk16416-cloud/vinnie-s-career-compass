import { describe, expect, it } from "vitest";
import { computeHomeAttention, summariseAttention, todayIso } from "./home-attention";
import { createCareerOsData } from "./profile-data";
import type { CareerOsData } from "./types";

const TODAY = "2026-08-20";

function baseData(): CareerOsData {
  const data = createCareerOsData();
  data.applications = [];
  data.cvs = [];
  data.coverLetters = [];
  data.scans = [];
  data.evidence = [];
  return data;
}

function application(overrides: Partial<CareerOsData["applications"][number]> = {}) {
  return {
    id: "app-1",
    jobId: "job-1",
    company: "Example Co",
    title: "Product Manager",
    location: "London",
    workingArrangement: "Hybrid" as const,
    employmentType: "Permanent" as const,
    priority: "High" as const,
    stage: "Applied" as const,
    dateAdded: "2026-08-01",
    notes: "",
    nextAction: "Follow up",
    history: [],
    ...overrides,
  };
}

describe("computeHomeAttention", () => {
  it("returns nothing when all state is complete", () => {
    expect(computeHomeAttention(baseData(), TODAY)).toEqual([]);
  });

  it("flags active applications with a blank next action", () => {
    const data = baseData();
    data.applications = [application({ nextAction: "   " })];
    const items = computeHomeAttention(data, TODAY);
    expect(items).toHaveLength(1);
    expect(items[0]!.group).toBe("next-action");
    expect(items[0]!.link).toEqual({ kind: "application", applicationId: "app-1" });
  });

  it("ignores closed applications", () => {
    const data = baseData();
    data.applications = [application({ stage: "Rejected", nextAction: undefined })];
    expect(computeHomeAttention(data, TODAY)).toEqual([]);
  });

  it("flags deadlines that are due today or overdue but not future ones", () => {
    const data = baseData();
    data.applications = [
      application({ id: "a-today", deadline: TODAY }),
      application({ id: "a-past", deadline: "2026-08-01" }),
      application({ id: "a-future", deadline: "2026-09-01" }),
    ];
    const deadlines = computeHomeAttention(data, TODAY).filter((i) => i.group === "deadline");
    expect(deadlines.map((i) => i.id).sort()).toEqual(["deadline-a-past", "deadline-a-today"]);
    expect(deadlines.every((i) => i.severity === "urgent")).toBe(true);
  });

  it("flags draft CVs and cover letters only for active applications", () => {
    const data = baseData();
    data.applications = [application(), application({ id: "app-2", stage: "Accepted" })];
    data.cvs = [
      {
        id: "cv-1",
        name: "PM CV",
        category: "Product Management",
        status: "Draft",
        applicationId: "app-1",
        versions: [],
        updatedAt: "2026-08-10",
      },
      {
        id: "cv-2",
        name: "Closed CV",
        category: "General",
        status: "Draft",
        applicationId: "app-2",
        versions: [],
        updatedAt: "2026-08-10",
      },
      {
        id: "cv-3",
        name: "Approved CV",
        category: "General",
        status: "Approved",
        applicationId: "app-1",
        versions: [],
        updatedAt: "2026-08-10",
      },
    ];
    data.coverLetters = [
      {
        id: "cl-1",
        applicationId: "app-1",
        status: "Draft",
        body: "",
        emailVersion: "",
        evidenceIds: [],
        createdAt: "2026-08-10",
      },
      {
        id: "cl-2",
        applicationId: "app-2",
        status: "Draft",
        body: "",
        emailVersion: "",
        evidenceIds: [],
        createdAt: "2026-08-10",
      },
    ];
    const items = computeHomeAttention(data, TODAY);
    expect(items.filter((i) => i.group === "cv-draft").map((i) => i.id)).toEqual(["cv-cv-1"]);
    expect(items.filter((i) => i.group === "letter-draft").map((i) => i.id)).toEqual(["letter-cl-1"]);
  });

  it("flags scans holding blocked or gapped requirements and links to the application", () => {
    const data = baseData();
    data.applications = [application()];
    data.scans = [
      {
        id: "scan-1",
        jobId: "job-1",
        createdAt: "2026-08-10T00:00:00.000Z",
        overall: 60,
        verdict: "Competitive",
        subScores: [],
        strengths: [],
        partials: [],
        gaps: [],
        missingKeywords: [],
        matchedKeywords: [],
        blockedEvidence: [],
        strategy: "Consider",
        reasons: [],
        evidenceMap: [
          {
            id: "req-1",
            requirement: "Managed £1m budget",
            category: "Responsibility",
            priority: "Required",
            status: "Blocked",
            score: 0,
            evidenceIds: [],
            profileItemIds: [],
            sourceIds: [],
            explanation: "Evidence not verified",
          },
          {
            id: "req-2",
            requirement: "SQL",
            category: "Skill",
            priority: "Preferred",
            status: "Covered",
            score: 1,
            evidenceIds: [],
            profileItemIds: [],
            sourceIds: [],
            explanation: "Covered",
          },
        ],
      },
    ];
    const items = computeHomeAttention(data, TODAY).filter((i) => i.group === "scan-evidence");
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toContain("1 requirement");
    expect(items[0]!.link).toEqual({ kind: "application", applicationId: "app-1" });
  });

  it("flags evidence records needing evidence", () => {
    const data = baseData();
    data.evidence = [
      {
        id: "ev-1",
        employer: "Example Co",
        category: "Delivery",
        claim: "Delivered programme",
        source: "CV",
        confidence: "Medium",
        status: "Needs Evidence",
        skills: [],
        updatedAt: "2026-08-01",
      },
    ];
    const items = computeHomeAttention(data, TODAY);
    expect(items).toHaveLength(1);
    expect(items[0]!.link).toEqual({ kind: "route", to: "/evidence" });
  });

  it("orders urgent items first and summarises counts", () => {
    const data = baseData();
    data.applications = [application({ nextAction: "", deadline: "2026-08-01" })];
    const items = computeHomeAttention(data, TODAY);
    expect(items[0]!.severity).toBe("urgent");
    expect(summariseAttention(items)).toEqual({ urgent: 1, total: 2 });
  });
});

describe("todayIso", () => {
  it("formats as an ISO date", () => {
    expect(todayIso(new Date("2026-08-20T22:10:00.000Z"))).toBe("2026-08-20");
  });
});
