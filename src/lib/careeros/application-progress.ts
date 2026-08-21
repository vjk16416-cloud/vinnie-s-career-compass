import type { ApplicationGateState } from "./types";

export type ApplicationWorkflowStageState = "complete" | "current" | "upcoming";

export interface ApplicationWorkflowStage {
  label: string;
  state: ApplicationWorkflowStageState;
}

export interface ApplicationProgressInput {
  hasSavedJob: boolean;
  scanCurrent: boolean;
  hasEvidenceMap: boolean;
  hasCv: boolean;
  hasCoverLetter: boolean;
  gateState: ApplicationGateState;
}

export interface ApplicationProgressResult {
  stages: ApplicationWorkflowStage[];
  nextAction: string;
}

export function deriveApplicationProgress({
  hasSavedJob,
  scanCurrent,
  hasEvidenceMap,
  hasCv,
  hasCoverLetter,
  gateState,
}: ApplicationProgressInput): ApplicationProgressResult {
  const readyToApply = gateState === "READY TO APPLY";
  const reviewerPassed = gateState === "READY FOR VINNIE APPROVAL";

  const completion = [
    hasSavedJob,
    scanCurrent,
    hasEvidenceMap,
    hasCv,
    hasCoverLetter,
    readyToApply,
  ];
  const labels = ["Job", "Match", "Evidence", "CV", "Cover Letter", "Apply"] as const;
  const firstIncomplete = completion.findIndex((complete) => !complete);

  const stages: ApplicationWorkflowStage[] = labels.map((label, index) => ({
    label,
    state: completion[index]
      ? "complete"
      : index === firstIncomplete
        ? "current"
        : "upcoming",
  }));

  if (!hasSavedJob) return { stages, nextAction: "Add and save the job description" };
  if (!scanCurrent) return { stages, nextAction: "Run the role scan" };
  if (!hasEvidenceMap) return { stages, nextAction: "Review the evidence map" };
  if (!hasCv) return { stages, nextAction: "Create the tailored CV" };
  if (!hasCoverLetter) return { stages, nextAction: "Create the cover letter" };
  if (readyToApply) return { stages, nextAction: "Submit the application" };
  if (reviewerPassed) {
    stages[5] = { label: "Apply", state: "current" };
    return { stages, nextAction: "Approve the current CV and cover letter" };
  }
  if (gateState === "NEEDS INPUT") return { stages, nextAction: "Resolve missing evidence or input" };
  if (gateState === "NEEDS REVISION") return { stages, nextAction: "Revise the application pack" };
  if (gateState === "REVIEW OUTDATED") return { stages, nextAction: "Re-run final review" };

  return { stages, nextAction: "Run final review" };
}
