import { describe, expect, it } from "vitest";
import { deriveApplicationProgress } from "./application-progress";

const baseInput = {
  hasSavedJob: true,
  scanCurrent: true,
  hasEvidenceMap: true,
  hasCv: true,
  hasCoverLetter: true,
  gateState: "NOT REVIEWED" as const,
};

describe("deriveApplicationProgress", () => {
  it("guides the user to the first incomplete stage", () => {
    expect(
      deriveApplicationProgress({
        ...baseInput,
        scanCurrent: false,
        hasEvidenceMap: false,
        hasCv: false,
        hasCoverLetter: false,
      }),
    ).toEqual({
      stages: [
        { label: "Job", state: "complete" },
        { label: "Match", state: "current" },
        { label: "Evidence", state: "upcoming" },
        { label: "CV", state: "upcoming" },
        { label: "Cover Letter", state: "upcoming" },
        { label: "Apply", state: "upcoming" },
      ],
      nextAction: "Run the role scan",
    });
  });

  it("moves to final review once the application pack exists", () => {
    expect(deriveApplicationProgress(baseInput).nextAction).toBe("Run final review");
  });

  it("makes approval the next action after the reviewer passes", () => {
    const progress = deriveApplicationProgress({
      ...baseInput,
      gateState: "READY FOR VINNIE APPROVAL",
    });

    expect(progress.stages[5]).toEqual({ label: "Apply", state: "current" });
    expect(progress.nextAction).toBe("Approve the current CV and cover letter");
  });

  it("marks the whole workflow complete only when ready to apply", () => {
    const progress = deriveApplicationProgress({
      ...baseInput,
      gateState: "READY TO APPLY",
    });

    expect(progress.stages.every((stage) => stage.state === "complete")).toBe(true);
    expect(progress.nextAction).toBe("Submit the application");
  });
});
