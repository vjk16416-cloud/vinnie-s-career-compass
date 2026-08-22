import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/careeros/app-shell";
import { EmptyState, Panel, StatusPill } from "@/components/careeros/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { discoverJobs } from "@/lib/careeros/job-board.functions";
import {
  filterDiscoveredJobs,
  rankDiscoveredJobs,
  readJobSearchPreferences,
  withJobSearchPreferences,
  type DiscoveredJob,
  type JobSearchPreferences,
} from "@/lib/careeros/job-discovery";
import { storeDiscoveredJobForAnalysis } from "@/lib/careeros/job-handoff";
import { useCareerOs } from "@/lib/careeros/store";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Job Board | CareerOS" },
      {
        name: "description",
        content: "Live UK and remote vacancies ranked around your CareerOS search preferences.",
      },
    ],
  }),
  component: JobBoardPage,
});

const ROLE_FAMILIES = [
  "Product",
  "Project / Delivery",
  "Technology / Innovation",
  "Product Marketing",
  "Digital / MarTech",
] as const;

function ageLabel(postedAt: string): string {
  const time = Date.parse(postedAt);
  if (!Number.isFinite(time)) return "Date not supplied";
  const days = Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
  if (days === 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  return `Posted ${days} days ago`;
}

function providerTone(provider: DiscoveredJob["provider"]) {
  return provider === "remotive" ? ("info" as const) : ("neutral" as const);
}

function JobBoardPage() {
  const { data, update } = useCareerOs();
  const [preferences, setPreferences] = useState<JobSearchPreferences>(() =>
    readJobSearchPreferences(data),
  );
  const [jobs, setJobs] = useState<DiscoveredJob[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [broader, setBroader] = useState(false);

  async function loadJobs() {
    setLoading(true);
    setError(null);
    try {
      const result = await discoverJobs({
        data: { includeVisaSponsorship: preferences.includeVisaSponsorship },
      });
      setJobs(result.jobs);
      setWarnings(result.warnings);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Live job sources are temporarily unavailable. Try again shortly.";
      setError(message);
      setJobs([]);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
    // Initial discovery should run once for the user's stored preferences.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleJobs = useMemo(() => {
    const effective = broader ? { ...preferences, keywords: [], roleFamilies: [] } : preferences;
    const filtered = filterDiscoveredJobs(jobs, effective);
    return rankDiscoveredJobs(filtered, effective, data).slice(0, 60);
  }, [broader, data, jobs, preferences]);

  function updatePreference<K extends keyof JobSearchPreferences>(
    key: K,
    value: JobSearchPreferences[K],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function toggleRoleFamily(role: string) {
    const selected = preferences.roleFamilies.includes(role);
    updatePreference(
      "roleFamilies",
      selected
        ? preferences.roleFamilies.filter((value) => value !== role)
        : [...preferences.roleFamilies, role],
    );
  }

  function savePreferences() {
    update((draft) => withJobSearchPreferences(draft, preferences));
    toast.success("Job search preferences saved to CareerOS.");
  }

  function analyse(job: DiscoveredJob) {
    if (job.description.trim().split(/\s+/).length < 40) {
      toast.error(
        "This source did not provide enough job-description text. Open it and use Job Scan.",
      );
      return;
    }
    const key = storeDiscoveredJobForAnalysis(job);
    window.location.assign(`/job-scan?discovered=${encodeURIComponent(key)}`);
  }

  return (
    <AppShell
      title="Job Board"
      subtitle="Live UK and remote opportunities ranked for discovery, before evidence-backed analysis"
      actions={
        <Button variant="secondary" size="sm" onClick={() => void loadJobs()} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      <div className="space-y-4">
        <Panel
          title="Job search preferences"
          description="CareerOS uses these only to find and rank opportunities. Formal compatibility is calculated later in Job Scan."
          actions={
            <Button size="sm" onClick={savePreferences}>
              Save preferences
            </Button>
          }
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-foreground">Target role families</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ROLE_FAMILIES.map((role) => {
                  const active = preferences.roleFamilies.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleRoleFamily(role)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <div>
                <Label htmlFor="job-board-keywords">Keywords</Label>
                <Input
                  id="job-board-keywords"
                  className="mt-1.5"
                  value={preferences.keywords.join(", ")}
                  onChange={(event) =>
                    updatePreference(
                      "keywords",
                      event.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="product, project delivery, innovation"
                />
              </div>
              <div>
                <Label htmlFor="job-board-age">Posted within</Label>
                <select
                  id="job-board-age"
                  className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={preferences.maxAgeDays}
                  onChange={(event) => updatePreference("maxAgeDays", Number(event.target.value))}
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-md border border-border p-3">
                <input
                  type="checkbox"
                  checked={preferences.includeRemote}
                  onChange={(event) => updatePreference("includeRemote", event.target.checked)}
                />
                Include genuine remote roles
              </label>
              <label className="flex items-center gap-2 rounded-md border border-border p-3">
                <input
                  type="checkbox"
                  checked={preferences.includeVisaSponsorship}
                  onChange={(event) =>
                    updatePreference("includeVisaSponsorship", event.target.checked)
                  }
                />
                Include visa-sponsored roles
              </label>
              <label className="flex items-center gap-2 rounded-md border border-border p-3">
                <input
                  type="checkbox"
                  checked={preferences.includeRelocation}
                  onChange={(event) => updatePreference("includeRelocation", event.target.checked)}
                />
                Include relocation opportunities
              </label>
            </div>
          </div>
        </Panel>

        {warnings.length ? (
          <div
            role="status"
            className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-muted-foreground"
          >
            {warnings.join(" ")} Results from available sources are still shown.
          </div>
        ) : null}

        {error ? (
          <Panel title="Live jobs unavailable">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button className="mt-3" variant="secondary" onClick={() => void loadJobs()}>
              Retry
            </Button>
          </Panel>
        ) : loading ? (
          <Panel title="Finding live jobs" description="Checking UK and global remote sources now.">
            <div className="space-y-2" aria-label="Loading jobs">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          </Panel>
        ) : visibleJobs.length === 0 ? (
          <Panel title="No close matches found">
            <EmptyState
              title="No live vacancies match these filters."
              hint="Broaden the discovery filter without changing your saved preferences, or refresh the live sources."
            />
            {!broader ? (
              <Button className="mt-3" variant="secondary" onClick={() => setBroader(true)}>
                Show broader matches
              </Button>
            ) : null}
          </Panel>
        ) : (
          <Panel
            title={`${visibleJobs.length} live opportunities`}
            description="Discovery match helps prioritise the board. Analyse Role runs the full evidence-backed CareerOS score."
            actions={broader ? <StatusPill label="Broader discovery" tone="warning" /> : null}
          >
            <div className="space-y-3">
              {visibleJobs.map((job) => (
                <article key={job.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-foreground">{job.title}</h2>
                        <StatusPill label={`${job.discoveryScore}% discovery match`} tone="info" />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {job.company} · {job.location || "Location not supplied"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusPill
                          label={`Source: ${job.providerLabel}`}
                          tone={providerTone(job.provider)}
                        />
                        {job.remote ? <StatusPill label="Remote" tone="success" /> : null}
                        {job.visaSponsorship === true ? (
                          <StatusPill label="Visa sponsorship listed" tone="success" />
                        ) : null}
                        {job.employmentType ? <StatusPill label={job.employmentType} /> : null}
                        <StatusPill label={ageLabel(job.postedAt)} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" onClick={() => analyse(job)}>
                        Analyse role
                      </Button>
                      <Button asChild size="sm" variant="secondary">
                        <a href={job.sourceUrl} target="_blank" rel="noreferrer">
                          Open source <ExternalLink aria-hidden="true" />
                        </a>
                      </Button>
                    </div>
                  </div>

                  {job.matchReasons.length ? (
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {job.matchReasons.map((reason) => (
                        <li key={reason}>• {reason}</li>
                      ))}
                    </ul>
                  ) : null}
                  {job.salary ? (
                    <p className="mt-2 text-xs text-muted-foreground">Salary: {job.salary}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </Panel>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Sources: Arbeitnow UK and Remotive. Remotive listings are attributed to Remotive and link
          back to their vacancy URL. CareerOS does not scrape LinkedIn or Indeed and does not invent
          sponsorship status.
        </p>
      </div>
    </AppShell>
  );
}
