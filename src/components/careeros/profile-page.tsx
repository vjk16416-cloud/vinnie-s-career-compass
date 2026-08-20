import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/careeros/app-shell";
import { Panel, StatusPill } from "@/components/careeros/ui-bits";
import { Button } from "@/components/ui/button";
import type { EmploymentRole, KnowledgeItem, KnowledgeStatus } from "@/lib/careeros/knowledge/types";
import { listEmploymentRoles } from "@/lib/careeros/repositories/employment-repository";
import { listKnowledgeItems } from "@/lib/careeros/repositories/knowledge-repository";
import { getProfile } from "@/lib/careeros/repositories/profile-repository";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

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

const HIDDEN_STATUSES = new Set<KnowledgeStatus>(["archived", "excluded"]);

function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(date);
}

function formatRolePeriod(role: EmploymentRole) {
  const start = formatDate(role.start_date) ?? "Start date not recorded";
  const end = role.is_current ? "Present" : (formatDate(role.end_date) ?? "End date not recorded");
  return `${start} – ${end}`;
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<EmploymentRole[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRow, employmentRows, knowledgeRows] = await Promise.all([
        getProfile(),
        listEmploymentRoles(),
        listKnowledgeItems(),
      ]);
      setProfile(profileRow as Profile | null);
      setRoles(employmentRows as EmploymentRole[]);
      setKnowledge(knowledgeRows as KnowledgeItem[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your Career Profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reusableKnowledge = useMemo(
    () => knowledge.filter((item) => !HIDDEN_STATUSES.has(item.status as KnowledgeStatus)),
    [knowledge],
  );

  const knowledgeByRole = useMemo(() => {
    const grouped = new Map<string, KnowledgeItem[]>();
    for (const item of reusableKnowledge) {
      if (!item.employment_role_id) continue;
      const current = grouped.get(item.employment_role_id) ?? [];
      current.push(item);
      grouped.set(item.employment_role_id, current);
    }
    return grouped;
  }, [reusableKnowledge]);

  const generalKnowledge = useMemo(
    () => reusableKnowledge.filter((item) => !item.employment_role_id),
    [reusableKnowledge],
  );

  const displayName = profile?.display_name || "Career Profile";
  const location = profile?.location || "Location not recorded";

  return (
    <AppShell title="Career Profile" subtitle={`${displayName} · ${location}`}>
      <div className="space-y-4">
        {loading ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Loading your canonical career profile…</p>
          </Panel>
        ) : error ? (
          <Panel>
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          </Panel>
        ) : (
          <>
            <Panel title="Summary" description="The approved profile record used across CareerOS">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {profile?.professional_summary || "No professional summary has been recorded yet."}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                CareerOS does not silently convert imported CV claims into verified evidence. Provenance and verification status remain attached to each reusable record.
              </p>
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Target roles">
                <div className="flex flex-wrap gap-1.5">
                  {(profile?.target_roles ?? []).length > 0 ? (
                    profile?.target_roles.map((role) => <StatusPill key={role} label={role} />)
                  ) : (
                    <p className="text-sm text-muted-foreground">No target roles recorded.</p>
                  )}
                </div>
              </Panel>
              <Panel title="Target industries">
                <div className="flex flex-wrap gap-1.5">
                  {(profile?.target_industries ?? []).length > 0 ? (
                    profile?.target_industries.map((industry) => <StatusPill key={industry} label={industry} />)
                  ) : (
                    <p className="text-sm text-muted-foreground">No target industries recorded.</p>
                  )}
                </div>
              </Panel>
            </div>

            <Panel title="Employment" description="Roles linked to reusable Knowledge Bank evidence">
              {roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No employment roles have been recorded yet.</p>
              ) : (
                <ol className="space-y-5">
                  {roles.map((role) => {
                    const items = knowledgeByRole.get(role.id) ?? [];
                    return (
                      <li key={role.id} className="border-l-2 border-border pl-3">
                        <p className="text-sm font-semibold">
                          {role.title} — {role.employer}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[role.employment_type, formatRolePeriod(role)].filter(Boolean).join(" · ")}
                        </p>
                        {role.summary ? (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{role.summary}</p>
                        ) : null}

                        {items.length > 0 ? (
                          <div className="mt-3 space-y-3">
                            {items.map((item) => (
                              <article key={item.id} className="rounded-md border border-border/70 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm font-medium">{item.title}</h3>
                                  <StatusPill label={STATUS_LABELS[item.status as KnowledgeStatus]} />
                                </div>
                                <p className="mt-1.5 text-sm text-muted-foreground">{item.content}</p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {sourceLabel(item.source_type)}
                                  {item.source_reference ? ` · ${item.source_reference}` : ""}
                                </p>
                                {item.star_context || item.star_action || item.star_result ? (
                                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-3">
                                    <p><span className="font-medium text-foreground">Context:</span> {item.star_context || "Not recorded"}</p>
                                    <p><span className="font-medium text-foreground">Action:</span> {item.star_action || "Not recorded"}</p>
                                    <p><span className="font-medium text-foreground">Result:</span> {item.star_result || "Not recorded"}</p>
                                  </div>
                                ) : null}
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">No reusable evidence is linked to this role yet.</p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Panel>

            {generalKnowledge.length > 0 ? (
              <Panel title="General career knowledge" description="Reusable evidence not tied to one employer">
                <div className="space-y-3">
                  {generalKnowledge.map((item) => (
                    <article key={item.id} className="rounded-md border border-border/70 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-medium">{item.title}</h3>
                        <StatusPill label={STATUS_LABELS[item.status as KnowledgeStatus]} />
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">{item.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {sourceLabel(item.source_type)}
                        {item.source_reference ? ` · ${item.source_reference}` : ""}
                      </p>
                    </article>
                  ))}
                </div>
              </Panel>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
