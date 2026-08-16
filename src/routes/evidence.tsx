import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/careeros/app-shell";
import { Panel, StatusPill, evidenceTone } from "@/components/careeros/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCareerOs } from "@/lib/careeros/store";
import type { EvidenceStatus } from "@/lib/careeros/types";

const STATUSES: EvidenceStatus[] = ["Verified", "Needs Evidence", "Archived", "Excluded"];

export const Route = createFileRoute("/evidence")({
  head: () => ({
    meta: [
      { title: "Evidence Bank — CareerOS" },
      {
        name: "description",
        content: "Verified, unverified and excluded career evidence with lifecycle status.",
      },
      { property: "og:title", content: "Evidence Bank — CareerOS" },
      {
        property: "og:description",
        content: "Only Verified evidence can be used in generated documents.",
      },
    ],
  }),
  component: EvidencePage,
});

function EvidencePage() {
  const { data, update, logActivity } = useCareerOs();
  const [filter, setFilter] = useState<"All" | EvidenceStatus>("All");
  const rows = data.evidence.filter((e) => filter === "All" || e.status === filter);

  function setStatus(id: string, status: EvidenceStatus) {
    update((d) => {
      const rec = d.evidence.find((e) => e.id === id);
      if (rec) {
        rec.status = status;
        rec.updatedAt = new Date().toISOString();
      }
      return d;
    });
    logActivity(`Evidence ${id} status changed to ${status} (approved by you).`);
    toast.success(`Status updated to ${status}.`);
  }

  return (
    <AppShell
      title="Evidence Bank"
      subtitle="Only Verified records may be asserted in CVs and cover letters"
      actions={
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-40" aria-label="Filter evidence by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="space-y-3">
        <Panel>
          <p className="text-sm text-muted-foreground">
            CareerOS never invents achievements, metrics, qualifications, dates or technologies.
            Records marked <span className="text-foreground">Needs Evidence</span> appear as review
            items and gaps but are blocked from generated documents. Archived and Excluded records
            are never used.
          </p>
        </Panel>

        {rows.map((e) => (
          <Panel key={e.id}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <p className="text-sm font-medium">{e.claim}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {e.employer} · {e.category} · confidence {e.confidence} · ref {e.id}
                </p>
                {e.metricValue ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Metric: {e.metricValue}
                    {e.metricBasis ? ` — basis: ${e.metricBasis}` : ""}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">Source: {e.source}</p>
                {e.notes ? <p className="mt-1 text-xs text-warning">{e.notes}</p> : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusPill label={`Status: ${e.status}`} tone={evidenceTone(e.status)} />
                  {e.skills.map((s) => (
                    <StatusPill key={s} label={s} />
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUSES.filter((s) => s !== e.status).map((s) => (
                  <Button key={s} size="sm" variant="secondary" onClick={() => setStatus(e.id, s)}>
                    Mark {s}
                  </Button>
                ))}
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}
