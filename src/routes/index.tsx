import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/careeros/app-shell";
import { EmptyState, Panel, StatusPill, evidenceTone } from "@/components/careeros/ui-bits";
import { Button } from "@/components/ui/button";
import {
  computeHomeAttention,
  summariseAttention,
  todayIso,
  type AttentionItem,
} from "@/lib/careeros/home-attention";
import { useCareerOs } from "@/lib/careeros/store";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareerOS — Vinnie's career operating system" },
      {
        name: "description",
        content:
          "Private workspace for job scanning, evidence-backed CV tailoring and application tracking.",
      },
      { property: "og:title", content: "CareerOS — Vinnie's career operating system" },
      {
        property: "og:description",
        content: "Evidence-led job compatibility scoring, CV tailoring and application pipeline.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data } = useCareerOs();
  const active = data.applications.filter(
    (a) => !["Rejected", "Withdrawn", "Accepted"].includes(a.stage),
  );
  const deadlines = data.applications
    .filter((a) => a.deadline)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))
    .slice(0, 4);
  const needsEvidence = data.evidence.filter((e) => e.status === "Needs Evidence");
  const recentCvs = [...data.cvs]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);
  const attention = useMemo(() => computeHomeAttention(data, todayIso()), [data]);
  const attentionSummary = summariseAttention(attention);

  return (
    <AppShell
      title="Home"
      subtitle="Today's focus, live applications and anything waiting on you"
      actions={
        <Button asChild size="sm">
          <Link to="/job-scan">Scan a job</Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <AttentionPanel items={attention} summary={attentionSummary} />


        <Panel title="Today's focus" description="Next actions pulled from your live applications">
          {active.length === 0 ? (
            <EmptyState title="Nothing active yet." hint="Start with a job scan." />
          ) : (
            <ul className="space-y-2">
              {active.slice(0, 4).map((a) => (
                <li
                  key={a.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-surface-2/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {a.nextAction ?? "Set a next action"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.title} · {a.company}
                      {a.nextActionDue ? ` · due ${a.nextActionDue}` : ""}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/applications/$id" params={{ id: a.id }}>
                      Open
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Active applications" description={`${active.length} in flight`}>
            {active.length === 0 ? (
              <EmptyState title="No active applications." />
            ) : (
              <ul className="space-y-2">
                {active.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/applications/$id"
                      params={{ id: a.id }}
                      className="min-w-0 flex-1 truncate text-sm hover:underline"
                    >
                      {a.title} — {a.company}
                    </Link>
                    <StatusPill label={a.stage} tone="info" />
                    {typeof a.compatibilityScore === "number" ? (
                      <StatusPill label={`${a.compatibilityScore}% fit`} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Upcoming deadlines">
            {deadlines.length === 0 ? (
              <EmptyState title="No deadlines recorded." />
            ) : (
              <ul className="space-y-2 text-sm">
                {deadlines.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{a.company}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{a.deadline}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent CVs">
            {recentCvs.length === 0 ? (
              <EmptyState title="No CVs yet." />
            ) : (
              <ul className="space-y-2 text-sm">
                {recentCvs.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2">
                    <Link to="/cvs" className="min-w-0 flex-1 truncate hover:underline">
                      {c.name}
                    </Link>
                    <StatusPill
                      label={c.status}
                      tone={c.status === "Approved" ? "success" : "neutral"}
                    />
                    <span className="text-xs text-muted-foreground">v{c.versions.length}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Evidence needing verification"
            description="These records cannot appear in generated documents"
          >
            {needsEvidence.length === 0 ? (
              <EmptyState title="Everything is verified." />
            ) : (
              <ul className="space-y-2">
                {needsEvidence.map((e) => (
                  <li key={e.id} className="space-y-1">
                    <p className="text-sm">{e.claim}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill label={`Status: ${e.status}`} tone={evidenceTone(e.status)} />
                      <span className="text-xs text-muted-foreground">{e.employer}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Button asChild size="sm" variant="secondary">
                <Link to="/evidence">Open review queue</Link>
              </Button>
            </div>
          </Panel>
        </div>

        <Panel title="Quick actions">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/job-scan">Scan a job</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/applications">Add application</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/cvs">Tailor CV</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/applications">Create cover letter</Link>
            </Button>
          </div>
        </Panel>

        <Panel title="Recent activity">
          <ol className="space-y-2 text-sm">
            {data.activity.slice(0, 8).map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                <span className="text-foreground">{a.text}</span>
                <time className="text-xs">{new Date(a.at).toLocaleString("en-GB")}</time>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </AppShell>
  );
}
