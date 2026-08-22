import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/careeros/app-shell";
import {
  Panel,
  ScoreBar,
  ScoreRing,
  StatusPill,
  evidenceTone,
} from "@/components/careeros/ui-bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractJobFromUrl } from "@/lib/careeros/job-extract.functions";
import { consumeDiscoveredJobForAnalysis } from "@/lib/careeros/job-handoff";
import { runScan } from "@/lib/careeros/scoring";
import { uid, useCareerOs } from "@/lib/careeros/store";
import type {
  EvidenceMapItem,
  JobExtractionCompleteness,
  JobExtractionMethod,
  JobRecord,
  RequirementMatchStatus,
  ScanResult,
} from "@/lib/careeros/types";

export const Route = createFileRoute("/job-scan")({
  head: () => ({
    meta: [
      { title: "Job Scan | CareerOS" },
      {
        name: "description",
        content:
          "Add a job by URL or paste, then run an explainable role compatibility scan against verified evidence.",
      },
      { property: "og:title", content: "Job Scan | CareerOS" },
      {
        property: "og:description",
        content: "Explainable role compatibility scoring from verified career evidence.",
      },
    ],
  }),
  component: JobScanPage,
});

interface ExtractedDetail {
  confidence: "high" | "medium";
  completeness: JobExtractionCompleteness;
  method: JobExtractionMethod;
  wordCount: number;
  qualityNotes: string[];
  workplaceType: string;
  employmentType: string;
  salary: string;
  closingDate: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  qualifications: string[];
  experience: string[];
  tools: string[];
  competencies: string[];
  applyUrl: string;
}

interface PendingExtraction {
  text: string;
  title: string;
  company: string;
  location: string;
  detail: ExtractedDetail;
}

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function discoveredHandoffKey(search = window.location.search): string {
  return new URLSearchParams(search).get("discovered") ?? "";
}

function Chips({ items, tone = "neutral" }: { items: string[]; tone?: "neutral" | "info" }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <StatusPill key={item} label={item} tone={tone} />
      ))}
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <ul className="mt-1 space-y-1 text-xs leading-relaxed text-muted-foreground">
        {items.slice(0, 8).map((item) => (
          <li key={item} className="break-words">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobScanPage() {
  const { data, update, logActivity } = useCareerOs();
  const navigate = useNavigate();
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const busy = useRef(false);

  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [detail, setDetail] = useState<ExtractedDetail | null>(null);
  const [pendingExtraction, setPendingExtraction] = useState<PendingExtraction | null>(null);
  const [fetching, setFetching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [job, setJob] = useState<JobRecord | null>(null);

  useEffect(() => {
    const key = discoveredHandoffKey();
    if (!key) return;
    const discoveredJob = consumeDiscoveredJobForAnalysis(key);
    if (!discoveredJob) return;

    const wordCount = words(discoveredJob.description);
    setUrl(discoveredJob.sourceUrl);
    setCompany(discoveredJob.company);
    setTitle(discoveredJob.title);
    setLocation(discoveredJob.location);
    setDescription(discoveredJob.description);
    setDetail({
      confidence: "medium",
      completeness: wordCount >= 120 ? "complete" : "partial",
      method: "semantic",
      wordCount,
      qualityNotes: ["Prefilled from the live Job Board source. Review before analysing."],
      workplaceType: discoveredJob.remote ? "Remote" : "",
      employmentType: discoveredJob.employmentType,
      salary: discoveredJob.salary,
      closingDate: "",
      responsibilities: [],
      requiredSkills: [],
      preferredSkills: [],
      qualifications: [],
      experience: [],
      tools: discoveredJob.tags,
      competencies: [],
      applyUrl: discoveredJob.sourceUrl,
    });
    toast.success("Job Board role loaded. Review it before analysing.");
  }, []);

  const jdWords = words(description);
  const insufficient = jdWords < 40;

  function applyExtraction(extraction: PendingExtraction) {
    setDescription(extraction.text);
    if (extraction.title) setTitle(extraction.title);
    if (extraction.company) setCompany(extraction.company);
    if (extraction.location) setLocation(extraction.location);
    setDetail(extraction.detail);
    setPendingExtraction(null);
    toast.success(
      extraction.detail.completeness === "complete"
        ? "Complete job description extracted. Check it, then analyse."
        : "Partial job description extracted. Review it carefully before analysing.",
    );
  }

  async function handleFetch() {
    const target = url.trim();
    if (!target) {
      toast.error("Add a job link first, or paste the description below.");
      return;
    }
    if (!/^https?:\/\//i.test(target)) {
      setFallback("That does not look like a full web address. Include https:// at the start.");
      return;
    }
    setFetching(true);
    setFallback(null);
    try {
      const result = await extractJobFromUrl({ data: { url: target } });
      if (result.ok) {
        const extraction: PendingExtraction = {
          text: result.text,
          title: result.title,
          company: result.company,
          location: result.location,
          detail: {
            confidence: result.confidence,
            completeness: result.completeness,
            method: result.method,
            wordCount: result.wordCount,
            qualityNotes: result.qualityNotes,
            workplaceType: result.workplaceType,
            employmentType: result.employmentType,
            salary: result.salary,
            closingDate: result.closingDate,
            responsibilities: result.responsibilities,
            requiredSkills: result.requiredSkills,
            preferredSkills: result.preferredSkills,
            qualifications: result.qualifications,
            experience: result.experience,
            tools: result.tools,
            competencies: result.competencies,
            applyUrl: result.applyUrl,
          },
        };

        if (description.trim() && description.trim() !== result.text.trim()) {
          setPendingExtraction(extraction);
        } else {
          applyExtraction(extraction);
        }
      } else {
        setDetail(null);
        setFallback(
          `${result.reason} Paste the job description below instead. The scan works the same way, and CareerOS will not analyse an unreliable extraction.`,
        );
      }
    } catch {
      setDetail(null);
      setFallback(
        "We could not read that page automatically. Paste the job description below instead.",
      );
    } finally {
      setFetching(false);
    }
  }

  function handleScan() {
    if (busy.current) return;
    setScanError(null);
    if (insufficient) {
      toast.error("Add more of the job description, at least a short paragraph.");
      return;
    }
    busy.current = true;
    setScanning(true);
    try {
      const extracted = detail && detail.method !== "manual";
      const record: JobRecord = {
        id: uid("job"),
        company: company.trim() || "Unspecified company",
        title: title.trim() || "Unspecified role",
        location:
          [location.trim(), detail?.workplaceType].filter(Boolean).join(" · ") || "Unspecified",
        url: url.trim() || undefined,
        description: description.trim(),
        createdAt: new Date().toISOString(),
        sourceType: extracted ? "url" : "paste",
        extractionCompleteness: extracted ? detail.completeness : "manual",
        extractionMethod: extracted ? detail.method : "manual",
        descriptionWordCount: jdWords,
      };
      const result = runScan(record, data);
      update((draft) => {
        draft.jobs = [record, ...(draft.jobs ?? [])];
        draft.scans = [result, ...(draft.scans ?? [])];
        return draft;
      });
      logActivity(
        `Ran a role scan for ${record.title} at ${record.company}: ${result.overall}% fit.`,
      );
      setJob(record);
      setScan(result);
      toast.success(`Scan complete: ${result.overall}% compatibility.`);
      window.setTimeout(
        () => resultsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }),
        60,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setScanError(`The scan could not complete: ${message}`);
      toast.error("Scan failed. See the message below.");
    } finally {
      busy.current = false;
      setScanning(false);
    }
  }

  function clearAll() {
    setUrl("");
    setCompany("");
    setTitle("");
    setLocation("");
    setDescription("");
    setDetail(null);
    setPendingExtraction(null);
    setScan(null);
    setJob(null);
    setFallback(null);
    setScanError(null);
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
          workingArrangement:
            detail?.workplaceType === "Hybrid"
              ? "Hybrid"
              : detail?.workplaceType === "Remote"
                ? "Remote"
                : detail?.workplaceType === "On-site"
                  ? "On-site"
                  : "Unspecified",
          employmentType:
            detail?.employmentType === "Contract"
              ? "Contract"
              : detail?.employmentType === "Fixed-term"
                ? "Fixed-term"
                : detail?.employmentType.toLowerCase().includes("permanent")
                  ? "Permanent"
                  : "Unspecified",
          priority: scan.overall >= 70 ? "High" : "Medium",
          stage: "Preparing",
          dateAdded: new Date().toISOString(),
          notes: "",
          url: job.url,
          salary: detail?.salary || undefined,
          deadline: detail?.closingDate || undefined,
          compatibilityScore: scan.overall,
          nextAction: "Review the Evidence Map and tailor CV",
          history: [
            {
              at: new Date().toISOString(),
              entry: `Created from job scan (${scan.overall}% fit).`,
            },
          ],
        },
        ...draft.applications,
      ];
      return draft;
    });
    logActivity(`Application created for ${job.title} at ${job.company}.`);
    void navigate({ to: "/applications/$id", params: { id } });
  }

  return (
    <AppShell
      title="Job Scan"
      subtitle="Add a job by link or paste the description. Either is enough."
    >
      <div className="space-y-4">
        <Panel
          title="1. Add the job"
          description="Use the link if the site allows it. Pasting always works."
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="jd-url">Job URL</Label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="jd-url"
                  placeholder="https://…"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  inputMode="url"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleFetch()}
                  disabled={fetching}
                  className="shrink-0"
                >
                  {fetching ? "Extracting…" : "Extract job details"}
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Optional. Leave blank and paste the description below if you prefer.
              </p>
            </div>

            {fallback ? (
              <div
                role="status"
                className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
              >
                <p className="font-medium text-foreground">
                  Extraction blocked. Paste the description instead.
                </p>
                <p className="mt-1 text-muted-foreground">{fallback}</p>
              </div>
            ) : null}

            <div>
              <Label htmlFor="jd-text">Job description</Label>
              <Textarea
                id="jd-text"
                className="mt-1.5 min-h-56 text-sm"
                placeholder="Paste the full job description here."
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  if (detail?.method !== "manual") setDetail(null);
                }}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {jdWords} words. {insufficient ? "Add at least 40 words." : "Ready to analyse."}
              </p>
            </div>
          </div>
        </Panel>

        {description.trim() ? (
          <Panel
            title="2. Check the details"
            description="Everything here is editable before you analyse."
            actions={
              detail && detail.method !== "manual" ? (
                <StatusPill
                  label={`Extraction: ${detail.completeness === "complete" ? "Complete" : "Partial"}`}
                  tone={detail.completeness === "complete" ? "success" : "warning"}
                />
              ) : (
                <StatusPill label="Manual input" tone="info" />
              )
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="jd-title">Role title</Label>
                <Input
                  id="jd-title"
                  className="mt-1.5"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="jd-company">Company</Label>
                <Input
                  id="jd-company"
                  className="mt-1.5"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="jd-loc">Location</Label>
                <Input
                  id="jd-loc"
                  className="mt-1.5"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="jd-work">Working arrangement</Label>
                <Input
                  id="jd-work"
                  className="mt-1.5"
                  placeholder="Hybrid / Remote / On-site"
                  value={detail?.workplaceType ?? ""}
                  onChange={(event) =>
                    setDetail((current) => ({
                      ...(current ?? emptyDetail()),
                      workplaceType: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {detail && detail.method !== "manual" ? (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={`${detail.wordCount} JD words captured`} tone="info" />
                  {detail.employmentType ? (
                    <StatusPill label={`Type: ${detail.employmentType}`} />
                  ) : null}
                  {detail.salary ? <StatusPill label={`Salary: ${detail.salary}`} /> : null}
                  {detail.closingDate ? (
                    <StatusPill label={`Closes: ${detail.closingDate}`} tone="warning" />
                  ) : null}
                </div>

                {detail.completeness === "partial" ? (
                  <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
                    <p className="font-medium text-foreground">
                      Partial extraction. Review before scanning.
                    </p>
                    <ul className="mt-1 space-y-1 text-muted-foreground">
                      {detail.qualityNotes.map((note) => (
                        <li key={note}>• {note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <DetailList title="Responsibilities" items={detail.responsibilities} />
                  <DetailList title="Required skills / experience" items={detail.requiredSkills} />
                  <DetailList title="Preferred" items={detail.preferredSkills} />
                  <DetailList title="Qualifications" items={detail.qualifications} />
                </div>
                {detail.tools.length ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-foreground">Tools mentioned</p>
                    <Chips items={detail.tools} tone="info" />
                  </div>
                ) : null}
                {detail.competencies.length ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-foreground">
                      Behavioural competencies
                    </p>
                    <Chips items={detail.competencies} />
                  </div>
                ) : null}
              </div>
            ) : null}

            {scanError ? (
              <div
                role="alert"
                className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
              >
                <p className="font-medium text-foreground">Scan failed</p>
                <p className="mt-1 text-muted-foreground">{scanError}</p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={handleScan} disabled={scanning || insufficient}>
                {scanning ? "Analysing role…" : "Analyse role"}
              </Button>
              <Button variant="ghost" onClick={clearAll}>
                Start again
              </Button>
            </div>
          </Panel>
        ) : null}

        <div ref={resultsRef}>
          {scan && job ? <ScanResultView scan={scan} onCreate={createApplication} /> : null}
        </div>
      </div>

      <AlertDialog
        open={Boolean(pendingExtraction)}
        onOpenChange={(open) => {
          if (!open) setPendingExtraction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use the extracted job description?</AlertDialogTitle>
            <AlertDialogDescription>
              You already have text in the job description box. CareerOS will not replace it unless
              you choose to use the newly extracted version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingExtraction(null)}>
              Keep my pasted text
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingExtraction) applyExtraction(pendingExtraction);
              }}
            >
              Use extracted text
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function emptyDetail(): ExtractedDetail {
  return {
    confidence: "medium",
    completeness: "manual",
    method: "manual",
    wordCount: 0,
    qualityNotes: [],
    workplaceType: "",
    employmentType: "",
    salary: "",
    closingDate: "",
    responsibilities: [],
    requiredSkills: [],
    preferredSkills: [],
    qualifications: [],
    experience: [],
    tools: [],
    competencies: [],
    applyUrl: "",
  };
}

const PLAIN_VERDICT: Record<string, string> = {
  "Strong Fit": "You meet the core of this role on verified evidence. Apply with a tailored CV.",
  Competitive:
    "You are a credible candidate. Close the named gaps honestly and lead with your strongest verified evidence.",
  "Plausible Stretch":
    "This is a stretch. Apply only if the role is a genuine priority and you can address the gaps honestly.",
  "Weak Fit":
    "The approved evidence does not support this role well. Your time may be better spent elsewhere.",
};

function requirementTone(status: RequirementMatchStatus) {
  if (status === "Covered") return "success" as const;
  if (status === "Partial") return "warning" as const;
  if (status === "Blocked") return "danger" as const;
  return "danger" as const;
}

function EvidenceMapPanel({ items }: { items: EvidenceMapItem[] }) {
  const covered = items.filter((item) => item.status === "Covered").length;
  const partial = items.filter((item) => item.status === "Partial").length;
  const gaps = items.filter((item) => item.status === "Gap").length;
  const blocked = items.filter((item) => item.status === "Blocked").length;

  return (
    <Panel
      title="Evidence Map"
      description="The compatibility score is built from these job criteria and the evidence CareerOS is allowed to use."
      actions={<StatusPill label={`${items.length} criteria mapped`} tone="info" />}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <StatusPill label={`${covered} Covered`} tone="success" />
        <StatusPill label={`${partial} Partial`} tone="warning" />
        <StatusPill label={`${gaps} Gap`} tone="danger" />
        <StatusPill label={`${blocked} Blocked`} tone="danger" />
      </div>

      {items.length ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 font-medium text-foreground">
                  {item.requirement}
                </span>
                <StatusPill label={item.category} />
                <StatusPill label={item.priority} tone="info" />
                <StatusPill label={item.status} tone={requirementTone(item.status)} />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {item.explanation}
              </p>
              {item.evidenceIds.length || item.profileItemIds.length || item.sourceIds.length ? (
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">View evidence references</summary>
                  <div className="mt-1 space-y-1">
                    {item.evidenceIds.length ? (
                      <p>Evidence: {item.evidenceIds.join(", ")}</p>
                    ) : null}
                    {item.profileItemIds.length ? (
                      <p>Master Profile: {item.profileItemIds.join(", ")}</p>
                    ) : null}
                    {item.sourceIds.length ? <p>Sources: {item.sourceIds.join(", ")}</p> : null}
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          CareerOS could not map clear job criteria from this description. Review the JD before
          relying on the score.
        </p>
      )}
    </Panel>
  );
}

export function ScanResultView({ scan, onCreate }: { scan: ScanResult; onCreate?: () => void }) {
  const tone = scan.overall >= 70 ? "success" : scan.overall >= 50 ? "warning" : "danger";
  const topDimensions = [...scan.subScores].sort((a, b) => b.score - a.score);
  const evidenceMap = scan.evidenceMap ?? [];

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <ScoreRing value={scan.overall} />
          <div className="min-w-0 space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Role compatibility
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{scan.verdict}</h2>
              <StatusPill label={scan.strategy} tone={tone} />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {PLAIN_VERDICT[scan.verdict] ?? ""}
            </p>
            <p className="text-xs text-muted-foreground">
              This percentage is calculated from the Evidence Map below. Keyword coverage is
              supporting context only.
            </p>
            {onCreate ? (
              <Button size="sm" onClick={onCreate}>
                Create application workspace
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>

      <EvidenceMapPanel items={evidenceMap} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Strong matches" description="Backed by verified evidence only">
          <ul className="space-y-2 text-sm">
            {scan.strengths.length ? (
              scan.strengths.map((strength) => (
                <li
                  key={strength.text}
                  className="rounded-md border border-success/30 bg-success/10 p-2.5"
                >
                  {strength.text}
                  {strength.evidenceId ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      Ref: {strength.evidenceId}
                    </span>
                  ) : null}
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No verified strengths matched this role.</li>
            )}
          </ul>
        </Panel>

        <Panel title="Important gaps" description="Address these honestly or skip the role">
          <ul className="space-y-2 text-sm">
            {scan.gaps.length ? (
              scan.gaps.map((gap) => (
                <li
                  key={gap}
                  className="rounded-md border border-warning/30 bg-warning/10 p-2.5 text-foreground"
                >
                  {gap}
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No material gaps.</li>
            )}
            {scan.partials.map((partial) => (
              <li
                key={partial}
                className="rounded-md border border-border p-2.5 text-muted-foreground"
              >
                {partial}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Blocked evidence"
        description="These records may be relevant, but CareerOS cannot use them until their evidence status permits it."
      >
        {scan.blockedEvidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No matching evidence is currently blocked from use.
          </p>
        ) : (
          <ul className="space-y-2">
            {scan.blockedEvidence.map((blockedItem) => (
              <li key={blockedItem.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">{blockedItem.claim}</span>
                <StatusPill label={blockedItem.status} tone={evidenceTone(blockedItem.status)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Next actions">
        <ol className="space-y-1.5 text-sm text-muted-foreground">
          <li>1. Review every required Gap or Blocked criterion before deciding to apply.</li>
          <li>2. Tailor a CV version from verified and approved evidence only.</li>
          <li>
            3. Use the {scan.missingKeywords.length} lower-coverage terms only where you have
            genuine evidence.
          </li>
        </ol>
      </Panel>

      <details className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
        <summary className="cursor-pointer text-sm font-semibold">
          Detailed scoring breakdown
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {topDimensions.map((subScore) => (
            <ScoreBar
              key={subScore.key}
              label={subScore.label}
              value={subScore.score}
              reason={subScore.reason}
            />
          ))}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Keywords matched</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {scan.matchedKeywords.map((keyword) => (
                <StatusPill key={keyword} label={keyword} tone="success" />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Missing or low coverage</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {scan.missingKeywords.map((keyword) => (
                <StatusPill key={keyword} label={keyword} tone="warning" />
              ))}
            </div>
          </div>
        </div>
        <ul className="mt-5 space-y-1 text-xs leading-relaxed text-muted-foreground">
          {scan.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
