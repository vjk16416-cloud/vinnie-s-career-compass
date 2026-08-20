import type { Application, CareerOsData } from "./types";

export type AttentionSeverity = "urgent" | "attention";

export type AttentionLink =
  | { kind: "application"; applicationId: string }
  | { kind: "route"; to: "/cvs" | "/evidence" | "/job-scan" | "/applications" };

export interface AttentionItem {
  id: string;
  group: AttentionGroup;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  link: AttentionLink;
}

export type AttentionGroup =
  | "next-action"
  | "deadline"
  | "cv-draft"
  | "letter-draft"
  | "scan-evidence"
  | "evidence";

const CLOSED_STAGES = ["Rejected", "Withdrawn", "Accepted"];

export function activeApplications(data: CareerOsData): Application[] {
  return (data.applications ?? []).filter((a) => !CLOSED_STAGES.includes(a.stage));
}

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

/**
 * Computes the Home attention list purely from stored CareerOS state.
 * No dates, statuses or recommendations are invented: every item restates
 * an existing record field.
 */
export function computeHomeAttention(data: CareerOsData, today: string): AttentionItem[] {
  const items: AttentionItem[] = [];
  const active = activeApplications(data);
  const activeIds = new Set(active.map((a) => a.id));

  for (const app of active) {
    if (isBlank(app.nextAction)) {
      items.push({
        id: `next-action-${app.id}`,
        group: "next-action",
        severity: "attention",
        title: `No next action set for ${app.title}`,
        detail: `${app.company} · stage ${app.stage}`,
        link: { kind: "application", applicationId: app.id },
      });
    }

    if (app.deadline && app.deadline <= today) {
      items.push({
        id: `deadline-${app.id}`,
        group: "deadline",
        severity: "urgent",
        title:
          app.deadline === today
            ? `Deadline today for ${app.title}`
            : `Deadline passed for ${app.title}`,
        detail: `${app.company} · deadline ${app.deadline}`,
        link: { kind: "application", applicationId: app.id },
      });
    }
  }

  for (const cv of data.cvs ?? []) {
    if (cv.status !== "Draft") continue;
    if (!cv.applicationId || !activeIds.has(cv.applicationId)) continue;
    items.push({
      id: `cv-${cv.id}`,
      group: "cv-draft",
      severity: "attention",
      title: `CV still in draft: ${cv.name}`,
      detail: "Linked to an active application",
      link: { kind: "route", to: "/cvs" },
    });
  }

  for (const letter of data.coverLetters ?? []) {
    if (letter.status !== "Draft") continue;
    if (!letter.applicationId || !activeIds.has(letter.applicationId)) continue;
    const app = active.find((a) => a.id === letter.applicationId);
    items.push({
      id: `letter-${letter.id}`,
      group: "letter-draft",
      severity: "attention",
      title: `Cover letter still in draft${app ? ` for ${app.title}` : ""}`,
      detail: app ? app.company : "Linked to an active application",
      link: { kind: "application", applicationId: letter.applicationId },
    });
  }

  for (const scan of data.scans ?? []) {
    const flagged = (scan.evidenceMap ?? []).filter(
      (entry) => entry.status === "Blocked" || entry.status === "Gap",
    );
    if (flagged.length === 0) continue;
    const app = active.find((a) => a.jobId === scan.jobId);
    items.push({
      id: `scan-${scan.id}`,
      group: "scan-evidence",
      severity: "urgent",
      title: `${flagged.length} requirement${flagged.length === 1 ? "" : "s"} blocked or gapped`,
      detail: app ? `${app.title} · ${app.company}` : "Role scan needs evidence work",
      link: app
        ? { kind: "application", applicationId: app.id }
        : { kind: "route", to: "/job-scan" },
    });
  }

  for (const record of data.evidence ?? []) {
    if (record.status !== "Needs Evidence") continue;
    items.push({
      id: `evidence-${record.id}`,
      group: "evidence",
      severity: "attention",
      title: record.claim,
      detail: `${record.employer} · needs evidence`,
      link: { kind: "route", to: "/evidence" },
    });
  }

  return items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "urgent" ? -1 : 1;
    return 0;
  });
}

export function summariseAttention(items: AttentionItem[]): { urgent: number; total: number } {
  return { urgent: items.filter((i) => i.severity === "urgent").length, total: items.length };
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
