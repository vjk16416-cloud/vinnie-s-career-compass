import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/careeros/app-shell";
import { Panel, StatusPill } from "@/components/careeros/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  filterJobBoardListings,
  jobBoardFilterOptions,
  latestAnalysisForListing,
  listingToJobRecord,
  normaliseJobBoardListing,
} from "@/lib/careeros/job-board";
import { runScan } from "@/lib/careeros/scoring";
import { uid, useCareerOs } from "@/lib/careeros/store";
import type { JobBoardFilters, JobBoardListing } from "@/lib/careeros/types";

export const Route = createFileRoute("/job-board")({
  head: () => ({
    meta: [
      { title: "Job Board | CareerOS" },
      {
        name: "description",
        content:
          "Store structured job listings, analyse them against verified career evidence and create CareerOS applications.",
      },
    ],
  }),
  component: JobBoardPage,
});

const selectClassName =
  "mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function workingArrangement(value: string | undefined) {
  if (value === "Hybrid" || value === "Remote" || value === "On-site") return value;
  return "Unspecified" as const;
}

function normalisedEmploymentType(value: string | undefined) {
  if (value === "Contract") return "Contract" as const;
  if (value === "Fixed-term") return "Fixed-term" as const;
  if (value?.toLowerCase().includes("permanent")) return "Permanent" as const;
  return "Unspecified" as const;
}

function JobBoardPage() {
  const { data, update, logActivity } = useCareerOs();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [salary, setSalary] = useState("");
  const [workplaceType, setWorkplaceType] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<{ id: string; message: string } | null>(null);

  const [filters, setFilters] = useState<JobBoardFilters>({ query: "", savedOnly: false });

  const listings = data.jobBoardListings ?? [];
  const filterOptions = useMemo(() => jobBoardFilterOptions(listings), [listings]);
  const visibleListings = useMemo(
    () => filterJobBoardListings(listings, filters),
    [listings, filters],
  );

  function resetForm() {
    setTitle("");
    setCompany("");
    setLocation("");
    setDescription("");
    setSourceName("");
    setSourceUrl("");
    setApplyUrl("");
    setSalary("");
    setWorkplaceType("");
    setEmploymentType("");
    setClosingDate("");
  }

  function addListing() {
    setFormError(null);
    if (!title.trim() || !company.trim() || !description.trim()) {
      setFormError("Add a role title, company and job description.");
      return;
    }

    const listing = normaliseJobBoardListing({
      id: uid("board"),
      title,
      company,
      location,
      description,
      sourceKind: "manual",
      sourceName,
      sourceUrl,
      applyUrl,
      salary,
      workplaceType,
      employmentType,
      closingDate,
      importedAt: new Date().toISOString(),
      saved: false,
    });

    update((draft) => {
      draft.jobBoardListings = [listing, ...(draft.jobBoardListings ?? [])];
      return draft;
    });
    logActivity(`Added ${listing.title} at ${listing.company} to Job Board.`);
    resetForm();
    toast.success("Job added to Job Board.");
  }

  function toggleSaved(listingId: string) {
    update((draft) => {
      draft.jobBoardListings = (draft.jobBoardListings ?? []).map((listing) =>
        listing.id === listingId ? { ...listing, saved: !listing.saved } : listing,
      );
      return draft;
    });
  }

  function analyseRole(listing: JobBoardListing) {
    setAnalysisError(null);
    if (countWords(listing.description) < 40) {
      setAnalysisError({
        id: listing.id,
        message: "Add at least 40 words before analysing this role.",
      });
      return;
    }

    try {
      const job = listingToJobRecord(listing, uid("job"));
      const scan = runScan(job, data);
      update((draft) => {
        draft.jobs = [job, ...(draft.jobs ?? [])];
        draft.scans = [scan, ...(draft.scans ?? [])];
        return draft;
      });
      logActivity(
        `Analysed Job Board role ${job.title} at ${job.company}: ${scan.overall}% compatibility.`,
      );
      toast.success(`Analysis complete: ${scan.overall}% compatibility.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setAnalysisError({ id: listing.id, message: `The role could not be analysed: ${message}` });
    }
  }

  function createApplication(listing: JobBoardListing) {
    const analysis = latestAnalysisForListing(listing.id, data.jobs, data.scans);
    if (!analysis) {
      setAnalysisError({ id: listing.id, message: "Analyse this role before creating an application." });
      return;
    }

    const id = uid("app");
    const now = new Date().toISOString();
    update((draft) => {
      draft.applications = [
        {
          id,
          jobId: analysis.job.id,
          company: listing.company,
          title: listing.title,
          location: analysis.job.location,
          workingArrangement: workingArrangement(listing.workplaceType),
          employmentType: normalisedEmploymentType(listing.employmentType),
          priority: analysis.scan.overall >= 70 ? "High" : "Medium",
          stage: "Preparing",
          dateAdded: now,
          deadline: listing.closingDate || undefined,
          salary: listing.salary || undefined,
          source: listing.sourceName || undefined,
          url: listing.applyUrl ?? listing.sourceUrl ?? analysis.job.url,
          notes: "",
          compatibilityScore: analysis.scan.overall,
          nextAction: "Review the Evidence Map and tailor CV",
          history: [
            {
              at: now,
              entry: `Created from Job Board scan (${analysis.scan.overall}% fit).`,
            },
          ],
        },
        ...draft.applications,
      ];
      return draft;
    });
    logActivity(`Application created for ${listing.title} at ${listing.company} from Job Board.`);
    void navigate({ to: "/applications/$id", params: { id } });
  }

  return (
    <AppShell
      title="Job Board"
      subtitle="Store structured roles, analyse them without scraping, then move the strongest fits into Applications."
    >
      <div className="space-y-5">
        <Panel
          title="Add a structured job"
          description="Paste the full description once. Source and application links stay attached to the listing."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="job-board-title">Role title</Label>
              <Input
                id="job-board-title"
                className="mt-1.5"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="job-board-company">Company</Label>
              <Input
                id="job-board-company"
                className="mt-1.5"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="job-board-location">Location</Label>
              <Input
                id="job-board-location"
                className="mt-1.5"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="job-board-source-name">Source name</Label>
              <Input
                id="job-board-source-name"
                className="mt-1.5"
                placeholder="Company careers site"
                value={sourceName}
                onChange={(event) => setSourceName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="job-board-source-url">Original source URL</Label>
              <Input
                id="job-board-source-url"
                className="mt-1.5"
                inputMode="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="job-board-apply-url">Application URL</Label>
              <Input
                id="job-board-apply-url"
                className="mt-1.5"
                inputMode="url"
                value={applyUrl}
                onChange={(event) => setApplyUrl(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="job-board-salary">Salary</Label>
              <Input
                id="job-board-salary"
                className="mt-1.5"
                value={salary}
                onChange={(event) => setSalary(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="job-board-workplace">Working arrangement</Label>
              <select
                id="job-board-workplace"
                className={selectClassName}
                value={workplaceType}
                onChange={(event) => setWorkplaceType(event.target.value)}
              >
                <option value="">Unspecified</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Remote">Remote</option>
                <option value="On-site">On-site</option>
              </select>
            </div>
            <div>
              <Label htmlFor="job-board-employment">Employment type</Label>
              <select
                id="job-board-employment"
                className={selectClassName}
                value={employmentType}
                onChange={(event) => setEmploymentType(event.target.value)}
              >
                <option value="">Unspecified</option>
                <option value="Permanent">Permanent</option>
                <option value="Contract">Contract</option>
                <option value="Fixed-term">Fixed-term</option>
              </select>
            </div>
            <div>
              <Label htmlFor="job-board-closing">Closing date</Label>
              <Input
                id="job-board-closing"
                className="mt-1.5"
                type="date"
                value={closingDate}
                onChange={(event) => setClosingDate(event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="job-board-description">Job description</Label>
              <Textarea
                id="job-board-description"
                className="mt-1.5 min-h-48 text-sm"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Paste the full job description here."
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {countWords(description)} words. Analysis needs at least 40 words.
              </p>
            </div>
          </div>

          {formError ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <div className="mt-4">
            <Button type="button" onClick={addListing}>
              Add to Job Board
            </Button>
          </div>
        </Panel>

        <Panel
          title="Find roles"
          description="Search all saved Job Board listings and narrow the view without changing the underlying data."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <Label htmlFor="job-board-search">Search jobs</Label>
              <Input
                id="job-board-search"
                className="mt-1.5"
                value={filters.query}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, query: event.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="job-board-workplace-filter">Working arrangement</Label>
              <select
                id="job-board-workplace-filter"
                className={selectClassName}
                value={filters.workplaceType ?? ""}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    workplaceType: event.target.value || undefined,
                  }))
                }
              >
                <option value="">All</option>
                {filterOptions.workplaceTypes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="job-board-employment-filter">Employment type</Label>
              <select
                id="job-board-employment-filter"
                className={selectClassName}
                value={filters.employmentType ?? ""}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    employmentType: event.target.value || undefined,
                  }))
                }
              >
                <option value="">All</option>
                {filterOptions.employmentTypes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex min-h-10 w-full items-center gap-2 rounded-md border border-border px-3 text-sm">
                <input
                  type="checkbox"
                  checked={filters.savedOnly}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, savedOnly: event.target.checked }))
                  }
                />
                <span>Saved jobs only</span>
              </label>
            </div>
          </div>
        </Panel>

        <section aria-label="Job Board listings" className="space-y-3">
          {visibleListings.length ? (
            visibleListings.map((listing) => {
              const analysis = latestAnalysisForListing(listing.id, data.jobs, data.scans);
              return (
                <article
                  key={listing.id}
                  className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="break-words text-base font-semibold">{listing.title}</h2>
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {[listing.company, listing.location, listing.workplaceType]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusPill
                          label={`Source: ${listing.sourceName || "Added manually"}`}
                          tone="info"
                        />
                        {listing.employmentType ? (
                          <StatusPill label={listing.employmentType} tone="neutral" />
                        ) : null}
                        {listing.saved ? <StatusPill label="Saved" tone="success" /> : null}
                      </div>
                    </div>
                    {analysis ? (
                      <div className="shrink-0 rounded-md border border-border px-3 py-2 text-left sm:text-right">
                        <p className="text-lg font-semibold">{analysis.scan.overall}% compatibility</p>
                        <p className="text-xs text-muted-foreground">{analysis.scan.verdict}</p>
                      </div>
                    ) : null}
                  </div>

                  <p className="mt-3 line-clamp-4 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                    {listing.description}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {listing.salary ? <span>Salary: {listing.salary}</span> : null}
                    {listing.closingDate ? <span>Closing: {listing.closingDate}</span> : null}
                    <span>{countWords(listing.description)} description words</span>
                  </div>

                  {analysisError?.id === listing.id ? (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                      {analysisError.message}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => toggleSaved(listing.id)}>
                      {listing.saved ? "Unsave job" : "Save job"}
                    </Button>
                    <Button type="button" onClick={() => analyseRole(listing)}>
                      Analyse role
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!analysis}
                      onClick={() => createApplication(listing)}
                    >
                      Create application
                    </Button>
                    {listing.sourceUrl ? (
                      <a
                        href={listing.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-accent"
                      >
                        Open original
                      </a>
                    ) : null}
                    {listing.applyUrl ? (
                      <a
                        href={listing.applyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-accent"
                      >
                        Apply at source
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {listings.length
                ? "No jobs match the current filters."
                : "No structured jobs yet. Add your first role above."}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
