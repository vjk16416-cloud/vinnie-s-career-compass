import type { KnowledgeItem } from "@/lib/careeros/knowledge/types";
import type { TailoredCvClaim } from "@/lib/careeros/resume/tailored-cv";
import { Button } from "@/components/ui/button";
import { Panel, StatusPill } from "@/components/careeros/ui-bits";

function statusLabel(status: KnowledgeItem["status"]) {
  return status.replaceAll("_", " ");
}

export function TailoredCvReview({
  claims,
  knowledgeItems,
  status,
  onApprove,
}: {
  claims: TailoredCvClaim[];
  knowledgeItems: KnowledgeItem[];
  status: "Draft" | "Approved";
  onApprove: () => void;
}) {
  const knowledgeById = new Map(knowledgeItems.map((item) => [item.id, item]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Tailored CV review</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Check what changed and the CareerOS evidence supporting each factual proposal before approval.
          </p>
        </div>
        {status === "Approved" ? (
          <StatusPill label="Approved" tone="success" />
        ) : (
          <Button type="button" size="sm" onClick={onApprove}>
            Approve tailored CV
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {claims.map((claim) => {
          const evidence = claim.evidenceIds
            .map((id) => knowledgeById.get(id))
            .filter((item): item is KnowledgeItem => Boolean(item));

          return (
            <Panel
              key={claim.id}
              title={claim.section === "experience" ? "Experience proposal" : `${claim.section[0]?.toUpperCase()}${claim.section.slice(1)} proposal`}
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {claim.original ?? "No direct original wording."}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposed</p>
                  <p className="mt-2 text-sm leading-relaxed">{claim.proposed}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</p>
                  <div className="mt-2 space-y-2">
                    {evidence.length ? (
                      evidence.map((item) => (
                        <div key={item.id} className="rounded-md border p-2.5">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="mt-1 text-xs capitalize text-muted-foreground">
                            {statusLabel(item.status)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No factual evidence reference is attached to this positioning-only change.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
