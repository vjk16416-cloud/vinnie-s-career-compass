import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/careeros/app-shell";
import { Panel, ScoreBar, ScoreRing, StatusPill, evidenceTone } from "@/components/careeros/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractJobFromUrl } from "@/lib/careeros/job-extract.functions";
import { runScan } from "@/lib/careeros/scoring";
import { uid, useCareerOs } from "@/lib/careeros/store";
import type { JobRecord, ScanResult } from "@/lib/careeros/types";

export const Route = createFileRoute("/job-scan")({
  head: () => ({
    meta: [
      { title: "Job Scan — CareerOS" },
      {
        name: "description",
        content:
          "Add a job by URL or paste, then run an explainable role compatibility scan against verified evidence.",
      },
      { property: "og:title", content: "Job Scan — CareerOS" },
      {
        property: "og:description",
        content: "Explainable role compatibility scoring from verified career evidence.",
      },
    ],
  }),
  component: JobScanPage,
});

function JobScanPage() {
  const { data, update, logActivity } = useCareerOs();
  const navigate = useNavigate();

  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [fetching, setFetching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [job, setJob] = useState<JobRecord | null>(null);

  async function handleFetch() {
    if (!url.trim()) {
      toast.error("Add a job link first.");
      return;
    }
    setFetching(true);
    setFallback(null);
    try {
      const result = await extractJobFromUrl({ data: { url: url.trim() } });
      if (result.ok) {
        // Only fill fields the user has left empty.
        if (!description.trim()) setDescription(result.text);
        if (!title.trim() && result.title) setTitle(result.title);
        if (!company.trim() && result.company) setCompany(result.company);
        if (!location.trim() && result.location) setLocation(result.location);
        toast.success("Job description pulled from the link. Check it before scanning.");
      } else {
        setFallback(
          `${result.reason} Please copy the job description from the page and paste it below — the scan works exactly the same way.`,
        );
      }
    } catch {
      setFallback(
        "We could not read that page automatically. Please paste the job description below instead.",
      );
    } finally {
      setFetching(false);
    }
  }

  function handleScan() {
    setScanError(null);
    if (description.trim().split(/\s+/).filter(Boolean).length < 40) {
      toast.error("Add more of the job description — at least a few sentences.");
      return;
    }
    setScanning(true);
    try {
      const record: JobRecord = {
        id: uid("job"),
        company: company.trim() || "Unspecified company",
        title: title.trim() || "Unspecified role",
        location: location.trim() || "Unspecified",
        url: url.trim() || undefined,
        description: description.trim(),
        createdAt: new Date().toISOString(),
        sourceType: url.trim() ? "url" : "paste",
      };
      const result = runScan(record, data);
      update((draft) => {
        draft.jobs = [record, ...(draft.jobs ?? [])];
        draft.scans = [result, ...(draft.scans ?? [])];
        return draft;
      });
      logActivity(`Ran a role scan for ${record.title} at ${record.company} — ${result.overall}% fit.`);
      setJob(record);
      setScan(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setScanError(`The scan could not complete: ${message}`);
      toast.error("Scan failed — see the message below.");
    } finally {
      setScanning(false);
    }
  }


  function createApplication() {
    if (!job || !scan) return;
    const id = uid("app");
    update((draft) => {
      draft.applications = [
        {
          id,
          jobId: job.id,
          company: job.company,
          title: job.title,
          location: job.location,
          workingArrangement: "Unspecified",
          employmentType: "Unspecified",
          priority: scan.overall >= 70 ? "High" : "Medium",
          stage: "Preparing",
          dateAdded: new Date().toISOString(),
          notes: "",
          url: job.url,
          compatibilityScore: scan.overall,
          nextAction: "Review match analysis and tailor CV",
          history: [{ at: new Date().toISOString(), entry: `Created from job scan (${scan.overall}% fit).` }],
        },
        ...draft.applications,
      ];
      return draft;
    });
    logActivity(`Application created for ${job.title} at ${job.company}.`);
    void navigate({ to: "/applications/$id", params: { id } });
  }

  return (
    <AppShell title="Job Scan" subtitle="Add a job by link or paste, then run an explainable scan">
      <div className="space-y-4">
        <Panel title="Add job" description="Try the link first; pasting always works.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="jd-url">Job URL</Label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="jd-url"
                  placeholder="https://…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  inputMode="url"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleFetch()}
                  disabled={fetching}
                  className="shrink-0"
                >
                  {fetching ? "Reading page…" : "Get description"}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="jd-company">Company</Label>
              <Input
                id="jd-company"
                className="mt-1.5"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="jd-title">Role title</Label>
              <Input
                id="jd-title"
                className="mt-1.5"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="jd-loc">Location</Label>
              <Input
                id="jd-loc"
                className="mt-1.5"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="jd-text">Job description</Label>
              <Textarea
                id="jd-text"
                className="mt-1.5 min-h-56 font-mono text-xs"
                placeholder="Paste the full job description here."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {fallback ? (
            <div
              role="status"
              className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"
            >
              <p className="font-medium">We could not read the job page automatically</p>
              <p className="mt-1 text-muted-foreground">{fallback}</p>
            </div>
          ) : null}

          {scanError ? (
            <div
              role="alert"
              className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground"
            >
              <p className="font-medium">Scan failed</p>
              <p className="mt-1 text-muted-foreground">{scanError}</p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleScan} disabled={scanning}>
              {scanning ? "Analysing…" : "Analyse role / run scan"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDescription("");
                setScan(null);
                setJob(null);
                setFallback(null);
                setScanError(null);
              }}
            >
              Clear
            </Button>
          </div>

        </Panel>

        {scan && job ? <ScanResultView scan={scan} onCreate={createApplication} /> : null}
      </div>
    </AppShell>
  );
}

export function ScanResultView({
  scan,
  onCreate,
}: {
  scan: ScanResult;
  onCreate?: () => void;
}) {
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <ScoreRing value={scan.overall} />
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{scan.verdict}</h2>
              <StatusPill
                label={`Strategy: ${scan.strategy}`}
                tone={
                  scan.strategy === "Apply"
                    ? "success"
                    : scan.strategy === "Skip"
                      ? "danger"
                      : "warning"
                }
              />
            </div>
            <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
              {scan.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {onCreate ? (
              <Button size="sm" onClick={onCreate}>
                Create application workspace
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel title="Sub-scores" description="Each dimension is scored and explained separately.">
        <div className="grid gap-4 md:grid-cols-2">
          {scan.subScores.map((s) => (
            <ScoreBar key={s.key} label={s.label} value={s.score} reason={s.reason} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top strengths" description="Backed by verified evidence only">
          <ul className="space-y-2 text-sm">
            {scan.strengths.length ? (
              scan.strengths.map((s) => (
                <li key={s.text} className="rounded-md border border-border bg-surface-2/40 p-2.5">
                  {s.text}
                  {s.evidenceId ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      Evidence ref: {s.evidenceId}
                    </span>
                  ) : null}
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No verified strengths matched this role.</li>
            )}
          </ul>
        </Panel>

        <Panel title="Partial matches">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {scan.partials.length ? (
              scan.partials.map((p) => <li key={p}>{p}</li>)
            ) : (
              <li>No partial matches flagged.</li>
            )}
          </ul>
        </Panel>

        <Panel title="Gaps and risks">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {scan.gaps.length ? scan.gaps.map((g) => <li key={g}>{g}</li>) : <li>No material gaps.</li>}
          </ul>
        </Panel>

        <Panel title="Keyword coverage">
          <p className="text-xs text-muted-foreground">Matched</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {scan.matchedKeywords.map((k) => (
              <StatusPill key={k} label={k} tone="success" />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Missing or low coverage</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {scan.missingKeywords.map((k) => (
              <StatusPill key={k} label={k} tone="warning" />
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Evidence blocked from use"
        description="These records are relevant but cannot be asserted in generated documents."
      >
        {scan.blockedEvidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing blocked for this role.</p>
        ) : (
          <ul className="space-y-2">
            {scan.blockedEvidence.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">{b.claim}</span>
                <StatusPill label={`Status: ${b.status}`} tone={evidenceTone(b.status)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
