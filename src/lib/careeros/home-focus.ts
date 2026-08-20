import type { CareerOsData } from "./types";

export type HomeAttentionKind =
  | "next-action"
  | "deadline"
  | "cv-draft"
  | "letter-draft"
  | "evidence-gap"
  | "needs-evidence";

export interface HomeAttentionItem {
  id: string;
  kind: HomeAttentionKind;
  label: string;
  detail: string;
  applicationId?: string;
  href: "/applications/$id" | "/evidence";
}

const CLOSED_STAGES = new Set(["Rejected", "Withdrawn", "Accepted"]);

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function buildHomeAttention(data: CareerOsData, now = new Date()): HomeAttentionItem[] {
  const items: HomeAttentionItem[] = [];
  const today = isoDay(now);
  const active = data.applications.filter((app) => !CLOSED_STAGES.has(app.stage));

  for (const app of active) {
    if (!app.nextAction?.trim()) {
      items.push({
        id: `next-${app.id}`,
        kind: "next-action",
        label: "Set the next action",
        detail: `${app.title} · ${app.company}`,
        applicationId: app.id,
        href: "/applications/$id",
      });
    }

    const dueDate = app.nextActionDue ?? app.deadline;
    if (dueDate && dueDate <= today) {
      items.push({
        id: `due-${app.id}`,
        kind: "deadline",
        label: dueDate < today ? "Action overdue" : "Action due today",
        detail: `${app.title} · ${app.company} · ${dueDate}`,
        applicationId: app.id,
        href: "/applications/$id",
      });
    }

    const cv = data.cvs.find((candidate) => candidate.applicationId === app.id);
    if (cv?.status === "Draft") {
      items.push({
        id: `cv-${app.id}`,
        kind: "cv-draft",
        label: "CV waiting for approval",
        detail: `${app.title} · ${app.company}`,
        applicationId: app.id,
        href: "/applications/$id",
      });
    }

    const latestLetter = data.coverLetters.find((candidate) => candidate.applicationId === app.id);
    if (latestLetter?.status === "Draft") {
      items.push({
        id: `letter-${app.id}`,
        kind: "letter-draft",
        label: "Cover letter waiting for approval",
        detail: `${app.title} · ${app.company}`,
        applicationId: app.id,
        href: "/applications/$id",
      });
    }

    const scan = data.scans.find((candidate) => candidate.jobId === app.jobId);
    const problemCount = scan?.evidenceMap?.filter(
      (entry) => entry.status === "Gap" || entry.status === "Blocked",
    ).length;
    if (problemCount) {
      items.push({
        id: `gap-${app.id}`,
        kind: "evidence-gap",
        label: `${problemCount} evidence ${problemCount === 1 ? "gap" : "gaps"} to review`,
        detail: `${app.title} · ${app.company}`,
        applicationId: app.id,
        href: "/applications/$id",
      });
    }
  }

  const needsEvidence = data.evidence.filter((record) => record.status === "Needs Evidence").length;
  if (needsEvidence) {
    items.push({
      id: "needs-evidence",
      kind: "needs-evidence",
      label: `${needsEvidence} evidence ${needsEvidence === 1 ? "record needs" : "records need"} verification`,
      detail: "These records cannot be used in generated documents until verified.",
      href: "/evidence",
    });
  }

  return items;
}
