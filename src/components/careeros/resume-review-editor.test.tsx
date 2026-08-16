import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listKnowledgeItems: vi.fn(),
  detectKnowledgeChanges: vi.fn(),
  createPendingKnowledgeProposal: vi.fn(),
  approveKnowledgeProposal: vi.fn(),
  rejectKnowledgeProposal: vi.fn(),
}));

vi.mock("@/lib/careeros/repositories/knowledge-repository", () => ({
  listKnowledgeItems: mocks.listKnowledgeItems,
}));

vi.mock("@/lib/careeros/knowledge/update-proposals", () => ({
  detectKnowledgeChanges: mocks.detectKnowledgeChanges,
  createPendingKnowledgeProposal: mocks.createPendingKnowledgeProposal,
  approveKnowledgeProposal: mocks.approveKnowledgeProposal,
  rejectKnowledgeProposal: mocks.rejectKnowledgeProposal,
}));

import { ResumeReviewEditor } from "./resume-review-editor";

const factualProposal = {
  proposedChange: {
    category: "resume_update",
    title: "Qualified lead growth",
    content: "Increased qualified leads by 18%.",
    status: "user_confirmed" as const,
    sourceType: "resume_review",
    sourceReference: "Resume review",
  },
  reason: "New factual career information was added during resume review and is not currently stored in the Knowledge Bank.",
  source: "resume_review" as const,
  status: "pending" as const,
};

describe("resume review Knowledge Bank feedback loop", () => {
  beforeEach(() => {
    mocks.listKnowledgeItems.mockReset().mockResolvedValue([]);
    mocks.detectKnowledgeChanges.mockReset();
    mocks.createPendingKnowledgeProposal.mockReset().mockResolvedValue({ id: "proposal-1" });
    mocks.approveKnowledgeProposal.mockReset().mockResolvedValue(undefined);
    mocks.rejectKnowledgeProposal.mockReset().mockResolvedValue(undefined);
  });

  it("saves wording-only resume edits without creating a Knowledge Bank proposal", async () => {
    mocks.detectKnowledgeChanges.mockReturnValue([]);
    const onSaveVersion = vi.fn().mockResolvedValue(undefined);

    render(
      <ResumeReviewEditor
        originalBody="Led paid media campaigns."
        onSaveVersion={onSaveVersion}
      />,
    );

    fireEvent.change(screen.getByLabelText("Review CV content"), {
      target: { value: "Led paid-media campaign delivery." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reviewed version" }));

    await waitFor(() =>
      expect(onSaveVersion).toHaveBeenCalledWith("Led paid-media campaign delivery."),
    );
    expect(mocks.createPendingKnowledgeProposal).not.toHaveBeenCalled();
    expect(screen.queryByText(/not currently stored in your Knowledge Bank/i)).not.toBeInTheDocument();
  });

  it("creates a pending proposal for factual additions and asks before updating the Knowledge Bank", async () => {
    mocks.detectKnowledgeChanges.mockReturnValue([factualProposal]);
    const onSaveVersion = vi.fn().mockResolvedValue(undefined);

    render(
      <ResumeReviewEditor
        originalBody="Led paid media campaigns."
        onSaveVersion={onSaveVersion}
      />,
    );

    fireEvent.change(screen.getByLabelText("Review CV content"), {
      target: { value: "Led paid media campaigns. Increased qualified leads by 18%." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reviewed version" }));

    await screen.findByText(
      /You added career information that is not currently stored in your Knowledge Bank/i,
    );
    expect(onSaveVersion).toHaveBeenCalledTimes(1);
    expect(mocks.createPendingKnowledgeProposal).toHaveBeenCalledWith(factualProposal);
    expect(mocks.approveKnowledgeProposal).not.toHaveBeenCalled();
  });

  it("rejects the pending proposal when the user chooses Don't save", async () => {
    mocks.detectKnowledgeChanges.mockReturnValue([factualProposal]);

    render(
      <ResumeReviewEditor
        originalBody="Led paid media campaigns."
        onSaveVersion={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Review CV content"), {
      target: { value: "Led paid media campaigns. Increased qualified leads by 18%." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reviewed version" }));
    await screen.findByRole("button", { name: "Don't save" });
    fireEvent.click(screen.getByRole("button", { name: "Don't save" }));

    await waitFor(() => expect(mocks.rejectKnowledgeProposal).toHaveBeenCalledWith("proposal-1"));
    expect(mocks.approveKnowledgeProposal).not.toHaveBeenCalled();
  });

  it("writes the proposal only when the user chooses Update Knowledge Bank", async () => {
    mocks.detectKnowledgeChanges.mockReturnValue([factualProposal]);

    render(
      <ResumeReviewEditor
        originalBody="Led paid media campaigns."
        onSaveVersion={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Review CV content"), {
      target: { value: "Led paid media campaigns. Increased qualified leads by 18%." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reviewed version" }));
    await screen.findByRole("button", { name: "Update Knowledge Bank" });
    fireEvent.click(screen.getByRole("button", { name: "Update Knowledge Bank" }));

    await waitFor(() => expect(mocks.approveKnowledgeProposal).toHaveBeenCalledWith("proposal-1", factualProposal.proposedChange));
    expect(mocks.rejectKnowledgeProposal).not.toHaveBeenCalled();
  });

  it("allows editing the proposed Knowledge Bank entry before approval", async () => {
    mocks.detectKnowledgeChanges.mockReturnValue([factualProposal]);

    render(
      <ResumeReviewEditor
        originalBody="Led paid media campaigns."
        onSaveVersion={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Review CV content"), {
      target: { value: "Led paid media campaigns. Increased qualified leads by 18%." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reviewed version" }));
    await screen.findByRole("button", { name: "Edit before saving" });
    fireEvent.click(screen.getByRole("button", { name: "Edit before saving" }));
    fireEvent.change(screen.getByLabelText("Knowledge Bank information"), {
      target: { value: "Increased qualified leads by 18% after retargeting paid campaigns." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Knowledge Bank" }));

    await waitFor(() =>
      expect(mocks.approveKnowledgeProposal).toHaveBeenCalledWith(
        "proposal-1",
        expect.objectContaining({
          content: "Increased qualified leads by 18% after retargeting paid campaigns.",
        }),
      ),
    );
  });
});
