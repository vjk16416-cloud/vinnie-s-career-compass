import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/careeros/app-shell";
import { EmptyState, Panel, StatusPill } from "@/components/careeros/ui-bits";
import { Button } from "@/components/ui/button";
import { useCareerOs } from "@/lib/careeros/store";

export const Route = createFileRoute("/cvs")({
  head: () => ({
    meta: [
      { title: "CV Library — CareerOS" },
      { name: "description", content: "Versioned, evidence-traceable CVs by career category." },
      { property: "og:title", content: "CV Library — CareerOS" },
      {
        property: "og:description",
        content: "Every CV version, linked application and evidence trail.",
      },
    ],
  }),
  component: CvsPage,
});

function CvsPage() {
  const { data } = useCareerOs();
  return (
    <AppShell title="CV Library" subtitle="Versioned drafts, always traceable to verified evidence">
      <div className="space-y-4">
        <Panel title="Format rules applied to every generated CV">
          <ul className="grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              "British English",
              "Times New Roman",
              "10–12 pt body text",
              "Full black text",
              "Left aligned",
              "No graphics, icons, tables or columns",
              "ATS-friendly structure",
              "Concise 2-page target",
            ].map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        </Panel>

        {data.cvs.length === 0 ? (
          <EmptyState title="No CVs yet." hint="Generate one from an application workspace." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.cvs.map((cv) => {
              const latest = cv.versions[cv.versions.length - 1];
              return (
                <Panel key={cv.id} title={cv.name} description={`Category: ${cv.category}`}>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusPill
                      label={`Status: ${cv.status}`}
                      tone={cv.status === "Approved" ? "success" : "warning"}
                    />
                    <StatusPill label={`${cv.versions.length} version(s)`} />
                    {latest?.evidenceIds.length ? (
                      <StatusPill
                        label={`${latest.evidenceIds.length} evidence refs`}
                        tone="info"
                      />
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Updated {new Date(cv.updatedAt).toLocaleString("en-GB")}
                  </p>
                  {cv.applicationId ? (
                    <Button asChild size="sm" variant="secondary" className="mt-3">
                      <Link to="/applications/$id" params={{ id: cv.applicationId }}>
                        Open workspace
                      </Link>
                    </Button>
                  ) : null}
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
