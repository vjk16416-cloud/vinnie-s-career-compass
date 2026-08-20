import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/careeros/app-shell";
import { CvHealthCheckPanel } from "@/components/careeros/cv-health-check-panel";
import { EmptyState, Panel, StatusPill } from "@/components/careeros/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  coverLetterExportFileName,
  cvExportFileName,
  downloadWordCompatibleCv,
  printCv,
} from "@/lib/careeros/cv-export";
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
  const [jdDraft, setJdDraft] = useState(job?.description ?? "");
  const [healthOpen, setHealthOpen] = useState(false);
  const [selectedCvVersionId, setSelectedCvVersionId] = useState<string | undefined>(undefined);
  const [selectedCoverLetterId, setSelectedCoverLetterId] = useState<string | undefined>(undefined);

  const verified = useMemo(
    () => data.evidence.filter((record) => record.status === "Verified"),
    [data.evidence],
  );
  const latestCvVersion = cv?.versions[cv.versions.length - 1];
  const selectedCvVersion =
    cv?.versions.find((version) => version.id === selectedCvVersionId) ?? latestCvVersion;
  const latestCvBody = latestCvVersion?.body ?? "";
  const selectedCvBody = selectedCvVersion?.body ?? "";
  const comparingOlderCvVersion = Boolean(
    selectedCvVersion && latestCvVersion && selectedCvVersion.id !== latestCvVersion.id,
  );
  const coverLetterVersions = useMemo(
    () =>
      data.coverLetters
        .filter((candidate) => candidate.applicationId === id)
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [data.coverLetters, id],
  );
  const latestLetter = coverLetterVersions[coverLetterVersions.length - 1];
  const selectedLetter =
    coverLetterVersions.find((candidate) => candidate.id === selectedCoverLetterId) ?? latestLetter;
  const selectedLetterVersion = selectedLetter
    ? coverLetterVersions.findIndex((candidate) => candidate.id === selectedLetter.id) + 1
    : 0;
  const latestLetterVersion = coverLetterVersions.length;
  const comparingOlderLetter = Boolean(
    selectedLetter && latestLetter && selectedLetter.id !== latestLetter.id,
  );
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

    setSelectedCvVersionId(undefined);
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
    toast.success("Latest CV version approved.");
  }

  function downloadSelectedCv() {
    if (!selectedCvVersion) return;
    const title = `${app.title} at ${app.company} | CV version ${selectedCvVersion.version}`;
    downloadWordCompatibleCv(
      selectedCvVersion.body,
      title,
      cvExportFileName(app.title, app.company, selectedCvVersion.version),
    );
    toast.success(`CV version ${selectedCvVersion.version} downloaded as a Word-compatible .doc.`);
  }

  function printSelectedCv() {
    if (!selectedCvVersion) return;
    const title = `${app.title} at ${app.company} | CV version ${selectedCvVersion.version}`;
    if (!printCv(selectedCvVersion.body, title)) {
      toast.error("Your browser blocked the print window. Allow pop-ups and try again.");
    }
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
        ...draft.coverLetters,
      ];
      return draft;
    });
    setSelectedCoverLetterId(undefined);
    logActivity(`Cover letter draft created for ${app.title}.`);
    toast.success("Cover letter draft created from verified evidence.");
  }

  function approveLatestLetter() {
    if (!latestLetter) return;
    update((draft) => {
      const target = draft.coverLetters.find((candidate) => candidate.id === latestLetter.id);
      if (target) target.status = "Approved";
      return draft;
    });
    toast.success("Latest cover letter approved.");
  }

  function downloadSelectedLetter() {
    if (!selectedLetter) return;
    const title = `${app.title} at ${app.company} | Cover letter version ${selectedLetterVersion}`;
    downloadWordCompatibleCv(
      selectedLetter.body,
      title,
      coverLetterExportFileName(app.title, app.company, selectedLetterVersion),
    );
    toast.success(`Cover letter version ${selectedLetterVersion} downloaded as a Word-compatible .doc.`);
  }

  function printSelectedLetter() {
    if (!selectedLetter) return;
    const title = `${app.title} at ${app.company} | Cover letter version ${selectedLetterVersion}`;
    if (!printCv(selectedLetter.body, title)) {
      toast.error("Your browser blocked the print window. Allow pop-ups and try again.");
    }
  }

  async function copySelectedEmail() {
    if (!selectedLetter) return;
    try {
      await navigator.clipboard.writeText(selectedLetter.emailVersion);
      toast.success("Application email copied.");
    } catch {
      toast.error("Could not copy the application email. Select the text and copy it manually.");
    }
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
      <Tabs defaultValue="job" className="w-full">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="job">Job</TabsTrigger>
            <TabsTrigger value="match">Match</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="cv">CV</TabsTrigger>
            <TabsTrigger value="letter">Cover Letter</TabsTrigger>
            <TabsTrigger value="apply">Apply</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="job" className="mt-4">
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
            title="Role evidence map"
            description="Every requirement shown here comes from this job scan. Blocked or missing evidence does not become a CV claim."
          >
            {scan?.evidenceMap?.length ? (
              <ul className="space-y-2">
                {scan.evidenceMap.map((item) => (
                  <li key={item.id} className="rounded-md border border-border bg-surface-2/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
                        {item.requirement}
                      </p>
                      <StatusPill label={item.status} />
                      <StatusPill label={item.priority} />
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {item.explanation}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Category: {item.category}</span>
                      <span>Evidence: {item.evidenceIds.join(", ") || "none"}</span>
                      <span>Sources: {item.sourceIds.join(", ") || "none"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No role-specific evidence map yet."
                hint="Run the role scan first so CareerOS can map this job to your approved evidence."
              />
            )}
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
            {cv && selectedCvVersion && latestCvVersion ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={`Status: ${cv.status}`}
                    tone={cv.status === "Approved" ? "success" : "warning"}
                  />
                  <StatusPill label={`Category: ${cv.category}`} />
                  <StatusPill label={`Preview: v${selectedCvVersion.version}`} />
                  {comparingOlderCvVersion ? (
                    <StatusPill label={`Latest: v${latestCvVersion.version}`} tone="warning" />
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={approveCv}
                    disabled={comparingOlderCvVersion}
                  >
                    Approve latest version
                  </Button>
                </div>

                <div className="mb-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <div>
                    <Label htmlFor="cv-preview-version">Preview version</Label>
                    <select
                      id="cv-preview-version"
                      className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={selectedCvVersion.id}
                      onChange={(event) => setSelectedCvVersionId(event.target.value)}
                    >
                      {cv.versions
                        .slice()
                        .reverse()
                        .map((version) => (
                          <option key={version.id} value={version.id}>
                            Version {version.version} · {version.note}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={downloadSelectedCv}>
                      Download Word-compatible .doc
                    </Button>
                    <Button size="sm" variant="secondary" onClick={printSelectedCv}>
                      Print / Save as PDF
                    </Button>
                  </div>
                </div>

                <div className="cv-sheet max-h-[28rem] overflow-auto rounded-md p-5">
                  <pre className="whitespace-pre-wrap font-serif">{selectedCvBody}</pre>
                </div>

                {comparingOlderCvVersion ? (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold">Compare with latest</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      You are previewing version {selectedCvVersion.version}. The current latest
                      draft is version {latestCvVersion.version}.
                    </p>
                    <div className="mt-2">
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">
                        Latest v{latestCvVersion.version}
                      </p>
                      <div className="cv-sheet max-h-[24rem] overflow-auto rounded-md p-4">
                        <pre className="whitespace-pre-wrap font-serif">{latestCvVersion.body}</pre>
                      </div>
                    </div>
                  </div>
                ) : null}

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
                {latestLetter ? "New cover letter draft" : "Create cover letter"}
              </Button>
            }
          >
            {selectedLetter && latestLetter ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={`Status: ${selectedLetter.status}`}
                    tone={selectedLetter.status === "Approved" ? "success" : "warning"}
                  />
                  <StatusPill label={`Preview: v${selectedLetterVersion}`} />
                  {comparingOlderLetter ? (
                    <StatusPill label={`Latest: v${latestLetterVersion}`} tone="warning" />
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={approveLatestLetter}
                    disabled={comparingOlderLetter || latestLetter.status === "Approved"}
                  >
                    Approve latest cover letter
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <div>
                    <Label htmlFor="cover-letter-preview-version">Preview cover letter version</Label>
                    <select
                      id="cover-letter-preview-version"
                      className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={selectedLetter.id}
                      onChange={(event) => setSelectedCoverLetterId(event.target.value)}
                    >
                      {coverLetterVersions
                        .slice()
                        .reverse()
                        .map((version) => {
                          const versionNumber =
                            coverLetterVersions.findIndex((candidate) => candidate.id === version.id) + 1;
                          return (
                            <option key={version.id} value={version.id}>
                              Version {versionNumber} · {version.status} ·{" "}
                              {new Date(version.createdAt).toLocaleDateString("en-GB")}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={downloadSelectedLetter}>
                      Download cover letter .doc
                    </Button>
                    <Button size="sm" variant="secondary" onClick={printSelectedLetter}>
                      Print / Save cover letter as PDF
                    </Button>
                  </div>
                </div>

                <pre className="whitespace-pre-wrap rounded-md border border-border bg-surface-2/40 p-4 text-sm">
                  {selectedLetter.body}
                </pre>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-muted-foreground">
                      Concise application email
                    </h3>
                    <Button size="sm" variant="secondary" onClick={() => void copySelectedEmail()}>
                      Copy application email
                    </Button>
                  </div>
                  <pre className="mt-1.5 whitespace-pre-wrap rounded-md border border-border bg-surface-2/40 p-4 text-sm">
                    {selectedLetter.emailVersion}
                  </pre>
                </div>

                <p className="text-xs text-muted-foreground">
                  Evidence used: {selectedLetter.evidenceIds.join(", ") || "none"}
                </p>

                {comparingOlderLetter ? (
                  <div>
                    <h3 className="text-sm font-semibold">Compare with latest cover letter</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      You are previewing version {selectedLetterVersion}. The current latest draft
                      is version {latestLetterVersion}.
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-surface-2/40 p-4 text-sm">
                      {latestLetter.body}
                    </pre>
                  </div>
                ) : null}

                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">Version history</h3>
                  <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                    {coverLetterVersions
                      .slice()
                      .reverse()
                      .map((version) => {
                        const versionNumber =
                          coverLetterVersions.findIndex((candidate) => candidate.id === version.id) + 1;
                        return (
                          <li key={version.id}>
                            v{versionNumber} · {new Date(version.createdAt).toLocaleString("en-GB")} ·{" "}
                            {version.status}
                          </li>
                        );
                      })}
                  </ul>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No cover letter yet."
                hint="Generate one from verified evidence."
              />
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="apply" className="mt-4 space-y-4">
          <Panel
            title="Application pack"
            description="Core materials for this role. Automated reviewer checks remain a separate future gate."
          >
            <div className="flex flex-wrap gap-2">
              <StatusPill
                label={`Job: ${job?.description.trim() ? "Ready" : "Needs input"}`}
                tone={job?.description.trim() ? "success" : "warning"}
              />
              <StatusPill
                label={`Match: ${scan ? "Ready" : "Not run"}`}
                tone={scan ? "success" : "warning"}
              />
              <StatusPill
                label={`Evidence: ${scan?.evidenceMap?.length ? "Ready" : "Not mapped"}`}
                tone={scan?.evidenceMap?.length ? "success" : "warning"}
              />
              <StatusPill
                label={`CV: ${cv?.status ?? "Not started"}`}
                tone={cv?.status === "Approved" ? "success" : "warning"}
              />
              <StatusPill
                label={`Cover letter: ${latestLetter?.status ?? "Not started"}`}
                tone={latestLetter?.status === "Approved" ? "success" : "warning"}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              This checkpoint shows whether the core application materials exist and which versions
              are approved. It does not mark an application Ready to Apply until the separate review
              gate is implemented.
            </p>
          </Panel>

          <Panel title="Application tracking">
            <div className="mb-4 flex flex-wrap gap-2">
              <StatusPill label={`Stage: ${app.stage}`} />
              {app.compatibilityScore !== undefined ? (
                <StatusPill label={`Match: ${app.compatibilityScore}%`} />
              ) : null}
            </div>
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
