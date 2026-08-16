import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmploymentRole, KnowledgeItem, KnowledgeItemDraft, KnowledgeStatus } from "@/lib/careeros/knowledge/types";

const STATUSES: Array<{ value: KnowledgeStatus; label: string }> = [
  { value: "user_confirmed", label: "User confirmed" },
  { value: "needs_verification", label: "Needs verification" },
  { value: "verified", label: "Verified evidence" },
  { value: "imported_cv", label: "Imported from CV" },
  { value: "imported_linkedin", label: "Imported from LinkedIn" },
  { value: "excluded", label: "Excluded" },
  { value: "archived", label: "Archived" },
];

const SOURCE_TYPES = [
  ["user_input", "User input"],
  ["cv", "CV"],
  ["linkedin", "LinkedIn"],
  ["certificate", "Certificate"],
  ["performance_review", "Performance review"],
  ["project", "Project record"],
  ["other", "Other"],
] as const;

function draftFromItem(item?: KnowledgeItem | null): KnowledgeItemDraft {
  return {
    employmentRoleId: item?.employment_role_id ?? null,
    category: item?.category ?? "achievement",
    title: item?.title ?? "",
    content: item?.content ?? "",
    starContext: item?.star_context ?? "",
    starAction: item?.star_action ?? "",
    starResult: item?.star_result ?? "",
    metrics:
      item?.metrics && typeof item.metrics === "object" && !Array.isArray(item.metrics)
        ? (item.metrics as Record<string, string | number>)
        : {},
    status: item?.status ?? "user_confirmed",
    sourceType: item?.source_type ?? "user_input",
    sourceReference: item?.source_reference ?? "",
  };
}

export function KnowledgeItemForm({
  roles,
  initialValue,
  submitting = false,
  onSubmit,
  onCancel,
}: {
  roles: EmploymentRole[];
  initialValue?: KnowledgeItem | null;
  submitting?: boolean;
  onSubmit: (draft: KnowledgeItemDraft) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<KnowledgeItemDraft>(() => draftFromItem(initialValue));

  function set<K extends keyof KnowledgeItemDraft>(key: K, value: KnowledgeItemDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({
      ...draft,
      title: draft.title.trim(),
      content: draft.content.trim(),
      starContext: draft.starContext?.trim() || null,
      starAction: draft.starAction?.trim() || null,
      starResult: draft.starResult?.trim() || null,
      sourceReference: draft.sourceReference?.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-base font-semibold">{initialValue ? "Edit knowledge" : "Add knowledge"}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Add only information you can stand behind. CareerOS uses STAR or CAR thinking to strengthen job
          responsibilities, but it will not invent a result, metric or achievement. If the outcome is not
          known yet, leave it blank and mark the item as needing verification.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="knowledge-role">Employment role</Label>
          <select
            id="knowledge-role"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.employmentRoleId ?? ""}
            onChange={(event) => set("employmentRoleId", event.target.value || null)}
          >
            <option value="">Not tied to one role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.title}, {role.employer}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="knowledge-category">Category</Label>
          <Input
            id="knowledge-category"
            value={draft.category}
            onChange={(event) => set("category", event.target.value)}
            placeholder="achievement, responsibility, skill, project…"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="knowledge-title">Title</Label>
        <Input
          id="knowledge-title"
          value={draft.title}
          onChange={(event) => set("title", event.target.value)}
          placeholder="Short, reusable career fact"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="knowledge-content">Career information</Label>
        <textarea
          id="knowledge-content"
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={draft.content}
          onChange={(event) => set("content", event.target.value)}
          placeholder="Describe what you did, owned, delivered, learned or achieved."
          required
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="knowledge-context">Context or challenge</Label>
          <textarea
            id="knowledge-context"
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draft.starContext ?? ""}
            onChange={(event) => set("starContext", event.target.value)}
            placeholder="What needed to change?"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="knowledge-action">Action</Label>
          <textarea
            id="knowledge-action"
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draft.starAction ?? ""}
            onChange={(event) => set("starAction", event.target.value)}
            placeholder="What did you personally do?"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="knowledge-result">Result or outcome</Label>
          <textarea
            id="knowledge-result"
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draft.starResult ?? ""}
            onChange={(event) => set("starResult", event.target.value)}
            placeholder="What changed as a result? Leave blank if unknown."
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="knowledge-status">Evidence status</Label>
          <select
            id="knowledge-status"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.status}
            onChange={(event) => set("status", event.target.value as KnowledgeStatus)}
          >
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="knowledge-source">Source</Label>
          <select
            id="knowledge-source"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.sourceType}
            onChange={(event) => set("sourceType", event.target.value)}
          >
            {SOURCE_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="knowledge-reference">Source reference</Label>
          <Input
            id="knowledge-reference"
            value={draft.sourceReference ?? ""}
            onChange={(event) => set("sourceReference", event.target.value)}
            placeholder="CV, LinkedIn, certificate, project…"
          />
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : initialValue ? "Save changes" : "Add to Knowledge Bank"}
        </Button>
      </div>
    </form>
  );
}
