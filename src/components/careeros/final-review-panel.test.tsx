import "@/test/dom";
import "@/test/setup";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApplicationReviewRun, CareerOsData } from "@/lib/careeros/types";

const storeData = vi.hoisted(() => ({
  current: {
    evidence: [
      {
        id: "e-product",
        employer: "IDEA StatiCa UK",
        category: "Product & Innovation",
        claim: "Led cross-functional delivery of customer-facing software adoption initiatives",
        source: "Verified career evidence",
        confidence: "High",
        status: "Verified",
        skills: ["delivery"],
        updatedAt: "2026-08-21T00:00:00.000Z",
      },
      {
        id: "e-blocked",
        employer: "Other",
        category: "Commercial",
        claim: "This claim should not appear",
        source: "Old CV",
        confidence: "Low",
        status: "Excluded",
        skills: ["sales"],
        updatedAt: "2026-08-21T00:00:00.000Z",
      },
    ],
    profile: {
      employment: [
        {
          id: "role-1",
          title: "Marketing & Operations Executive",
          company: "IDEA StatiCa UK",
          employmentType: "Permanent",
          start: "2023",
          end: "2024",
          location: "London",
          summary: "",
          highlights: ["Led delivery across customer software adoption and internal teams."],
          skills: ["delivery"],
        },
      ],
    },
    cvs: [
      {
        id: "cv-1",
        name: "APM CV",
        category: "Product Management",
        status: "Draft",
        updatedAt: "2026-08-21T00:00:00.000Z",
        versions: [
          {
            id: "cvv-2",
            version: 2,
            createdAt: "2026-08-21T00:00:00.000Z",
            note: "Tailored draft",
            body: "CV body",
            evidenceIds: ["e-product"],
          },
        ],
      },
    ],
  } as unknown as CareerOsData,
}));

vi.mock("@/lib/careeros/store", () => ({
  useCareerOs: () => ({ data: storeData.current }),
}));

import { FinalReviewPanel } from "./final-review-panel";

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

  it("shows Original, Proposed and only the reviewed CV version's verified evidence", () => {
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

    expect(screen.getByText("CV claim evidence trace")).toBeInTheDocument();
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.getByText("Proposed")).toBeInTheDocument();
    expect(screen.getByText("Evidence")).toBeInTheDocument();
    expect(
      screen.getByText("Led delivery across customer software adoption and internal teams."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Led cross-functional delivery of customer-facing software adoption initiatives."),
    ).toBeInTheDocument();
    expect(screen.getByText(/IDEA StatiCa UK · Verified · e-product/)).toBeInTheDocument();
    expect(screen.queryByText("This claim should not appear")).not.toBeInTheDocument();
  });
});
