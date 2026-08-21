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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Application progress</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {completeCount} of {stages.length} complete
          </p>
        </div>
        <p className="text-xs font-medium text-foreground">Next: {nextAction}</p>
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {stages.map((stage, index) => (
          <li
            key={stage.label}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground">{index + 1}</span>
              <span className="text-xs font-medium text-foreground">{stage.label}</span>
            </div>
            <p className="mt-1 text-[11px] capitalize text-muted-foreground">{stage.state}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
