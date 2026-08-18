import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/careeros/app-shell";
import { CvHealthCheckPanel } from "@/components/careeros/cv-health-check-panel";
import { EmptyState, Panel, StatusPill, evidenceTone } from "@/components/careeros/ui-bits";
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
import { ScanResultView } from "./job-scan";

export const Route = createFileRoute("/applications/$id")({
  head: () => ({
    meta: [
      { title: "Application workspace | CareerOS" },
      {
        name: "description",
        content:
          "Job description, match analysis, evidence map, CV and cover letter in one workspace.",
      },
      { property: "og:title", content: "Application workspace | CareerOS" },
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
  const app = data.applications.find((candidate) => candidate.id === id);
  const job = data.jobs.find((candidate) => candidate.id === app?.jobId);
  const scan = data.scans.find((candidate) => candidate.jobId === app?.jobId);
  const cv = data.cvs.find((candidate) => candidate.applicationId === id);
  const letter = data.coverLetters.find((candidate) => candidate.applicationId === id);
  const [jdDraft, setJdDraft] = useState(job?.description ?? "");
  const [healthOpen, setHealthOpen] = useState(false);

  const verified = useMemo(
    () => data.evidence.filter((record) => record.status === "Verified"),
    [data.evidence],
  );
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
    update((draft) => {
      const target = draft.jobs.find((candidate) => candidate.id === app.jobId);
      if (target) target.description = jdDraft;
      return draft;
    });
    toast.success("Job description saved.");
  }

  function rerunScan() {
    if (!job) return;
    if (jdDraft.trim().split(/\s+/).length < 40) {
      toast.error("Add the job description first.");
      return;
    }

    const jobRecord = { ...job, description: jdDraft };
    const result = runScan(jobRecord, data);
    update((draft) => {
      const targetJob = draft.jobs.find((candidate) => candidate.id === job.id);
      if (targetJob) targetJob.description = jdDraft;
      draft.scans = [result, ...draft.scans.filter((candidate) => candidate.jobId !== job.id)];
      const targetApplication = draft.applications.find((candidate) => candidate.id === app.id);
      if (targetApplication) {
        targetApplication.compatibilityScore = result.overall;
        targetApplication.history = [
          {
            at: new Date().toISOString(),
            entry: `Role scan run: ${result.overall}% fit.`,
          },
          ...targetApplication.history,
        ];
      }
      return draft;
    });
    logActivity(`Re-scanned ${app.title} at ${app.company}: ${result.overall}% fit.`);
  }

  function generateCv() {
    if (!job) return;
    const built = buildTailoredCv(data, { ...job, description: jdDraft || job.description }, scan);

    update((draft) => {
      const existing = draft.cvs.find((candidate) => candidate.applicationId === app.id);
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
        draft.cvs = [
          {
            id: cvId,
            name: `${app.title} | ${app.company}`,
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
          ...draft.cvs,
        ];
        const targetApplication = draft.applications.find((candidate) => candidate.id === app.id);
        if (targetApplication) targetApplication.linkedCvId = cvId;
      }
      return draft;
    });

    logActivity(`Tailored CV draft created for ${app.title} at ${app.company}.`);
    toast.success("Draft CV created. It stays a draft until you approve it.");
  }

  function approveCv() {
    if (!cv) return;
    update((draft) => {
      const target = draft.cvs.find((candidate) => candidate.id === cv.id);
      if (target) target.status = "Approved";
      return draft;
    });
    toast.success("CV version approved.");
  }

  function generateLetter() {
    if (!job) return;
    const built = buildCoverLetter(data, { ...job, description: jdDraft || job.description }, scan);
    update((draft) => {
      draft.coverLetters = [
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
        ...draft.coverLetters.filter((candidate) => candidate.applicationId !== app.id),
      ];
      return draft;
    });
    logActivity(`Cover letter draft created for ${app.title}.`);
    toast.success("Cover letter draft created from verified evidence.");
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
              onChange={(event) => setJdDraft(event.target.value)}
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
              {data.evidence.map((record) => (
                <li key={record.id} className="rounded-md border border-border bg-surface-2/40 p-3">
                  <p className="text-sm">{record.claim}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusPill
                      label={`Status: ${record.status}`}
                      tone={evidenceTone(record.status)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {record.employer} · confidence {record.confidence} · ref {record.id}
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
            description="Times New Roman, 10-12 pt, black, left aligned, no graphics."
            actions={
              <>
                <Button size="sm" onClick={generateCv}>
                  {cv ? "New draft" : "Create tailored CV"}
                </Button>
                {cv ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setHealthOpen((value) => !value)}
                  >
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
                      .map((version) => (
                        <li key={version.id}>
                          v{version.version} · {new Date(version.createdAt).toLocaleString("en-GB")}{" "}
                          · {version.note}
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
            <CvHealthCheckPanel health={health} onRegenerate={generateCv} />
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
              <EmptyState
                title="No cover letter yet."
                hint="Generate one from verified evidence."
              />
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
                  onBlur={(event) =>
                    update((draft) => {
                      const target = draft.applications.find(
                        (candidate) => candidate.id === app.id,
                      );
                      if (target) target.nextAction = event.target.value;
                      return draft;
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
                  onBlur={(event) =>
                    update((draft) => {
                      const target = draft.applications.find(
                        (candidate) => candidate.id === app.id,
                      );
                      if (target) target.deadline = event.target.value;
                      return draft;
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
                  onBlur={(event) =>
                    update((draft) => {
                      const target = draft.applications.find(
                        (candidate) => candidate.id === app.id,
                      );
                      if (target) target.notes = event.target.value;
                      return draft;
                    })
                  }
                />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-muted-foreground">History</h3>
              <ol className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {app.history.map((entry) => (
                  <li key={`${entry.at}-${entry.entry}`}>
                    {new Date(entry.at).toLocaleString("en-GB")} · {entry.entry}
                  </li>
                ))}
              </ol>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="prep" className="mt-4">
          <Panel
            title="Interview prep"
            description="Prompts built from your verified evidence only."
          >
            <ul className="space-y-2 text-sm">
              {verified.slice(0, 6).map((record) => (
                <li key={record.id} className="rounded-md border border-border p-3">
                  <p className="font-medium">
                    Tell me about a time you worked on{" "}
                    {record.skills[0]?.toLowerCase() ?? "this area"}.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Anchor: {record.claim} ({record.employer}). Source: {record.source}.
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
