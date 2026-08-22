import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/careeros/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractJobFromUrl } from "@/lib/careeros/job-extract.functions";
import { runScan } from "@/lib/careeros/scoring";
import { uid, useCareerOs } from "@/lib/careeros/store";
import type { JobRecord } from "@/lib/careeros/types";

export const Route = createFileRoute("/job-capture")({
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === "string" && /^https:\/\//i.test(search.url) ? search.url : "",
  }),
  head: () => ({ meta: [{ title: "Save to CareerOS | CareerOS" }] }),
  component: JobCapturePage,
});

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

type CaptureDraft = {
  url: string;
  title: string;
  company: string;
  location: string;
  description: string;
};

type CaptureExtraction =
  | { ok: true; title: string; company: string; location: string; text: string }
  | { ok: false; reason: string };

export function JobCaptureContent({
  initialUrl = "",
  initialDescription = "",
  fallback: initialFallback = null,
  onExtract,
  onAnalyse,
}: {
  initialUrl?: string;
  initialDescription?: string;
  fallback?: string | null;
  onExtract?: (url: string) => Promise<CaptureExtraction>;
  onAnalyse?: (draft: CaptureDraft) => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState(initialDescription);
  const [fallback, setFallback] = useState<string | null>(initialFallback);
  const [extracting, setExtracting] = useState(false);
  const wordCount = countWords(description);
  const ready = wordCount >= 40;

  async function handleExtract() {
    if (!/^https:\/\//i.test(url.trim())) {
      setFallback("Use a full HTTPS job URL, or paste the job description below.");
      return;
    }
    if (!onExtract) return;
    setExtracting(true);
    setFallback(null);
    try {
      const result = await onExtract(url.trim());
      if (!result.ok) {
        setFallback(result.reason);
        return;
      }
      setTitle(result.title);
      setCompany(result.company);
      setLocation(result.location);
      setDescription(result.text);
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-semibold">Save a job you are viewing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          CareerOS only reads the page you explicitly send here. It does not crawl or bypass protected job sites.
        </p>
        <div className="mt-4">
          <Label htmlFor="capture-url">Job URL</Label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <Input
              id="capture-url"
              aria-label="Job URL"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
            />
            <Button type="button" variant="secondary" disabled={extracting} onClick={() => void handleExtract()}>
              {extracting ? "Extracting…" : "Extract job details"}
            </Button>
          </div>
        </div>
      </section>

      {fallback ? (
        <section className="rounded-lg border border-warning/40 bg-warning/10 p-4" role="status">
          <h2 className="text-sm font-semibold">Paste the job description instead</h2>
          <p className="mt-1 text-sm text-muted-foreground">{fallback}</p>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Role title</span>
            <Input className="mt-1.5" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Company</span>
            <Input className="mt-1.5" value={company} onChange={(event) => setCompany(event.target.value)} />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="font-medium">Location</span>
            <Input className="mt-1.5" value={location} onChange={(event) => setLocation(event.target.value)} />
          </label>
        </div>

        <div className="mt-4">
          <Label htmlFor="capture-description">Job description</Label>
          <Textarea
            id="capture-description"
            aria-label="Job description"
            className="mt-1.5 min-h-64"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Paste the full job description here if extraction is blocked."
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {wordCount} words. {ready ? "Ready for explicit analysis." : "Add at least 40 words before analysis."}
          </p>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            disabled={!ready}
            onClick={() =>
              onAnalyse?.({
                url: url.trim(),
                title: title.trim(),
                company: company.trim(),
                location: location.trim(),
                description: description.trim(),
              })
            }
          >
            Analyse role
          </Button>
        </div>
      </section>
    </div>
  );
}

function JobCapturePage() {
  const search = Route.useSearch();
  const { data, update, logActivity } = useCareerOs();
  const [bookmarklet, setBookmarklet] = useState("");

  useEffect(() => {
    const target = `${window.location.origin}/job-capture?url=`;
    setBookmarklet(
      `javascript:(()=>{location.href='${target}'+encodeURIComponent(location.href)})()`,
    );
  }, []);

  const bookmarkletLabel = useMemo(
    () => (bookmarklet ? "Save to CareerOS bookmarklet" : "Save to CareerOS"),
    [bookmarklet],
  );

  async function extract(url: string): Promise<CaptureExtraction> {
    try {
      const result = await extractJobFromUrl({ data: { url } });
      if (!result.ok) return { ok: false, reason: result.reason };
      return {
        ok: true,
        title: result.title,
        company: result.company,
        location: result.location,
        text: result.text,
      };
    } catch {
      return { ok: false, reason: "CareerOS could not read that page automatically." };
    }
  }

  function analyse(draft: CaptureDraft) {
    const record: JobRecord = {
      id: uid("job"),
      company: draft.company || "Unspecified company",
      title: draft.title || "Unspecified role",
      location: draft.location || "Unspecified",
      url: draft.url || undefined,
      description: draft.description,
      createdAt: new Date().toISOString(),
      sourceType: draft.url ? "url" : "paste",
      descriptionWordCount: countWords(draft.description),
    };
    const scan = runScan(record, data);
    update((current) => {
      current.jobs = [record, ...(current.jobs ?? [])];
      current.scans = [scan, ...(current.scans ?? [])];
      return current;
    });
    logActivity(`Analysed captured role ${record.title} at ${record.company}: ${scan.overall}% fit.`);
    toast.success(`Role analysed: ${scan.overall}% compatibility.`);
  }

  async function copyBookmarklet() {
    if (!bookmarklet) return;
    try {
      await navigator.clipboard.writeText(bookmarklet);
      toast.success("Save to CareerOS bookmarklet copied.");
    } catch {
      toast.error("Copy was blocked by the browser. Select and copy the bookmarklet text manually.");
    }
  }

  return (
    <AppShell title="Save to CareerOS" subtitle="Capture a job page you are actively viewing">
      <div className="space-y-5">
        <JobCaptureContent initialUrl={search.url} onExtract={extract} onAnalyse={analyse} />

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-semibold">One-click capture from your browser</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Save this bookmarklet to your bookmarks bar. When you are viewing a job, click it to open that exact URL in CareerOS.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input readOnly aria-label={bookmarkletLabel} value={bookmarklet} />
            <Button type="button" variant="secondary" disabled={!bookmarklet} onClick={() => void copyBookmarklet()}>
              Copy Save to CareerOS
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
