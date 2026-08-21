import "@/test/dom";
import "@/test/setup";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createCareerOsData } from "@/lib/careeros/profile-data";
import { textSignature } from "@/lib/careeros/review-signature";
import { ApplicationRouteProgress } from "./application-route-progress";

afterEach(cleanup);

describe("ApplicationRouteProgress", () => {
  it("renders guided progress only on an application detail route", () => {
    const data = createCareerOsData();
    const app = data.applications[0]!;
    const job = data.jobs.find((candidate) => candidate.id === app.jobId)!;
    data.scans = [
      {
        id: "scan-progress",
        jobId: job.id,
        createdAt: "2026-08-21T08:00:00.000Z",
        jobDescriptionSignature: textSignature(job.description),
        overall: 75,
        verdict: "Competitive",
        subScores: [],
        strengths: [],
        partials: [],
        gaps: [],
        missingKeywords: [],
        matchedKeywords: [],
        blockedEvidence: [],
        evidenceMap: [],
        strategy: "Apply with tailored positioning",
        reasons: [],
      },
    ];

    const { rerender } = render(
      <ApplicationRouteProgress pathname={`/applications/${app.id}`} data={data} />,
    );

    expect(screen.getByRole("region", { name: "Application progress" })).toBeInTheDocument();
    expect(screen.getByText("Next: Review the evidence map")).toBeInTheDocument();

    rerender(<ApplicationRouteProgress pathname="/applications" data={data} />);
    expect(screen.queryByRole("region", { name: "Application progress" })).not.toBeInTheDocument();
  });
});
