import { describe, expect, it } from "vitest";
import { createCareerOsData } from "./profile-data";
import { buildHomeAttention } from "./home-focus";

describe("buildHomeAttention", () => {
  it("surfaces only real workflow attention from CareerOS state", () => {
    const data = createCareerOsData();
    data.applications = [
      {
        id: "app-1",
        jobId: "job-1",
        company: "Example Co",
        title: "Growth Lead",
        location: "London",
        workingArrangement: "Hybrid",
        employmentType: "Permanent",
        priority: "High",
        stage: "Preparing",
        dateAdded: "2026-08-19",
        deadline: "2026-08-20",
        notes: "",
        compatibilityScore: 72,
        history: [],
      },
    ];
    data.cvs = [
      {
        id: "cv-1",
        name: "Growth Lead | Example Co",
        category: "General",
        status: "Draft",
        applicationId: "app-1",
        jobId: "job-1",
        versions: [],
        updatedAt: "2026-08-20T00:00:00.000Z",
      },
    ];
    data.coverLetters = [
      {
        id: "cl-1",
        applicationId: "app-1",
        jobId: "job-1",
        status: "Draft",
        body: "Draft",
        emailVersion: "Draft email",
        evidenceIds: [],
        createdAt: "2026-08-20T00:00:00.000Z",
      },
    ];
    data.scans = [
      {
        id: "scan-1",
        jobId: "job-1",
        createdAt: "2026-08-20T00:00:00.000Z",
        overall: 72,
        verdict: "Competitive",
        subScores: [],
        strengths: [],
        partials: [],
        gaps: [],
        missingKeywords: [],
        matchedKeywords: [],
        blockedEvidence: [],
        strategy: "Apply with tailored positioning",
        reasons: [],
        evidenceMap: [
          {
            id: "req-1",
            requirement: "People management",
            category: "Responsibility",
            priority: "Required",
            status: "Gap",
            score: 0,
            evidenceIds: [],
            profileItemIds: [],
            sourceIds: [],
            explanation: "No approved evidence.",
          },
        ],
      },
    ];
    data.evidence = data.evidence.map((record, index) =>
      index === 0 ? { ...record, status: "Needs Evidence" as const } : record,
    );

    const items = buildHomeAttention(data, new Date("2026-08-20T12:00:00.000Z"));
    expect(items.map((item) => item.kind)).toEqual([
      "next-action",
      "deadline",
      "cv-draft",
      "letter-draft",
      "evidence-gap",
      "needs-evidence",
    ]);
  });

  it("returns no attention items when everything is complete", () => {
    const data = createCareerOsData();
    data.applications = [];
    data.evidence = data.evidence.map((record) => ({ ...record, status: "Verified" as const }));
    expect(buildHomeAttention(data, new Date("2026-08-20T12:00:00.000Z"))).toEqual([]);
  });
});
