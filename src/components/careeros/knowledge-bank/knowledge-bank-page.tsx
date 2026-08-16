import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/careeros/app-shell";
import { Panel, StatusPill } from "@/components/careeros/ui-bits";
import { Button } from "@/components/ui/button";
import type { EmploymentRole, KnowledgeItem, KnowledgeItemDraft, KnowledgeStatus } from "@/lib/careeros/knowledge/types";
import { listEmploymentRoles } from "@/lib/careeros/repositories/employment-repository";
import {
  archiveKnowledgeItem,
  createKnowledgeItem,
  deleteKnowledgeItem,
  listKnowledgeItems,
  updateKnowledgeItem,
} from "@/lib/careeros/repositories/knowledge-repository";
import { KnowledgeItemForm } from "./knowledge-item-form";

const STATUS_LABELS: Record<KnowledgeStatus, string> = {
  verified: "Verified evidence",
  user_confirmed: "User confirmed",
  imported_cv: "Imported from CV",
  imported_linkedin: "Imported from LinkedIn",
  needs_verification: "Needs verification",
  archived: "Archived",
  excluded: "Excluded",
};

const SOURCE_LABELS: Record<string, string> = {
  user_input: "User input",
  cv: "CV",
  linkedin: "LinkedIn",
  certificate: "Certificate",
  performance_review: "Performance review",
  project: "Project record",
  other: "Other",
};

function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source.replaceAll("_", " ");
}

export function KnowledgeBankPage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [roles, setRoles] = useState<EmploymentRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<KnowledgeItem | "new" | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [knowledgeRows, employmentRows] = await Promise.all([
        listKnowledgeItems(),
        listEmploymentRoles(),
      ]);
      setItems(knowledgeRows as KnowledgeItem[]);
      setRoles(employmentRows as EmploymentRole[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your Knowledge Bank.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roleNames = useMemo(
    () => new Map(roles.map((role) => [role.id, `${role.title}, ${role.employer}`])),
    [roles],
  );

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category))].sort(),
    [items],
  );
  const statuses = useMemo(
    () => [...new Set(items.map((item) => item.status))].sort(),
    [items],
  );
  const sources = useMemo(
    () => [...new Set(items.map((item) => item.source_type))].sort(),
    [items],
  );

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          (roleFilter === "all" || item.employment_role_id === roleFilter) &&
          (categoryFilter === "all" || item.category === categoryFilter) &&
          (statusFilter === "all" || item.status === statusFilter) &&
          (sourceFilter === "all" || item.source_type === sourceFilter),
      ),
    [items, roleFilter, categoryFilter, statusFilter, sourceFilter],
  );

  async function saveKnowledge(draft: KnowledgeItemDraft) {
    setSaving(true);
    try {
      if (editing && editing !== "new") {
        await updateKnowledgeItem(editing.id, draft);
        toast.success("Knowledge Bank item updated.");
      } else {
        await createKnowledgeItem(draft);
        toast.success("Information added to your Knowledge Bank.");
      }
      setEditing(null);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save this information.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveItem(item: KnowledgeItem) {
    try {
      await archiveKnowledgeItem(item.id);
      toast.success("Knowledge Bank item archived.");
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not archive this information.");
    }
  }

  async function removeItem(item: KnowledgeItem) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Permanently remove “${item.title}” from your Knowledge Bank?`)
    ) {
      return;
    }
    try {
      await deleteKnowledgeItem(item.id);
      toast.success("Knowledge Bank item removed.");
      if (editing !== "new" && editing?.id === item.id) setEditing(null);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not remove this information.");
    }
  }

  return (
    <AppShell
      title="Knowledge Bank"
      subtitle="Your reusable career facts, achievements and evidence, kept private to your account"
      actions={
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Add information
        </Button>
      }
    >
      <div className="space-y-4">
        <Panel>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This is the career knowledge CareerOS can draw from when tailoring a resume. You can add,
            correct, archive or remove information at any time. Provenance labels show where information
            came from and how strongly it is supported. Resume changes never update this bank silently.
          </p>
        </Panel>

        {editing ? (
          <KnowledgeItemForm
            key={editing === "new" ? "new" : editing.id}
            roles={roles}
            initialValue={editing === "new" ? null : editing}
            submitting={saving}
            onSubmit={saveKnowledge}
            onCancel={() => setEditing(null)}
          />
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select
            aria-label="Filter by role"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="all">All roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.title}, {role.employer}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by category"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status as KnowledgeStatus]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by source"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
          >
            <option value="all">All sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {sourceLabel(source)}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading your Knowledge Bank…</p>
          </Panel>
        ) : error ? (
          <Panel>
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          </Panel>
        ) : filteredItems.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted-foreground">
              No information matches these filters. Add career information or change the filters above.
            </p>
          </Panel>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <Panel key={item.id}>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">{item.title}</h2>
                      <StatusPill label={STATUS_LABELS[item.status]} />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.content}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.employment_role_id
                        ? roleNames.get(item.employment_role_id) ?? "Employment role"
                        : "General career knowledge"}
                      {` · ${item.category} · ${sourceLabel(item.source_type)}`}
                      {item.source_reference ? ` · ${item.source_reference}` : ""}
                    </p>
                    {item.star_action || item.star_result || item.star_context ? (
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                        <div>
                          <span className="font-medium text-foreground">Context:</span>{" "}
                          {item.star_context || "Not recorded"}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Action:</span>{" "}
                          {item.star_action || "Not recorded"}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Result:</span>{" "}
                          {item.star_result || "Needs strengthening"}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(item)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </Button>
                    {item.status !== "archived" ? (
                      <Button size="sm" variant="secondary" onClick={() => void archiveItem(item)}>
                        <Archive className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        Archive
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => void removeItem(item)}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Remove
                    </Button>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
