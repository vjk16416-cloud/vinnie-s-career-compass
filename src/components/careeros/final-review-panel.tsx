import { Button } from "@/components/ui/button";
import { Panel, StatusPill } from "./ui-bits";
import type { ApplicationGateState, ApplicationReviewRun } from "@/lib/careeros/types";

type FinalReviewPanelProps = {
  gateState: ApplicationGateState;
  latestReview?: ApplicationReviewRun | undefined;
  scanCurrent: boolean;
  currentCvLabel?: string | undefined;
  currentCoverLetterLabel?: string | undefined;
  reviewedCvLabel?: string | undefined;
  reviewedCoverLetterLabel?: string | undefined;
  canRunReview: boolean;
  reviewDisabledReason?: string | undefined;
  onRunReview: () => void;
};

function gateTone(
  state: ApplicationGateState,
): "neutral" | "success" | "warning" | "danger" | "info" {
  if (state === "READY TO APPLY") return "success";
  if (state === "READY FOR VINNIE APPROVAL") return "info";
  if (state === "NEEDS INPUT" || state === "NEEDS REVISION") return "danger";
  if (state === "REVIEW OUTDATED") return "warning";
  return "neutral";
}

function checkTone(
  status: ApplicationReviewRun["checks"][number]["status"],
): "success" | "warning" | "danger" {
  if (status === "Pass") return "success";
  if (status === "Warning") return "warning";
  return "danger";
}

export function FinalReviewPanel({
  gateState,
  latestReview,
  scanCurrent,
  currentCvLabel,
  currentCoverLetterLabel,
  reviewedCvLabel,
  reviewedCoverLetterLabel,
  canRunReview,
  reviewDisabledReason,
  onRunReview,
}: FinalReviewPanelProps) {
  return (
    <Panel
      title="Final review"
      description="Independent Agent 02 checks before your explicit document approval."
      actions={
        <Button size="sm" onClick={onRunReview} disabled={!canRunReview}>
          {latestReview ? "Re-run final review" : "Run final review"}
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        <StatusPill label={`Reviewer status: ${gateState}`} tone={gateTone(gateState)} />
        <StatusPill
          label={`Scan: ${scanCurrent ? "Current" : "Needs re-scan"}`}
          tone={scanCurrent ? "success" : "warning"}
        />
      </div>

      {currentCvLabel && currentCoverLetterLabel ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Current pack: {currentCvLabel} · {currentCoverLetterLabel}
        </p>
      ) : null}

      {reviewedCvLabel && reviewedCoverLetterLabel ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Reviewed pack: {reviewedCvLabel} · {reviewedCoverLetterLabel}
        </p>
      ) : null}

      {!canRunReview && reviewDisabledReason ? (
        <p className="mt-3 text-xs text-warning">{reviewDisabledReason}</p>
      ) : null}

      {gateState === "REVIEW OUTDATED" ? (
        <p className="mt-3 text-xs text-warning">
          The previous review no longer matches the current application pack. Re-run the final
          review before approval.
        </p>
      ) : null}

      {latestReview ? (
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground">Reviewer checks</h3>
            <ul className="mt-2 space-y-2">
              {latestReview.checks.map((check) => (
                <li key={check.key} className="rounded-md border border-border p-3">
                  <StatusPill label={`${check.label}: ${check.status}`} tone={checkTone(check.status)} />
                  {check.findings.length ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {check.findings.map((item) => (
                        <li key={item.id}>{item.message}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {latestReview.strengths.length ? (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground">What is strong</h3>
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {latestReview.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {latestReview.highPriorityFixes.length ? (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground">High-priority fixes</h3>
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {latestReview.highPriorityFixes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
