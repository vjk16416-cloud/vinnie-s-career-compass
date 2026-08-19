import { describe, expect, it } from "vitest";

import { createCareerOsData } from "./profile-data";
import { runScan } from "./scoring";
import type { JobRecord } from "./types";

type EvidenceMapItem = {
  requirement: string;
  category: string;
  priority: string;
  status: string;
  score: number;
  evidenceIds: string[];
  profileItemIds: string[];
  explanation: string;
};

function job(description: string): JobRecord {
  return {
    id: "job-evidence-map-test",
    company: "Example Co",
    title: "Example role",
    location: "London",
    description,
    createdAt: "2026-08-19T16:00:00.000Z",
    sourceType: "paste",
  };
}

function evidenceMap(result: ReturnType<typeof runScan>): EvidenceMapItem[] {
  return (result as unknown as { evidenceMap?: EvidenceMapItem[] }).evidenceMap ?? [];
}

function findRequirement(items: EvidenceMapItem[], text: RegExp) {
  return items.find((item) => text.test(item.requirement));
}

describe("evidence-first role scoring", () => {
  it("marks a requirement Covered only when verified evidence directly supports it", () => {
    const data = createCareerOsData();
    const result = runScan(
      job(
        "This role requires budget ownership across PPC and paid social, senior stakeholder reporting, and A/B testing delivery.",
      ),
      data,
    );

    const budget = findRequirement(evidenceMap(result), /budget ownership/i);

    expect(budget).toMatchObject({
      category: "Responsibility",
      priority: "Required",
      status: "Covered",
    });
    expect(budget?.evidenceIds).toContain("ev-budget");
    expect(budget?.score).toBe(100);
  });

  it("marks matching but unapproved evidence Blocked and gives it zero score", () => {
    const data = createCareerOsData();
    const budget = data.evidence.find((record) => record.id === "ev-budget");
    if (!budget) throw new Error("Expected seeded budget evidence");
    budget.status = "Needs Evidence";

    const result = runScan(
      job("Budget ownership across PPC and paid social is required for this role."),
      data,
    );
    const mapped = findRequirement(evidenceMap(result), /budget ownership/i);

    expect(mapped).toMatchObject({ status: "Blocked", score: 0 });
    expect(mapped?.evidenceIds).toContain("ev-budget");
  });

  it("uses approved Master Profile qualifications instead of assuming qualifications are met", () => {
    const data = createCareerOsData();

    const apm = runScan(job("APM Project Fundamentals Qualification (PFQ) is required."), data);
    const apmRequirement = findRequirement(evidenceMap(apm), /APM Project Fundamentals/i);
    expect(apmRequirement).toMatchObject({
      category: "Qualification",
      status: "Covered",
    });
    expect(apmRequirement?.profileItemIds).toContain("pi-apm-pfq");

    const prince2 = runScan(job("PRINCE2 Practitioner certification is required."), data);
    const prince2Requirement = findRequirement(evidenceMap(prince2), /PRINCE2 Practitioner/i);
    expect(prince2Requirement).toMatchObject({
      category: "Qualification",
      status: "Blocked",
      score: 0,
    });
    expect(prince2Requirement?.profileItemIds).toContain("pi-prince2-practitioner");
  });

  it("calculates requested years against the actual employment record rather than a fixed number", () => {
    const data = createCareerOsData();
    data.profile.employment = [
      {
        id: "emp-short",
        title: "Project Coordinator",
        company: "Example Co",
        employmentType: "Contract",
        start: "Jan 2025",
        end: "Dec 2025",
        location: "London",
        summary: "Project coordination.",
        highlights: ["Supported project delivery."],
        skills: ["Project delivery"],
      },
    ];

    const result = runScan(
      job("At least 5 years of project delivery experience is required."),
      data,
    );
    const experience = findRequirement(evidenceMap(result), /5 years/i);

    expect(experience).toMatchObject({
      category: "Experience",
      status: "Partial",
    });
    expect(experience?.score).toBeLessThan(50);
    expect(experience?.explanation).toMatch(/1(\.0)? year/i);
  });

  it("shows direct line management as a Gap when no safe evidence supports it", () => {
    const data = createCareerOsData();
    const result = runScan(
      job("Direct line management of a team of five people is a required responsibility."),
      data,
    );
    const lineManagement = findRequirement(evidenceMap(result), /line management/i);

    expect(lineManagement).toMatchObject({
      category: "Responsibility",
      status: "Gap",
      score: 0,
      evidenceIds: [],
    });
  });
});
