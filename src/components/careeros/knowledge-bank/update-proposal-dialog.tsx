import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeItemDraft } from "@/lib/careeros/knowledge/types";
import type { DetectedKnowledgeProposal } from "@/lib/careeros/knowledge/update-proposals";

export function UpdateProposalDialog({
  open,
  proposal,
  onOpenChange,
  onApprove,
  onReject,
  busy = false,
}: {
  open: boolean;
  proposal: DetectedKnowledgeProposal | null;
  onOpenChange: (open: boolean) => void;
  onApprove: (draft: KnowledgeItemDraft) => Promise<void> | void;
  onReject: () => Promise<void> | void;
  busy?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<KnowledgeItemDraft | null>(proposal?.proposedChange ?? null);

  useEffect(() => {
    setEditing(false);
    setDraft(proposal?.proposedChange ?? null);
  }, [proposal]);

  if (!proposal || !draft) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update your Knowledge Bank?</DialogTitle>
          <DialogDescription>
            You added career information that is not currently stored in your Knowledge Bank. Saving it
            will help CareerOS create more accurate future resumes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium text-foreground">Proposed update</p>
          {editing ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="proposal-title">Knowledge Bank title</Label>
                <Input
                  id="proposal-title"
                  value={draft.title}
                  onChange={(event) => setDraft((current) => current && { ...current, title: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proposal-content">Knowledge Bank information</Label>
                <Textarea
                  id="proposal-content"
                  className="min-h-24"
                  value={draft.content}
                  onChange={(event) => setDraft((current) => current && { ...current, content: event.target.value })}
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">{draft.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{draft.content}</p>
            </>
          )}
          <p className="text-xs text-muted-foreground">Why CareerOS is asking: {proposal.reason}</p>
        </div>

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void onReject()}>
            Don't save
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setEditing(true)}>
            Edit before saving
          </Button>
          <Button type="button" disabled={busy} onClick={() => void onApprove(draft)}>
            {busy ? "Updating…" : "Update Knowledge Bank"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
