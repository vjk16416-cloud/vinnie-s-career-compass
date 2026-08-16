import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UpdateProposalDialog } from "@/components/careeros/knowledge-bank/update-proposal-dialog";
import { listKnowledgeItems } from "@/lib/careeros/repositories/knowledge-repository";
import {
  approveKnowledgeProposal,
  createPendingKnowledgeProposal,
  detectKnowledgeChanges,
  rejectKnowledgeProposal,
  type DetectedKnowledgeProposal,
} from "@/lib/careeros/knowledge/update-proposals";
import type { KnowledgeItemDraft } from "@/lib/careeros/knowledge/types";

interface PendingReviewProposal {
  id: string;
  proposal: DetectedKnowledgeProposal;
}

export function ResumeReviewEditor({
  originalBody,
  onSaveVersion,
}: {
  originalBody: string;
  onSaveVersion: (body: string) => Promise<void> | void;
}) {
  const [body, setBody] = useState(originalBody);
  const [saving, setSaving] = useState(false);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [pendingProposals, setPendingProposals] = useState<PendingReviewProposal[]>([]);

  useEffect(() => {
    setBody(originalBody);
  }, [originalBody]);

  const currentProposal = pendingProposals[0] ?? null;

  async function saveReviewedVersion() {
    if (saving || body === originalBody) return;
    setSaving(true);
    try {
      const currentKnowledge = await listKnowledgeItems();
      const detected = detectKnowledgeChanges(originalBody, body, currentKnowledge);

      await onSaveVersion(body);

      const queued: PendingReviewProposal[] = [];
      for (const proposal of detected) {
        const row = await createPendingKnowledgeProposal(proposal);
        if (row?.id) queued.push({ id: row.id, proposal });
      }
      setPendingProposals(queued);

      toast.success(
        queued.length
          ? "Reviewed CV version saved. CareerOS found new career information for you to review."
          : "Reviewed CV version saved.",
      );
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the reviewed CV version.");
    } finally {
      setSaving(false);
    }
  }

  function advanceProposal() {
    setPendingProposals((current) => current.slice(1));
  }

  async function approveProposal(draft: KnowledgeItemDraft) {
    if (!currentProposal || proposalBusy) return;
    setProposalBusy(true);
    try {
      await approveKnowledgeProposal(currentProposal.id, draft);
      advanceProposal();
      toast.success("Knowledge Bank updated with your approval.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not update the Knowledge Bank.");
    } finally {
      setProposalBusy(false);
    }
  }

  async function rejectProposal() {
    if (!currentProposal || proposalBusy) return;
    setProposalBusy(true);
    try {
      await rejectKnowledgeProposal(currentProposal.id);
      advanceProposal();
      toast.success("The resume change was kept, but it was not saved to your Knowledge Bank.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not dismiss the Knowledge Bank proposal.");
    } finally {
      setProposalBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Review and refine this CV version</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          You can change the wording here. If you add a new factual achievement, metric, tool, project or
          responsibility, CareerOS may ask whether you want to add that information to your Knowledge Bank.
          Nothing is added to the Knowledge Bank without your approval.
        </p>
      </div>

      <Textarea
        aria-label="Review CV content"
        className="min-h-[28rem] font-serif text-sm leading-relaxed"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Resume edits and Knowledge Bank updates are saved separately.
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => void saveReviewedVersion()}
          disabled={saving || body === originalBody}
        >
          {saving ? "Saving…" : "Save reviewed version"}
        </Button>
      </div>

      <UpdateProposalDialog
        open={Boolean(currentProposal)}
        proposal={currentProposal?.proposal ?? null}
        busy={proposalBusy}
        onOpenChange={(open) => {
          if (!open) setPendingProposals([]);
        }}
        onApprove={approveProposal}
        onReject={rejectProposal}
      />
    </div>
  );
}
