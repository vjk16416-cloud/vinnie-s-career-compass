import { describe, expect, it } from "vitest";
import { createCareerOsData } from "./profile-data";
import { reviewApplicationPack, type ReviewPack } from "./review";
import { runScan } from "./scoring";
import type { Application, CoverLetter, CvDocument } from "./types";

function makePack(): ReviewPack {
  const data = createCareerOsData();
  const job = data.jobs[0]!;
  const scan = runScan(job, data);
  const application: Application = {
    id: "app-review",
    jobId: job.id,
    company: job.company,
    title: job.title,
    location: job.location,
    workingArrangement: "Hybrid",
    employmentType: "Permanent",
    priority: "High",
    stage: "Preparing",
    dateAdded: "2026-08-20T00:00:00.000Z",
    notes: "Reviewer fixture",
    nextAction: "Run final review",
    compatibilityScore: scan.overall,
    linkedCvId: "cv-review",
    history: [],
  };
  const cv: CvDocument = {
    id: "cv-review",
    name: `${job.title} | ${job.company}`,
    category: "Product Marketing",
    status: "Draft",
    applicationId: application.id,
    jobId: job.id,
    updatedAt: "2026-08-20T00:00:00.000Z",
    versions: [
      {
        id: "cvv-review-1",
        version: 1,
        createdAt: "2026-08-20T00:00:00.000Z",
        note: "Reviewer fixture",
        body: [
          "# Vinnie Jegathees",
          "## Professional Experience",
          "- Delivered landing-page and A/B testing work with website and stakeholder teams.",
        ].join("\n"),
        evidenceIds: ["ev-ab"],
      },
    ],
  };
  const coverLetter: CoverLetter = {
    id: "cl-review-1",
    applicationId: application.id,
    jobId: job.id,
    status: "Draft",
    body: [
      "Dear Hiring Team,",
      "",
      `I am applying for the ${job.title} role at ${job.company}.`,
      "My verified experience includes landing-page and A/B testing work with website and stakeholder teams.",
      "",
      "Yours sincerely,",
      "Vinnie Jegathees",
    ].join("\n"),
    emailVersion: `Application for ${job.title} at ${job.company}`,
    evidenceIds: ["ev-ab"],
    createdAt: "2026-08-20T00:00:00.000Z",
  };

  return {
    data,
    application,
    job,
    scan,
    cv,
    cvVersion: cv.versions[0]!,
    coverLetter,
  };
}

describe("Agent 02 application-pack reviewer", () => {
  it("can reach READY FOR VINNIE APPROVAL when no blocking issue remains", () => {
    expect(reviewApplicationPack(makePack()).outcome).toBe("READY FOR VINNIE APPROVAL");
  });

  it("returns NEEDS INPUT for unverified evidence", () => {
    const pack = makePack();
    pack.data.evidence.find((item) => item.id === "ev-ab")!.status = "Needs Evidence";
    expect(reviewApplicationPack(pack).outcome).toBe("NEEDS INPUT");
  });

  it("returns NEEDS INPUT for an unsupported metric", () => {
    const pack = makePack();
    pack.cvVersion.body += "\n- Increased conversion by 91%.";
    const result = reviewApplicationPack(pack);
    expect(result.outcome).toBe("NEEDS INPUT");
    expect(result.checks.find((check) => check.key === "metrics")?.status).toBe("Fail");
  });

  it("returns NEEDS INPUT for a chronology conflict", () => {
    const pack = makePack();
    pack.cvVersion.body += "\nNortheastern University London | 2022-2025";
    const result = reviewApplicationPack(pack);
    expect(result.outcome).toBe("NEEDS INPUT");
    expect(result.checks.find((check) => check.key === "chronology")?.status).toBe("Fail");
  });

  it("returns NEEDS REVISION for an em dash", () => {
    const pack = makePack();
    pack.coverLetter.body += "\nDelivery — analytics.";
    expect(reviewApplicationPack(pack).outcome).toBe("NEEDS REVISION");
  });

  it("returns NEEDS REVISION for known US spelling", () => {
    const pack = makePack();
    pack.coverLetter.body += "\nI optimized campaign reporting.";
    expect(reviewApplicationPack(pack).outcome).toBe("NEEDS REVISION");
  });

  it("keeps unsupported ATS keywords advisory", () => {
    const result = reviewApplicationPack(makePack());
    const ats = result.checks.find((check) => check.key === "ats")!;
    expect(ats.status).toBe("Warning");
    expect(ats.findings.length).toBeGreaterThan(0);
    expect(result.outcome).toBe("READY FOR VINNIE APPROVAL");
  });

  it("flags weak bullets as advisory STAR findings", () => {
    const pack = makePack();
    pack.cvVersion.body += "\n- Helped.";
    const result = reviewApplicationPack(pack);
    const star = result.checks.find((check) => check.key === "star")!;
    expect(star.status).toBe("Warning");
    expect(star.findings.length).toBeGreaterThan(0);
    expect(result.outcome).toBe("READY FOR VINNIE APPROVAL");
  });

  it("labels heuristic prose findings as AI-like language risk", () => {
    const pack = makePack();
    pack.coverLetter.body += "\nI am a results-driven professional.";
    const result = reviewApplicationPack(pack);
    const aiRisk = result.checks.find((check) => check.key === "ai-language-risk")!;
    expect(aiRisk.label).toBe("AI-like language risk");
    expect(aiRisk.status).toBe("Warning");
    expect(aiRisk.findings.length).toBeGreaterThan(0);
  });

  it("blocks a cover letter that does not name the current role", () => {
    const pack = makePack();
    pack.coverLetter.body = pack.coverLetter.body.replace(pack.job.title, "another opportunity");
    const result = reviewApplicationPack(pack);
    expect(result.outcome).toBe("NEEDS REVISION");
    expect(result.checks.find((check) => check.key === "cover-letter")?.status).toBe("Fail");
  });

  it("blocks non-Verified cover-letter evidence", () => {
    const pack = makePack();
    pack.data.evidence.find((item) => item.id === "ev-ab")!.status = "Archived";
    expect(reviewApplicationPack(pack).outcome).toBe("NEEDS INPUT");
  });

  it("allows advisory warnings while remaining READY FOR VINNIE APPROVAL", () => {
    const pack = makePack();
    pack.coverLetter.body += "\nI am a results-driven professional.";
    expect(reviewApplicationPack(pack).outcome).toBe("READY FOR VINNIE APPROVAL");
  });

  it("uses NEEDS INPUT before NEEDS REVISION when both exist", () => {
    const pack = makePack();
    pack.cvVersion.body += "\n- Increased conversion by 91%.";
    pack.coverLetter.body += "\nDelivery — analytics.";
    expect(reviewApplicationPack(pack).outcome).toBe("NEEDS INPUT");
  });
});
