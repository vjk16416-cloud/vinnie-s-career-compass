import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/careeros/app-shell";
import { Panel, StatusPill } from "@/components/careeros/ui-bits";
import { useCareerOs } from "@/lib/careeros/store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Career Profile — CareerOS" },
      { name: "description", content: "Structured employment, education, certifications and skills record." },
      { property: "og:title", content: "Career Profile — CareerOS" },
      { property: "og:description", content: "The master career record behind every scan and document." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data } = useCareerOs();
  const p = data.profile;
  return (
    <AppShell title="Career Profile" subtitle={`${p.name} · ${p.location}`}>
      <div className="space-y-4">
        <Panel title="Summary">
          <p className="text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            CareerOS never updates this record silently. Changes require your explicit approval.
          </p>
        </Panel>

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
