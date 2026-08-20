import "@/test/dom";
import "@/test/setup";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinalReviewPanel } from "./final-review-panel";
import type { ApplicationReviewRun } from "@/lib/careeros/types";

const passingReview: ApplicationReviewRun = {
  id: "review-1",
  applicationId: "app-1",
  jobId: "job-1",
  scanId: "scan-1",
  cvId: "cv-1",
  cvVersionId: "cvv-2",
  coverLetterId: "cl-2",
  inputSignature: "signature-1",
  createdAt: "2026-08-20T02:30:00.000Z",
  outcome: "READY FOR VINNIE APPROVAL",
  checks: [
    {
      key: "evidence",
      label: "Evidence and unsupported claims",
      status: "Pass",
      findings: [],
    },
    {
      key: "ats",
      label: "ATS and terminology",
      status: "Warning",
      findings: [
        {
          id: "ats-warning",
          check: "ats",
          severity: "Advisory",
          resolution: "Advisory",
          message: "Keep unsupported keywords out of the CV.",
        },
      ],
    },
  ],
  strengths: ["Evidence is verified and traceable."],
  highPriorityFixes: [],
};

afterEach(cleanup);

describe("FinalReviewPanel", () => {
  it("shows the current pack and invites the first final review", () => {
    const onRunReview = vi.fn();
    render(
      <FinalReviewPanel
        gateState="NOT REVIEWED"
        scanCurrent
        currentCvLabel="CV v2"
        currentCoverLetterLabel="Cover letter v2"
        canRunReview
        onRunReview={onRunReview}
      />,
    );

    expect(screen.getByRole("heading", { name: "Final review" })).toBeInTheDocument();
    expect(screen.getByText("Reviewer status: NOT REVIEWED")).toBeInTheDocument();
    expect(screen.getByText("Current pack: CV v2 · Cover letter v2")).toBeInTheDocument();
    expect(screen.getByText("Scan: Current")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run final review" }));
    expect(onRunReview).toHaveBeenCalledOnce();
  });

  it("shows the exact reviewed pack, checks and reviewer guidance", () => {
    render(
      <FinalReviewPanel
        gateState="READY FOR VINNIE APPROVAL"
        latestReview={passingReview}
        scanCurrent
        currentCvLabel="CV v2"
        currentCoverLetterLabel="Cover letter v2"
        reviewedCvLabel="CV v2"
        reviewedCoverLetterLabel="Cover letter v2"
        canRunReview
        onRunReview={vi.fn()}
      />,
    );

    expect(screen.getByText("Reviewer status: READY FOR VINNIE APPROVAL")).toBeInTheDocument();
    expect(screen.getByText("Reviewed pack: CV v2 · Cover letter v2")).toBeInTheDocument();
    expect(screen.getByText("Evidence and unsupported claims: Pass")).toBeInTheDocument();
    expect(screen.getByText("ATS and terminology: Warning")).toBeInTheDocument();
    expect(screen.getByText("Evidence is verified and traceable.")).toBeInTheDocument();
    expect(screen.getByText("Keep unsupported keywords out of the CV.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Re-run final review" })).toBeInTheDocument();
  });
});
