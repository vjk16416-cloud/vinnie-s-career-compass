import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/careeros/app-shell";
import { EmptyState, Panel, StatusPill } from "@/components/careeros/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uid, useCareerOs } from "@/lib/careeros/store";
import { APPLICATION_STAGES, type Application, type ApplicationStage } from "@/lib/careeros/types";

export const Route = createFileRoute("/applications/")({
  head: () => ({
    meta: [
      { title: "Applications — CareerOS" },
      { name: "description", content: "Track every application through an eleven-stage pipeline." },
      { property: "og:title", content: "Applications — CareerOS" },
      { property: "og:description", content: "Pipeline, deadlines and next actions in one place." },
    ],
  }),
  component: ApplicationsPage,
});

type SortKey = "recent" | "score" | "deadline" | "company";

function ApplicationsPage() {
  const { data, update, logActivity } = useCareerOs();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<"All" | ApplicationStage>("All");
  const [sort, setSort] = useState<SortKey>("recent");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ company: "", title: "", location: "" });

  const rows = useMemo(() => {
    let list = data.applications.filter((a) => {
      const q = query.trim().toLowerCase();
      const matchQ =
        !q || `${a.company} ${a.title} ${a.location} ${a.notes}`.toLowerCase().includes(q);
      return matchQ && (stage === "All" || a.stage === stage);
    });
    list = [...list].sort((a, b) => {
      if (sort === "score") return (b.compatibilityScore ?? 0) - (a.compatibilityScore ?? 0);
      if (sort === "deadline") return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
      if (sort === "company") return a.company.localeCompare(b.company);
      return b.dateAdded.localeCompare(a.dateAdded);
    });
    return list;
  }, [data.applications, query, stage, sort]);

  function addApplication() {
    if (!draft.company.trim() || !draft.title.trim()) return;
    const id = uid("app");
    const jobId = uid("job");
    update((d) => {
      d.jobs = [
        {
          id: jobId,
          company: draft.company,
          title: draft.title,
          location: draft.location || "Unspecified",
          description: "",
          createdAt: new Date().toISOString(),
          sourceType: "paste",
        },
        ...d.jobs,
      ];
      d.applications = [
        {
          id,
          jobId,
          company: draft.company,
          title: draft.title,
          location: draft.location || "Unspecified",
          workingArrangement: "Unspecified",
          employmentType: "Unspecified",
          priority: "Medium",
          stage: "Interested",
          dateAdded: new Date().toISOString(),
          notes: "",
          history: [{ at: new Date().toISOString(), entry: "Application added manually." }],
        },
        ...d.applications,
      ];
      return d;
    });
    logActivity(`Application added: ${draft.title} at ${draft.company}.`);
    setDraft({ company: "", title: "", location: "" });
    setAdding(false);
  }

  function setStageFor(app: Application, next: ApplicationStage) {
    update((d) => {
      const target = d.applications.find((a) => a.id === app.id);
      if (target) {
        target.stage = next;
        target.history = [
          { at: new Date().toISOString(), entry: `Stage changed to ${next}.` },
          ...target.history,
        ];
      }
      return d;
    });
  }

  return (
    <AppShell
      title="Applications"
      subtitle={`${data.applications.length} tracked`}
      actions={
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? "Close" : "Add application"}
        </Button>
      }
    >
      <div className="space-y-4">
        {adding ? (
          <Panel title="New application">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="a-company">Company</Label>
                <Input
                  id="a-company"
                  className="mt-1.5"
                  value={draft.company}
                  onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="a-title">Job title</Label>
                <Input
                  id="a-title"
                  className="mt-1.5"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="a-loc">Location</Label>
                <Input
                  id="a-loc"
                  className="mt-1.5"
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                />
              </div>
            </div>
            <Button className="mt-3" size="sm" onClick={addApplication}>
              Save application
            </Button>
          </Panel>
        ) : null}

        <Panel>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div>
              <Label htmlFor="search" className="sr-only">
                Search applications
              </Label>
              <Input
                id="search"
                placeholder="Search company, role or notes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={stage} onValueChange={(v) => setStage(v as typeof stage)}>
              <SelectTrigger className="sm:w-44" aria-label="Filter by stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All stages</SelectItem>
                {APPLICATION_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="sm:w-44" aria-label="Sort applications">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="score">Compatibility</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
                <SelectItem value="company">Company</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Panel>

        {rows.length === 0 ? (
          <EmptyState
            title="No applications match."
            hint="Try clearing filters or run a job scan."
          />
        ) : (
          <>
            {/* Desktop dense rows */}
            <div className="hidden overflow-hidden rounded-lg border border-border md:block">
              <table className="w-full text-sm">
                <thead className="bg-surface-2/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Role
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Stage
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Priority
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Fit
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Deadline
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Next action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-t border-border hover:bg-surface-2/40">
                      <td className="px-3 py-2">
                        <Link
                          to="/applications/$id"
                          params={{ id: a.id }}
                          className="font-medium hover:underline"
                        >
                          {a.title}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {a.company} · {a.location}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={a.stage}
                          onValueChange={(v) => setStageFor(a, v as ApplicationStage)}
                        >
                          <SelectTrigger
                            className="h-8 w-40 text-xs"
                            aria-label={`Stage for ${a.title}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {APPLICATION_STAGES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{a.priority}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {typeof a.compatibilityScore === "number"
                          ? `${a.compatibilityScore}%`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{a.deadline ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{a.nextAction ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="space-y-3 md:hidden">
              {rows.map((a) => (
                <li key={a.id}>
                  <Link
                    to="/applications/$id"
                    params={{ id: a.id }}
                    className="block rounded-lg border border-border bg-card p-4"
                  >
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.company} · {a.location}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusPill label={a.stage} tone="info" />
                      <StatusPill label={`Priority: ${a.priority}`} />
                      {typeof a.compatibilityScore === "number" ? (
                        <StatusPill label={`${a.compatibilityScore}% fit`} tone="success" />
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  );
}
