import { Button } from "@/components/ui/button";
import { Panel, StatusPill } from "./ui-bits";
import { unresolvedVariantKeys, variantsByCanonicalKey } from "@/lib/careeros/profile-extraction";
import { profileDecisions } from "@/lib/careeros/profile-review";
import { useCareerOs } from "@/lib/careeros/store";

export function EvidenceReviewPanel() {
  const { data, setProfileItemStatus, resolveProfileVariant } = useCareerOs();
  const profileItems = data.profileItems ?? [];
  const claimVariants = data.profileClaimVariants ?? [];
  const attentionItems = profileItems.filter((item) => item.status !== "Approved");
  const variantGroups = variantsByCanonicalKey(claimVariants);
  const unresolvedKeys = unresolvedVariantKeys(claimVariants);
  const decisions = profileDecisions(data);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Review profile items">
          <div className="flex flex-wrap gap-1.5">
            <StatusPill
              label={`${profileItems.filter((item) => item.status === "Approved").length} approved`}
            />
            <StatusPill label={`${attentionItems.length} need review`} />
          </div>

          {attentionItems.length > 0 ? (
            <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
              {attentionItems.map((item) => (
                <li key={item.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{item.label}</span>
                    <StatusPill label={item.status} />
                    <StatusPill label={`${item.confidence} confidence`} />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed">{item.safeWording ?? item.value}</p>
                  {item.notes ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {item.notes}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sources: {item.sourceIds.join(", ") || "No source recorded"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.status !== "Approved" ? (
                      <Button size="sm" onClick={() => setProfileItemStatus(item.id, "Approved")}>
                        Approve
                      </Button>
                    ) : null}
                    {item.status !== "Needs Evidence" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setProfileItemStatus(item.id, "Needs Evidence")}
                      >
                        Needs evidence
                      </Button>
                    ) : null}
                    {item.status !== "Excluded" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setProfileItemStatus(item.id, "Excluded")}
                      >
                        Exclude
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No profile items need review.</p>
          )}
        </Panel>

        <Panel title="Resolve conflicting variants">
          {unresolvedKeys.length > 0 ? (
            <ul className="space-y-3 text-sm text-muted-foreground">
              {unresolvedKeys.map((key) => (
                <li key={key} className="rounded-md border border-border p-3">
                  <p className="font-medium text-foreground">{key}</p>
                  <ul className="mt-2 space-y-2">
                    {(variantGroups.get(key) ?? []).map((variant) => (
                      <li key={variant.id} className="rounded border border-border/70 p-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill label={variant.status} />
                          <StatusPill label={`${variant.confidence} confidence`} />
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-foreground">
                          {variant.value}
                        </p>
                        <p className="mt-1 text-xs">Sources: {variant.sourceIds.join(", ")}</p>
                        {variant.notes ? (
                          <p className="mt-1 text-xs leading-relaxed">{variant.notes}</p>
                        ) : null}
                        {variant.status !== "Excluded" ? (
                          <Button
                            className="mt-2"
                            size="sm"
                            variant="outline"
                            onClick={() => resolveProfileVariant(key, variant.id, variant.value)}
                          >
                            Resolve with this wording
                          </Button>
                        ) : (
                          <p className="mt-2 text-xs">Excluded wording stays blocked.</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No unresolved claim variants.</p>
          )}
        </Panel>
      </div>

      <Panel title="Decision history">
        {decisions.length > 0 ? (
          <ol className="space-y-2 text-sm text-muted-foreground">
            {decisions.slice(0, 20).map((decision) => (
              <li key={decision.id} className="rounded-md border border-border p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{decision.action}</span>
                  <StatusPill label={decision.newStatus} />
                  <span className="text-xs">{new Date(decision.at).toLocaleString("en-GB")}</span>
                </div>
                <p className="mt-1 text-xs">
                  {decision.canonicalKey ?? decision.profileItemId ?? "Profile decision"}
                </p>
                <p className="mt-1 text-xs">Sources: {decision.sourceIds.join(", ")}</p>
                {decision.note ? <p className="mt-1 text-xs">{decision.note}</p> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            No manual evidence decisions have been recorded yet.
          </p>
        )}
      </Panel>
    </div>
  );
}
