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
});
