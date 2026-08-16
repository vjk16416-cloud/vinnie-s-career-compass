import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/careeros/app-shell";
import { EmptyState, Panel, ScoreBar, StatusPill } from "@/components/careeros/ui-bits";
import { useCareerOs } from "@/lib/careeros/store";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Job Market Intelligence — CareerOS" },
      {
        name: "description",
        content: "Patterns across the roles you have scanned: demand signals and recurring gaps.",
      },
      { property: "og:title", content: "Job Market Intelligence — CareerOS" },
      {
        property: "og:description",
        content: "What the roles you scan keep asking for, and where your record is thin.",
      },
    ],
  }),
  component: MarketPage,
});

function MarketPage() {
  const { data } = useCareerOs();
  const scans = data.scans;

  const keywordCounts = new Map<string, number>();
  scans.forEach((s) =>
    s.missingKeywords.forEach((k) => keywordCounts.set(k, (keywordCounts.get(k) ?? 0) + 1)),
  );
  const topGaps = [...keywordCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

  const avg = (key: string) =>
    scans.length
      ? Math.round(
          scans.reduce((sum, s) => sum + (s.subScores.find((x) => x.key === key)?.score ?? 0), 0) /
            scans.length,
        )
      : 0;

  return (
    <AppShell
      title="Job Market Intelligence"
      subtitle="Derived only from the jobs you have scanned in CareerOS"
    >
      <div className="space-y-4">
        {scans.length === 0 ? (
          <EmptyState title="No scans yet." hint="Run a job scan to start building patterns." />
        ) : (
          <>
            <Panel title="Average fit by dimension" description={`Across ${scans.length} scan(s)`}>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  "responsibilities",
                  "skills",
                  "experience",
                  "qualifications",
                  "sector",
                  "tools",
                  "evidence",
                  "ats",
                ].map((k) => (
                  <ScoreBar
                    key={k}
                    label={scans[0]?.subScores.find((s) => s.key === k)?.label ?? k}
                    value={avg(k)}
                  />
                ))}
              </div>
            </Panel>

            <Panel
              title="Recurring missing keywords"
              description="Where your record is thin across roles"
            >
              <div className="flex flex-wrap gap-1.5">
                {topGaps.map(([k, n]) => (
                  <StatusPill key={k} label={`${k} · ${n}`} tone="warning" />
                ))}
              </div>
            </Panel>

            <Panel title="Scan history">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {scans.map((s) => {
                  const job = data.jobs.find((j) => j.id === s.jobId);
                  return (
                    <li key={s.id}>
                      {job?.title ?? "Role"} at {job?.company ?? "—"} — {s.overall}% ({s.verdict})
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </>
        )}
      </div>
    </AppShell>
  );
}
