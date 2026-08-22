import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/careeros/app-shell";
import {
  EMPTY_JOB_DISCOVERY_FILTERS,
  JobBoardFilters,
} from "@/components/careeros/job-board-filters";
import { JobSearchPreferencesPanel } from "@/components/careeros/job-search-preferences-panel";
import { Button } from "@/components/ui/button";
import { filterAndSortJobs } from "@/lib/careeros/job-discovery.domain";
import {
  getJobBoard,
  refreshJobs,
  saveJobSearchPreferences,
  setJobSaved,
} from "@/lib/careeros/job-discovery.functions";
import { selectDailyShortlist } from "@/lib/careeros/job-discovery.orchestrator";
import type {
  DiscoveredJob,
  JobDiscoveryFilters,
  JobDiscoverySort,
  JobSearchPreferences,
} from "@/lib/careeros/job-discovery.types";
import { buildExternalSearchLinks } from "@/lib/careeros/job-search-destinations";
import { runScan } from "@/lib/careeros/scoring";
import { uid, useCareerOs } from "@/lib/careeros/store";
import type { JobRecord } from "@/lib/careeros/types";

export const Route = createFileRoute("/job-board")({
  head: () => ({
    meta: [
      { title: "Job Board | CareerOS" },
      {
        name: "description",
        content: "Personalised job discovery, live vacancy status and CareerOS fit scoring.",
      },
    ],
  }),
  component: JobBoardPage,
});

type BoardData = Awaited<ReturnType<typeof getJobBoard>>;

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
}

function sameUtcDay(value: string, now: Date) {
  const date = new Date(value);
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}

function statusLabel(status: DiscoveredJob["status"]) {
  if (status === "closing_soon") return "Closing soon";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function fitTone(verdict: DiscoveredJob["fitVerdict"]) {
  if (verdict === "Strong Fit") return "border-success/40 bg-success/10 text-success";
  if (verdict === "Competitive") return "border-primary/40 bg-primary/10 text-primary";
  if (verdict === "Stretch") return "border-warning/40 bg-warning/10 text-warning-foreground";
  return "border-border bg-muted text-muted-foreground";
}

function statusTone(status: DiscoveredJob["status"]) {
  if (status === "active") return "border-success/40 bg-success/10 text-success";
  if (status === "closing_soon") return "border-warning/40 bg-warning/10 text-warning-foreground";
  if (status === "expired") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-border bg-muted text-muted-foreground";
}

function JobCard({
  job,
  onSave,
  onAnalyse,
}: {
  job: DiscoveredJob;
  onSave?: (job: DiscoveredJob) => void | Promise<void>;
  onAnalyse?: (job: DiscoveredJob) => void;
}) {
  const sourceNames = unique(job.sourceRefs.map((source) => source.provider));
  const applyUrl = job.preferredApplyUrl ?? job.preferredSourceUrl;

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{job.title}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-xs ${statusTone(job.status)}`}>
              {statusLabel(job.status)}
            </span>
            {job.fitVerdict ? (
              <span className={`rounded-full border px-2 py-0.5 text-xs ${fitTone(job.fitVerdict)}`}>
                {job.fitVerdict}
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-1 text-sm text-muted-foreground">
            <span>{job.company}</span>
            {job.location ? <span>· {job.location}</span> : null}
          </p>
        </div>
        {job.fitScore != null ? (
          <div className="shrink-0 text-right">
            <p className="text-xl font-semibold">{job.fitScore}%</p>
            <p className="text-xs text-muted-foreground">CareerOS fit</p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full border border-border px-2 py-0.5">
          {job.matchType === "exact" ? "Exact title" : job.matchType === "adjacent" ? "Adjacent role" : "Plausible match"}
        </span>
        {job.workplaceType ? (
          <span className="rounded-full border border-border px-2 py-0.5">{job.workplaceType}</span>
        ) : null}
        {job.employmentType ? (
          <span className="rounded-full border border-border px-2 py-0.5">{job.employmentType}</span>
        ) : null}
        {job.salaryText ? (
          <span className="rounded-full border border-border px-2 py-0.5">{job.salaryText}</span>
        ) : (
          <span className="rounded-full border border-border px-2 py-0.5">Salary undisclosed</span>
        )}
        {sourceNames.map((source) => (
          <span key={source} className="rounded-full border border-border px-2 py-0.5">
            {source}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{job.statusReason}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {onSave ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => void onSave(job)}>
            {job.saved ? "Unsave" : "Save"}
          </Button>
        ) : null}
        {onAnalyse ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => onAnalyse(job)}>
            Analyse role
          </Button>
        ) : null}
        {applyUrl ? (
          <Button asChild size="sm">
            <a href={applyUrl} target="_blank" rel="noreferrer">
              Apply at source
            </a>
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function SummaryList({ jobs, empty }: { jobs: DiscoveredJob[]; empty: string }) {
  if (!jobs.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm">
      {jobs.slice(0, 10).map((job) => (
        <li key={job.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
          <span className="truncate">{job.company}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {job.fitScore != null ? `${job.fitScore}%` : job.matchType === "exact" ? "Exact" : "Adjacent"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function JobBoardContent({
  preferences,
  jobs,
  now = new Date(),
  lastRefreshedAt,
  onRefresh,
  onPreferencesSave,
  onSave,
  onAnalyse,
  refreshing = false,
  savingPreferences = false,
}: {
  preferences: JobSearchPreferences;
  jobs: DiscoveredJob[];
  now?: Date;
  lastRefreshedAt: string | null;
  onRefresh?: () => void | Promise<void>;
  onPreferencesSave?: (preferences: JobSearchPreferences) => void | Promise<void>;
  onSave?: (job: DiscoveredJob) => void | Promise<void>;
  onAnalyse?: (job: DiscoveredJob) => void;
  refreshing?: boolean;
  savingPreferences?: boolean;
}) {
  const [filters, setFilters] = useState<JobDiscoveryFilters>(EMPTY_JOB_DISCOVERY_FILTERS);
  const [sort, setSort] = useState<JobDiscoverySort>("best_fit");
  const external = buildExternalSearchLinks(preferences);

  const active = jobs.filter((job) => job.status !== "expired");
  const archived = jobs.filter((job) => job.status === "expired");
  const newToday = active.filter((job) => sameUtcDay(job.firstSeenAt, now));
  const shortlist = selectDailyShortlist(active, now, 10);
  const filtered = filterAndSortJobs(active, filters, sort, now);

  const sources = unique(jobs.flatMap((job) => job.sourceRefs.map((source) => source.provider)));
  const industries = unique(jobs.map((job) => job.industry));
  const seniority = unique(jobs.map((job) => job.seniority));
  const locations = unique(jobs.map((job) => job.location));

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">Search the major job boards</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These open personalised searches on the job board itself. CareerOS does not scrape protected sites.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {external.map((destination) => (
              <Button key={destination.id} asChild size="sm" variant="secondary">
                <a href={destination.url} target="_blank" rel="noreferrer">
                  {destination.label}
                </a>
              </Button>
            ))}
          </div>
        </div>
      </section>

      <JobSearchPreferencesPanel
        preferences={preferences}
        onSave={onPreferencesSave}
        saving={savingPreferences}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-semibold">New today</h2>
          <p className="mt-1 mb-3 text-xs text-muted-foreground">{newToday.length} fresh role{newToday.length === 1 ? "" : "s"}</p>
          <SummaryList jobs={newToday} empty="No new active roles have arrived today yet." />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-semibold">Daily shortlist</h2>
          <p className="mt-1 mb-3 text-xs text-muted-foreground">Best fresh active matches first</p>
          <SummaryList jobs={shortlist} empty="No fresh shortlist is available yet." />
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {lastRefreshedAt ? `Last refreshed ${new Date(lastRefreshedAt).toLocaleString("en-GB")}` : "Automatic feeds have not refreshed yet."}
        </p>
        <Button type="button" onClick={() => void onRefresh?.()} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh jobs"}
        </Button>
      </div>

      <JobBoardFilters
        filters={filters}
        sort={sort}
        onFiltersChange={setFilters}
        onSortChange={setSort}
        sources={sources}
        industries={industries}
        seniority={seniority}
        locations={locations}
      />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">All active jobs</h2>
            <p className="text-xs text-muted-foreground">{filtered.length} matching current filters</p>
          </div>
        </div>
        {filtered.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} onSave={onSave} onAnalyse={onAnalyse} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            No active jobs match the current filters.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Archived / expired</h2>
          <p className="text-xs text-muted-foreground">Closed roles stay here with their source history.</p>
        </div>
        {archived.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {archived.map((job) => (
              <JobCard key={job.id} job={job} onSave={onSave} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No archived roles yet.</p>
        )}
      </section>
    </div>
  );
}

function preferencePayload(preferences: JobSearchPreferences) {
  return {
    exactTitles: preferences.exactTitles,
    adjacentTitles: preferences.adjacentTitles,
    seniority: preferences.seniority,
    industries: preferences.industries,
    locations: preferences.locations,
    salaryMin: preferences.salaryMin,
    salaryCurrency: preferences.salaryCurrency,
    workplaceTypes: preferences.workplaceTypes,
    employmentTypes: preferences.employmentTypes,
    includeUk: preferences.includeUk,
    includeGlobalUkHireable: preferences.includeGlobalUkHireable,
    includeRelocationSponsorship: preferences.includeRelocationSponsorship,
    emailAlertsEnabled: preferences.emailAlertsEnabled,
    derivedFromProfileAt: preferences.derivedFromProfileAt,
    manualOverrides: preferences.manualOverrides,
  };
}

function JobBoardPage() {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const { data, update, logActivity } = useCareerOs();

  async function loadBoard() {
    const next = await getJobBoard();
    setBoard(next);
    return next;
  }

  useEffect(() => {
    let live = true;
    void getJobBoard()
      .then((next) => {
        if (live) setBoard(next);
      })
      .catch(() => {
        if (live) toast.error("Job Board could not be loaded.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const title = useMemo(() => board?.preferences.exactTitles[0] ?? "your target roles", [board]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await refreshJobs();
      if (!result.ok) {
        toast.warning(result.reason);
      } else {
        toast.success("Job discovery refreshed.");
      }
      await loadBoard();
    } catch {
      toast.error("Job discovery refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handlePreferenceSave(next: JobSearchPreferences) {
    setSavingPreferences(true);
    try {
      const saved = await saveJobSearchPreferences({ data: preferencePayload(next) });
      setBoard((current) => (current ? { ...current, preferences: saved } : current));
      toast.success("Job Search Preferences saved.");
    } catch {
      toast.error("Job Search Preferences could not be saved.");
    } finally {
      setSavingPreferences(false);
    }
  }

  async function handleSave(job: DiscoveredJob) {
    const saved = !job.saved;
    try {
      await setJobSaved({ data: { jobId: job.id, saved } });
      setBoard((current) =>
        current
          ? { ...current, jobs: current.jobs.map((item) => (item.id === job.id ? { ...item, saved } : item)) }
          : current,
      );
      toast.success(saved ? "Job saved." : "Job removed from saved jobs.");
    } catch {
      toast.error("CareerOS could not update the saved state.");
    }
  }

  function handleAnalyse(job: DiscoveredJob) {
    if (!job.description || job.descriptionWordCount < 40) {
      toast.warning("This listing does not contain enough reliable description text. Open the source or capture the full job description first.");
      return;
    }
    const record: JobRecord = {
      id: uid("job"),
      company: job.company,
      title: job.title,
      location: job.location ?? "Unspecified",
      url: job.preferredApplyUrl ?? job.preferredSourceUrl ?? undefined,
      description: job.description,
      createdAt: new Date().toISOString(),
      sourceType: "url",
      descriptionWordCount: job.descriptionWordCount,
    };
    const scan = runScan(record, data);
    update((draft) => {
      draft.jobs = [record, ...(draft.jobs ?? [])];
      draft.scans = [scan, ...(draft.scans ?? [])];
      return draft;
    });
    logActivity(`Analysed discovered role ${record.title} at ${record.company}: ${scan.overall}% fit.`);
    toast.success(`Role analysed: ${scan.overall}% compatibility.`);
  }

  return (
    <AppShell
      title="Job Board"
      subtitle={board ? `Personalised discovery for ${title}` : "Personalised job discovery"}
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your Job Board…</p>
      ) : board ? (
        <JobBoardContent
          preferences={board.preferences}
          jobs={board.jobs}
          lastRefreshedAt={board.lastRefreshedAt}
          onRefresh={handleRefresh}
          onPreferencesSave={handlePreferenceSave}
          onSave={handleSave}
          onAnalyse={handleAnalyse}
          refreshing={refreshing}
          savingPreferences={savingPreferences}
        />
      ) : (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          The Job Board is temporarily unavailable. Your existing CareerOS data is unchanged.
        </p>
      )}
    </AppShell>
  );
}