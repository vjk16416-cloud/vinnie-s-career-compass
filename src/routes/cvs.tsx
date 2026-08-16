import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/careeros/app-shell";
import { ResumeReviewEditor } from "@/components/careeros/resume-review-editor";
import { EmptyState, Panel, StatusPill } from "@/components/careeros/ui-bits";
import { Button } from "@/components/ui/button";
import { uid, useCareerOs } from "@/lib/careeros/store";

export const Route = createFileRoute("/cvs")({
  head: () => ({
    meta: [
      { title: "CV Library — CareerOS" },
      { name: "description", content: "Versioned, evidence-traceable CVs by career category." },
      { property: "og:title", content: "CV Library — CareerOS" },
      { property: "og:description", content: "Every CV version, linked application and evidence trail." },
    ],
  }),
  component: CvsPage,
});

function CvsPage() {
  const { data, update, logActivity } = useCareerOs();
  const [reviewingCvId, setReviewingCvId] = useState<string | null>(null);

  async function saveReviewedVersion(cvId: string, body: string) {
    const cv = data.cvs.find((entry) => entry.id === cvId);
    if (!cv) return;

    update((draft) => {
      const target = draft.cvs.find((entry) => entry.id === cvId);
      if (!target) return draft;
      const previous = target.versions[target.versions.length - 1];
      target.versions.push({
        id: uid("cvv"),
        version: target.versions.length + 1,
        createdAt: new Date().toISOString(),
        note: "Reviewed and edited by user.",
        body,
        evidenceIds: previous?.evidenceIds ?? [],
      });
      target.status = "Draft";
      target.updatedAt = new Date().toISOString();
      return draft;
    });

    logActivity(`Reviewed CV version saved for ${cv.name}.`);
  }

  return (
    <AppShell title="CV Library" subtitle="Versioned drafts, always traceable to supported career evidence">
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
              "3–5 supported bullets per included role",
              "Concise 2-page target",
            ].map((rule) => (
              <li key={rule}>· {rule}</li>
            ))}
          </ul>
        </Panel>

        {data.cvs.length === 0 ? (
          <EmptyState title="No CVs yet." hint="Generate one from an application workspace." />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {data.cvs.map((cv) => {
                const latest = cv.versions[cv.versions.length - 1];
                const reviewing = reviewingCvId === cv.id;
                return (
                  <Panel key={cv.id} title={cv.name} description={`Category: ${cv.category}`}>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusPill
                        label={`Status: ${cv.status}`}
                        tone={cv.status === "Approved" ? "success" : "warning"}
                      />
                      <StatusPill label={`${cv.versions.length} version(s)`} />
                      {latest?.evidenceIds.length ? (
                        <StatusPill label={`${latest.evidenceIds.length} evidence refs`} tone="info" />
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Updated {new Date(cv.updatedAt).toLocaleString("en-GB")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {latest ? (
                        <Button
                          size="sm"
                          variant={reviewing ? "default" : "secondary"}
                          onClick={() => setReviewingCvId(reviewing ? null : cv.id)}
                        >
                          {reviewing ? "Close review" : "Review latest version"}
                        </Button>
                      ) : null}
                      {cv.applicationId ? (
                        <Button asChild size="sm" variant="secondary">
                          <Link to="/applications/$id" params={{ id: cv.applicationId }}>
                            Open workspace
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </Panel>
                );
              })}
            </div>

            {reviewingCvId ? (() => {
              const cv = data.cvs.find((entry) => entry.id === reviewingCvId);
              const latest = cv?.versions[cv.versions.length - 1];
              if (!cv || !latest) return null;
              return (
                <Panel
                  title={`Review: ${cv.name}`}
                  description="Save resume wording as a new version. CareerOS asks separately before learning any new factual career information."
                >
                  <ResumeReviewEditor
                    key={latest.id}
                    originalBody={latest.body}
                    onSaveVersion={(body) => saveReviewedVersion(cv.id, body)}
                  />
                </Panel>
              );
            })() : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}
