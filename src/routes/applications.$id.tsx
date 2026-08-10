import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/careeros/app-shell";
import { ScanResultView } from "./job-scan";
import {
  EmptyState,
  Panel,
  ScoreBar,
  StatusPill,
  evidenceTone,
} from "@/components/careeros/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildCoverLetter,
  buildTailoredCv,
  runCvHealthCheck,
  suggestCvCategory,
} from "@/lib/careeros/generate";
import { runScan } from "@/lib/careeros/scoring";
import { uid, useCareerOs } from "@/lib/careeros/store";

export const Route = createFileRoute("/applications/$id")({
  head: () => ({
    meta: [
      { title: "Application workspace — CareerOS" },
      {
        name: "description",
        content: "Job description, match analysis, evidence map, CV and cover letter in one workspace.",
      },
      { property: "og:title", content: "Application workspace — CareerOS" },
      {
        property: "og:description",
        content: "Draft, review and version every document for a single application.",
      },
    ],
  }),
  component: ApplicationWorkspace,
});

function ApplicationWorkspace() {
  const { id } = Route.useParams();
  const { data, update, logActivity } = useCareerOs();
  const app = data.applications.find((a) => a.id === id);
  const job = data.jobs.find((j) => j.id === app?.jobId);
  const scan = data.scans.find((s) => s.jobId === app?.jobId);
  const cv = data.cvs.find((c) => c.applicationId === id);
  const letter = data.coverLetters.find((c) => c.applicationId === id);
  const [jdDraft, setJdDraft] = useState(job?.description ?? "");
  const [healthOpen, setHealthOpen] = useState(false);

  const verified = useMemo(() => data.evidence.filter((e) => e.status === "Verified"), [data.evidence]);
  const latestCvBody = cv?.versions[cv.versions.length - 1]?.body ?? "";
  const health = useMemo(
    () => (latestCvBody ? runCvHealthCheck(latestCvBody, data, job, scan) : null),
    [latestCvBody, data, job, scan],
  );

  if (!app) {
    return (
      <AppShell title="Application not found">
        <EmptyState title="That application no longer exists." hint="Return to the pipeline." />
        <div className="mt-3">
          <Button asChild size="sm">
            <Link to="/applications">Back to applications</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  function saveJd() {
    if (!app) return;
    update((d) => {
      const j = d.jobs.find((x) => x.id === app.jobId);
      if (j) j.description = jdDraft;
      return d;
    });
    toast.success("Job description saved.");
  }

  function rerunScan() {
    if (!job || !app) return;
    if (jdDraft.trim().split(/\s+/).length < 40) {
      toast.error("Add the job description first.");
      return;
    }
    const jobRecord = { ...job, description: jdDraft };
    const result = runScan(jobRecord, data);
    update((d) => {
      const j = d.jobs.find((x) => x.id === job.id);
      if (j) j.description = jdDraft;
      d.scans = [result, ...d.scans.filter((s) => s.jobId !== job.id)];
      const target = d.applications.find((a) => a.id === app.id);
      if (target) {
        target.compatibilityScore = result.overall;
        target.history = [
          { at: new Date().toISOString(), entry: `Role scan run — ${result.overall}% fit.` },
          ...target.history,
        ];
      }
      return d;
    });
    logActivity(`Re-scanned ${app.title} at ${app.company} — ${result.overall}%.`);
  }

  function generateCv() {
    if (!job || !app) return;
    const built = buildTailoredCv(data, { ...job, description: jdDraft || job.description }, scan);
    update((d) => {
      const existing = d.cvs.find((c) => c.applicationId === app.id);
      if (existing) {
        existing.versions.push({
          id: uid("cvv"),
          version: existing.versions.length + 1,
          createdAt: new Date().toISOString(),
          note: "Regenerated draft from verified evidence.",
          body: built.body,
          evidenceIds: built.evidenceIds,
        });
        existing.status = "Draft";
        existing.updatedAt = new Date().toISOString();
      } else {
        const cvId = uid("cv");
        d.cvs = [
          {
            id: cvId,
            name: `${app.title} — ${app.company}`,
            category: suggestCvCategory(job),
            status: "Draft",
            applicationId: app.id,
            jobId: job.id,
            updatedAt: new Date().toISOString(),
            versions: [
              {
                id: uid("cvv"),
                version: 1,
                createdAt: new Date().toISOString(),
                note: "Initial tailored draft from verified evidence.",
                body: built.body,
                evidenceIds: built.evidenceIds,
              },
            ],
          },
          ...d.cvs,
        ];
        const target = d.applications.find((a) => a.id === app.id);
        if (target) target.linkedCvId = cvId;
      }
      return d;
    });
    logActivity(`Tailored CV draft created for ${app.title} at ${app.company}.`);
    toast.success("Draft CV created. It stays a draft until you approve it.");
  }

  function approveCv() {
    if (!cv) return;
    update((d) => {
      const target = d.cvs.find((c) => c.id === cv.id);
      if (target) target.status = "Approved";
      return d;
    });
    toast.success("CV version approved.");
  }

  function generateLetter() {
    if (!job || !app) return;
    const built = buildCoverLetter(data, { ...job, description: jdDraft || job.description }, scan);
    update((d) => {
      d.coverLetters = [
        {
          id: uid("cl"),
          applicationId: app.id,
          jobId: job.id,
          status: "Draft",
          body: built.body,
          emailVersion: built.emailVersion,
          evidenceIds: built.evidenceIds,
          createdAt: new Date().toISOString(),
        },
        ...d.coverLetters.filter((c) => c.applicationId !== app.id),
      ];
      return d;
    });
    logActivity(`Cover letter draft created for ${app.title}.`);
    toast.success("Cover letter draft created from verified evidence.");
  }

  function applySuggestions() {
    if (!cv || !health) return;
    const notes = health.suggestions.map((s) => `- ${s.text}`).join("\n");
    const body = `${latestCvBody}\n\n<!-- Review notes accepted ${new Date().toLocaleDateString("en-GB")} -->\n${notes}`;
    update((d) => {
      const target = d.cvs.find((c) => c.id === cv.id);
      if (target) {
        target.versions.push({
          id: uid("cvv"),
          version: target.versions.length + 1,
          createdAt: new Date().toISOString(),
          note: "New version created after approving health-check suggestions.",
          body,
          evidenceIds: target.versions[target.versions.length - 1]?.evidenceIds ?? [],
        });
        target.status = "Draft";
        target.updatedAt = new Date().toISOString();
      }
      return d;
    });
    toast.success("New CV version saved. Previous versions are kept.");
  }

  return (
    <AppShell
      title={app.title}
      subtitle={`${app.company} · ${app.location} · ${app.stage}`}
      actions={
        <Button asChild size="sm" variant="secondary">
          <Link to="/applications">All applications</Link>
        </Button>
      }
    >
      <Tabs defaultValue="jd" className="w-full">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="jd">Job Description</TabsTrigger>
            <TabsTrigger value="match">Match Analysis</TabsTrigger>
            <TabsTrigger value="evidence">Evidence Map</TabsTrigger>
            <TabsTrigger value="cv">Tailored CV</TabsTrigger>
            <TabsTrigger value="letter">Cover Letter</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="prep">Interview Prep</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="jd" className="mt-4">
          <Panel title="Job description" description="Paste or edit, then re-run the scan.">
            <Textarea
              className="min-h-64 font-mono text-xs"
              value={jdDraft}
              onChange={(e) => setJdDraft(e.target.value)}
              aria-label="Job description"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={saveJd}>
                Save description
              </Button>
              <Button size="sm" onClick={rerunScan}>
                Run scan
              </Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="match" className="mt-4">
          {scan ? (
            <ScanResultView scan={scan} />
          ) : (
            <EmptyState
              title="No scan yet for this application."
              hint="Add the job description and run a scan."
            />
          )}
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          <Panel
            title="Evidence map"
            description="Only Verified records may be asserted in generated documents."
          >
            <ul className="space-y-2">
              {data.evidence.map((e) => (
                <li key={e.id} className="rounded-md border border-border bg-surface-2/40 p-3">
                  <p className="text-sm">{e.claim}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusPill label={`Status: ${e.status}`} tone={evidenceTone(e.status)} />
                    <span className="text-xs text-muted-foreground">
                      {e.employer} · confidence {e.confidence} · ref {e.id}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </TabsContent>

        <TabsContent value="cv" className="mt-4 space-y-4">
          <Panel
            title="Tailored CV"
            description="Times New Roman, 10–12 pt, black, left aligned, no graphics."
            actions={
              <>
                <Button size="sm" onClick={generateCv}>
                  {cv ? "New draft" : "Create tailored CV"}
                </Button>
                {cv ? (
                  <Button size="sm" variant="secondary" onClick={() => setHealthOpen((v) => !v)}>
                    CV health check
                  </Button>
                ) : null}
              </>
            }
          >
            {cv ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={`Status: ${cv.status}`}
                    tone={cv.status === "Approved" ? "success" : "warning"}
                  />
                  <StatusPill label={`Category: ${cv.category}`} />
                  <StatusPill label={`Version ${cv.versions.length}`} />
                  <Button size="sm" variant="ghost" onClick={approveCv}>
                    Approve this version
                  </Button>
                </div>
                <div className="cv-sheet max-h-[28rem] overflow-auto rounded-md p-5">
                  <pre className="whitespace-pre-wrap font-serif">{latestCvBody}</pre>
                </div>
                <div className="mt-3">
                  <h3 className="text-xs font-semibold text-muted-foreground">Version history</h3>
                  <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                    {cv.versions
                      .slice()
                      .reverse()
                      .map((v) => (
                        <li key={v.id}>
                          v{v.version} — {new Date(v.createdAt).toLocaleString("en-GB")} — {v.note}
                        </li>
                      ))}
                  </ul>
                </div>
              </>
            ) : (
              <EmptyState
                title="No CV drafted yet."
                hint="Generate one from verified evidence for this role."
              />
            )}
          </Panel>

          {cv && healthOpen && health ? (
            <Panel title="CV scan / health check" description="Review before export.">
              <div className="grid gap-4 md:grid-cols-2">
                <ScoreBar label="Role compatibility" value={health.compatibility} />
                <ScoreBar label="ATS / keyword coverage" value={health.atsCoverage} />
                <ScoreBar label="Responsibilities coverage" value={health.responsibilitiesCoverage} />
                <ScoreBar label="Evidence coverage" value={health.evidenceCoverage} />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">Missing keywords</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {health.missingKeywords.length ? (
                      health.missingKeywords.map((k) => <StatusPill key={k} label={k} tone="warning" />)
                    ) : (
                      <p className="text-sm text-muted-foreground">None.</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">Weak or vague bullets</h3>
                  <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                    {health.weakBullets.length ? (
                      health.weakBullets.map((b) => <li key={b}>{b.trim()}</li>)
                    ) : (
                      <li>None flagged.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    Unsupported or unverified claims
                  </h3>
                  <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                    {health.unsupportedClaims.length ? (
                      health.unsupportedClaims.map((c) => <li key={c}>{c}</li>)
                    ) : (
                      <li>None — every claim traces to Verified evidence.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">Formatting compliance</h3>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {health.formatting.map((f) => (
                      <li key={f.rule} className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 text-muted-foreground">{f.rule}</span>
                        <StatusPill
                          label={f.pass ? "Pass" : "Check"}
                          tone={f.pass ? "success" : "warning"}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-semibold text-muted-foreground">Suggested refinements</h3>
                <ul className="mt-1.5 space-y-1.5 text-sm">
                  {health.suggestions.map((s) => (
                    <li key={s.text} className="rounded-md border border-border p-2.5">
                      {s.text}
                      {s.evidenceId ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Evidence ref: {s.evidenceId}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <Button className="mt-3" size="sm" onClick={applySuggestions}>
                  Approve suggestions and save new version
                </Button>
              </div>
            </Panel>
          ) : null}
        </TabsContent>

        <TabsContent value="letter" className="mt-4">
          <Panel
            title="Cover letter"
            description="Plain English, evidence-led, honest about gaps."
            actions={
              <Button size="sm" onClick={generateLetter}>
                {letter ? "Regenerate draft" : "Create cover letter"}
              </Button>
            }
          >
            {letter ? (
              <div className="space-y-4">
                <StatusPill label={`Status: ${letter.status}`} tone="warning" />
                <pre className="whitespace-pre-wrap rounded-md border border-border bg-surface-2/40 p-4 text-sm">
                  {letter.body}
                </pre>
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    Concise application email
                  </h3>
                  <pre className="mt-1.5 whitespace-pre-wrap rounded-md border border-border bg-surface-2/40 p-4 text-sm">
                    {letter.emailVersion}
                  </pre>
                </div>
                <p className="text-xs text-muted-foreground">
                  Evidence used: {letter.evidenceIds.join(", ") || "none"}
                </p>
              </div>
            ) : (
              <EmptyState title="No cover letter yet." hint="Generate one from verified evidence." />
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Panel title="Notes and tracking">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="next-action">Next action</Label>
                <Input
                  id="next-action"
                  className="mt-1.5"
                  defaultValue={app.nextAction ?? ""}
                  onBlur={(e) =>
                    update((d) => {
                      const t = d.applications.find((a) => a.id === app.id);
                      if (t) t.nextAction = e.target.value;
                      return d;
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  className="mt-1.5"
                  defaultValue={app.deadline ?? ""}
                  onBlur={(e) =>
                    update((d) => {
                      const t = d.applications.find((a) => a.id === app.id);
                      if (t) t.deadline = e.target.value;
                      return d;
                    })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  className="mt-1.5 min-h-32"
                  defaultValue={app.notes}
                  onBlur={(e) =>
                    update((d) => {
                      const t = d.applications.find((a) => a.id === app.id);
                      if (t) t.notes = e.target.value;
                      return d;
                    })
                  }
                />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-muted-foreground">History</h3>
              <ol className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {app.history.map((h) => (
                  <li key={`${h.at}-${h.entry}`}>
                    {new Date(h.at).toLocaleString("en-GB")} — {h.entry}
                  </li>
                ))}
              </ol>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="prep" className="mt-4">
          <Panel title="Interview prep" description="Prompts built from your verified evidence only.">
            <ul className="space-y-2 text-sm">
              {verified.slice(0, 6).map((e) => (
                <li key={e.id} className="rounded-md border border-border p-3">
                  <p className="font-medium">
                    Tell me about a time you worked on {e.skills[0]?.toLowerCase() ?? "this area"}.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Anchor: {e.claim} ({e.employer}). Source: {e.source}.
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
