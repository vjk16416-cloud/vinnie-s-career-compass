import { Check, Circle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

export type ApplicationWorkflowStageState = "complete" | "current" | "upcoming";

export interface ApplicationWorkflowStage {
  label: string;
  state: ApplicationWorkflowStageState;
}

export function ApplicationWorkflowProgress({
  stages,
  nextAction,
}: {
  stages: ApplicationWorkflowStage[];
  nextAction: string;
}) {
  const completeCount = stages.filter((stage) => stage.state === "complete").length;

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-label="Application progress">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Application progress</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {completeCount} of {stages.length} complete
          </p>
        </div>
        <p className="max-w-md text-xs font-medium text-foreground">Next: {nextAction}</p>
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {stages.map((stage, index) => {
          const Icon = stage.state === "complete" ? Check : stage.state === "current" ? CircleDot : Circle;
          return (
            <li
              key={stage.label}
              className={cn(
                "rounded-md border px-3 py-2",
                stage.state === "current"
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-background",
              )}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    stage.state === "complete" || stage.state === "current"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-foreground">{stage.label}</span>
              </div>
              <p className="mt-1 pl-5.5 text-[11px] text-muted-foreground">
                {index + 1}. {stage.state === "complete" ? "Complete" : stage.state === "current" ? "Current" : "Upcoming"}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
