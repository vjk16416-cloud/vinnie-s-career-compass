import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
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

interface ExtractedDetail {
  confidence: "high" | "medium";
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

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function Chips({ items, tone = "neutral" }: { items: string[]; tone?: "neutral" | "info" }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <StatusPill key={i} label={i} tone={tone} />
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
        {items.slice(0, 8).map((i) => (
          <li key={i} className="break-words">
            • {i}
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
  const [fetching, setFetching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [job, setJob] = useState<JobRecord | null>(null);

  const jdWords = words(description);
  const insufficient = jdWords < 40;

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
        setDescription(result.text);
        if (result.title) setTitle(result.title);
        if (result.company) setCompany(result.company);
        if (result.location) setLocation(result.location);
        setDetail({
          confidence: result.confidence,
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
        });
        toast.success(
          result.confidence === "high"
            ? "Job posting extracted. Check the preview, then analyse."
            : "Partial extraction. Please check and correct the preview before analysing.",
        );
      } else {
        setDetail(null);
        setFallback(
          `${result.reason} Paste the job description below instead — the scan works exactly the same way. Nothing is analysed from an unreliable page.`,
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
      toast.error("Add more of the job description — at least a short paragraph.");
      return;
    }
    busy.current = true;
    setScanning(true);
    try {
      const record: JobRecord = {
        id: uid("job"),
        company: company.trim() || "Unspecified company",
        title: title.trim() || "Unspecified role",
        location: [location.trim(), detail?.workplaceType].filter(Boolean).join(" · ") || "Unspecified",
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
      logActivity(
        `Ran a role scan for ${record.title} at ${record.company} — ${result.overall}% fit.`,
      );
      setJob(record);
      setScan(result);
      toast.success(`Scan complete — ${result.overall}% compatibility.`);
      window.setTimeout(
        () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        60,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setScanError(`The scan could not complete: ${message}`);
      toast.error("Scan failed — see the message below.");
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
          employmentType: "Unspecified",
          priority: scan.overall >= 70 ? "High" : "Medium",
          stage: "Preparing",
          dateAdded: new Date().toISOString(),
          notes: "",
          url: job.url,
          salary: detail?.salary || undefined,
          deadline: detail?.closingDate || undefined,
          compatibilityScore: scan.overall,
          nextAction: "Review match analysis and tailor CV",
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
      subtitle="Add a job by link or paste the description — either is enough"
    >
      <div className="space-y-4">
        <Panel
          title="1. Add the job"
          description="Use the link if the site allows it; pasting always works."
        >
          <div className="space-y-4">
            <div>
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
                  Extraction blocked — paste the description instead
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
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {jdWords} words{" "}
                {insufficient ? "— add at least 40 words to run a reliable scan." : "— ready to analyse."}
              </p>
            </div>
          </div>
        </Panel>

        {description.trim() ? (
          <Panel
            title="2. Check the details"
            description="Everything here is editable before you analyse."
            actions={
              detail ? (
                <StatusPill
                  label={`Extraction confidence: ${detail.confidence}`}
                  tone={detail.confidence === "high" ? "success" : "warning"}
                />
              ) : (
                <StatusPill label="Entered manually" tone="info" />
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
                  onChange={(e) => setTitle(e.target.value)}
                />
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
                <Label htmlFor="jd-loc">Location</Label>
                <Input
                  id="jd-loc"
                  className="mt-1.5"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="jd-work">Working arrangement</Label>
                <Input
                  id="jd-work"
                  className="mt-1.5"
                  placeholder="Hybrid / Remote / On-site"
                  value={detail?.workplaceType ?? ""}
                  onChange={(e) =>
                    setDetail((d) => ({
                      ...(d ?? emptyDetail()),
                      workplaceType: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {detail ? (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div className="flex flex-wrap gap-2">
                  {detail.employmentType ? (
                    <StatusPill label={`Type: ${detail.employmentType}`} />
                  ) : null}
                  {detail.salary ? <StatusPill label={`Salary: ${detail.salary}`} /> : null}
                  {detail.closingDate ? (
                    <StatusPill label={`Closes: ${detail.closingDate}`} tone="warning" />
                  ) : null}
                </div>
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
    </AppShell>
  );
}

function emptyDetail(): ExtractedDetail {
  return {
    confidence: "medium",
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
    "You are a credible candidate. Close the named gaps in your covering letter and lead with your strongest verified evidence.",
  "Plausible Stretch":
    "This is a stretch. Only apply if the role is a genuine priority and you can address the gaps honestly.",
  "Weak Fit": "The evidence does not support this role well. Your time is better spent elsewhere.",
};

export function ScanResultView({
  scan,
  onCreate,
}: {
  scan: ScanResult;
  onCreate?: () => void;
}) {
  const tone = scan.overall >= 70 ? "success" : scan.overall >= 50 ? "warning" : "danger";
  const topDimensions = [...scan.subScores].sort((a, b) => b.score - a.score);

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
            {onCreate ? (
              <Button size="sm" onClick={onCreate}>
                Create application workspace
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Strong matches" description="Backed by verified evidence only">
          <ul className="space-y-2 text-sm">
            {scan.strengths.length ? (
              scan.strengths.map((s) => (
                <li
                  key={s.text}
                  className="rounded-md border border-success/30 bg-success/10 p-2.5"
                >
                  {s.text}
                  {s.evidenceId ? (
                    <span className="ml-2 text-xs text-muted-foreground">Ref: {s.evidenceId}</span>
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
              scan.gaps.map((g) => (
                <li
                  key={g}
                  className="rounded-md border border-warning/30 bg-warning/10 p-2.5 text-foreground"
                >
                  {g}
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No material gaps.</li>
            )}
            {scan.partials.map((p) => (
              <li key={p} className="rounded-md border border-border p-2.5 text-muted-foreground">
                {p}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Evidence position"
        description="Only Verified records can be used in tailored documents."
      >
        {scan.blockedEvidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing relevant is blocked — every matching record is verified.
          </p>
        ) : (
          <ul className="space-y-2">
            {scan.blockedEvidence.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">{b.claim}</span>
                <StatusPill label={b.status} tone={evidenceTone(b.status)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Next actions">
        <ol className="space-y-1.5 text-sm text-muted-foreground">
          <li>1. Tailor a CV version from verified evidence only.</li>
          <li>
            2. Cover the {scan.missingKeywords.length} lower-coverage terms where you have genuine
            evidence.
          </li>
          <li>3. Prepare answers for each gap listed above.</li>
        </ol>
      </Panel>

      <details className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
        <summary className="cursor-pointer text-sm font-semibold">
          Detailed scoring breakdown
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {topDimensions.map((s) => (
            <ScoreBar key={s.key} label={s.label} value={s.score} reason={s.reason} />
          ))}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Keywords matched</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {scan.matchedKeywords.map((k) => (
                <StatusPill key={k} label={k} tone="success" />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Missing or low coverage</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {scan.missingKeywords.map((k) => (
                <StatusPill key={k} label={k} tone="warning" />
              ))}
            </div>
          </div>
        </div>
        <ul className="mt-5 space-y-1 text-xs leading-relaxed text-muted-foreground">
          {scan.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
