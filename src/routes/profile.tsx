import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/careeros/app-shell";
import { Panel, StatusPill } from "@/components/careeros/ui-bits";
import { useCareerOs } from "@/lib/careeros/store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Career Profile — CareerOS" },
      {
        name: "description",
        content: "Structured employment, education, certifications and skills record.",
      },
      { property: "og:title", content: "Career Profile — CareerOS" },
      {
        property: "og:description",
        content: "The master career record behind every scan and document.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data } = useCareerOs();
  const p = data.profile;
  const sources = data.profileSources ?? [];
  const profileItems = data.profileItems ?? [];
  const importedSources = sources.filter((source) => source.ingestionStatus === "Imported").length;
  const indexedSources = sources.filter((source) => source.ingestionStatus === "Indexed").length;
  const excludedSources = sources.filter((source) => source.ingestionStatus === "Excluded").length;
  const approvedItems = profileItems.filter((item) => item.status === "Approved").length;
  const attentionItems = profileItems.filter(
    (item) =>
      item.status === "Conflict" || item.status === "Needs Evidence" || item.status === "Excluded",
  );

  return (
    <AppShell title="Career Profile" subtitle={`${p.name} · ${p.location}`}>
      <div className="space-y-4">
        <Panel title="Summary">
          <p className="text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            CareerOS never updates this record silently. Changes require your explicit approval.
          </p>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Master profile coverage">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Sources registered</p>
                <p className="mt-1 text-xl font-semibold">{sources.length}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Imported</p>
                <p className="mt-1 text-xl font-semibold">{importedSources}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Indexed for import</p>
                <p className="mt-1 text-xl font-semibold">{indexedSources}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Excluded sources</p>
                <p className="mt-1 text-xl font-semibold">{excludedSources}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Indexed means the document is catalogued from the evidence audit, not that every line
              has already been imported. Full resume extraction is the next phase.
            </p>
          </Panel>

          <Panel title="Approval layer">
            <div className="flex flex-wrap gap-1.5">
              <StatusPill label={`${approvedItems} approved items`} />
              <StatusPill label={`${attentionItems.length} need attention`} />
            </div>
            {attentionItems.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {attentionItems.map((item) => (
                  <li key={item.id} className="rounded-md border border-border p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <StatusPill label={item.status} />
                    </div>
                    <p className="mt-1 text-xs leading-relaxed">{item.notes ?? item.value}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No unresolved profile items.</p>
            )}
          </Panel>
        </div>

        <Panel title="Employment">
          <ol className="space-y-4">
            {p.employment.map((r) => (
              <li key={r.id} className="border-l-2 border-border pl-3">
                <p className="text-sm font-semibold">
                  {r.title} — {r.company}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.employmentType} · {r.start} – {r.end} · {r.location}
                </p>
                <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                  {r.highlights.map((h) => (
                    <li key={h}>· {h}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Education">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {p.education.map((e) => (
                <li key={e.id}>
                  {e.qualification}, {e.institution} — {e.detail}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Certifications">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {p.certifications.map((c) => (
                <li key={c.id}>
                  {c.name}, {c.issuer} ({c.completed})
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Projects">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {p.projects.map((pr) => (
                <li key={pr.id}>
                  <span className="text-foreground">{pr.name}</span> — {pr.summary}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Skills, tools and domains">
            <div className="flex flex-wrap gap-1.5">
              {[...p.skills, ...p.tools, ...p.domains].map((s) => (
                <StatusPill key={s} label={s} />
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Version history">
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {data.profileVersions.map((v) => (
              <li key={v.id}>
                {v.label} — {new Date(v.createdAt).toLocaleString("en-GB")} — {v.note}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
