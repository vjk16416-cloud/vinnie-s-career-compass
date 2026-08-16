import { describe, expect, it, vi } from "vitest";
import type { KnowledgeItem } from "./types";
import {
  createKnowledgeUpdateService,
  detectKnowledgeChanges,
} from "./update-proposals";

function knowledge(content: string): KnowledgeItem {
  return {
    id: "knowledge-1",
    user_id: "user-a",
    employment_role_id: "role-a",
    category: "achievement",
    title: "Campaign optimisation",
    content,
    star_context: null,
    star_action: null,
    star_result: null,
    metrics: {},
    status: "user_confirmed",
    source_type: "user_input",
    source_reference: null,
    created_at: "2026-08-16T00:00:00.000Z",
    updated_at: "2026-08-16T00:00:00.000Z",
  };
}

function query(result: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "insert", "update", "eq"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(async () => ({ data: result, error: null }));
  chain.then = vi.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: result, error: null }).then(resolve),
  );
  return chain;
}

function createClient(proposal?: Record<string, unknown>) {
  const queries: Record<string, ReturnType<typeof query>> = {};
  const from = vi.fn((table: string) => {
    if (!queries[table]) {
      queries[table] = query(table === "knowledge_update_proposals" ? proposal ?? null : null);
    }
    return queries[table];
  });
  const getUser = vi.fn(async () => ({ data: { user: { id: "user-a" } }, error: null }));
  return { client: { auth: { getUser }, from }, from, queries };
}

describe("resume to Knowledge Bank update proposals", () => {
  it("does not propose a Knowledge Bank change for wording-only edits", () => {
    const original = "Led paid media campaigns and improved reporting for stakeholders.";
    const edited = "Led paid-media campaigns, improving stakeholder reporting.";

    expect(
      detectKnowledgeChanges(original, edited, [
        knowledge("Led paid media campaigns and improved reporting for stakeholders."),
      ]),
    ).toEqual([]);
  });

  it("proposes a newly introduced factual metric", () => {
    const proposals = detectKnowledgeChanges(
      "Led paid media campaigns and improved reporting for stakeholders.",
      "Led paid media campaigns and improved reporting for stakeholders. Increased qualified leads by 18%.",
      [],
    );

    expect(proposals).toEqual([
      expect.objectContaining({
        proposedChange: expect.objectContaining({
          content: expect.stringContaining("18%"),
          sourceType: "resume_review",
          status: "user_confirmed",
        }),
        reason: expect.stringMatching(/new factual/i),
        source: "resume_review",
        status: "pending",
      }),
    ]);
  });

  it("proposes a newly introduced tool, responsibility or project detail", () => {
    const cases = [
      "Built reporting dashboards in Looker Studio.",
      "Owned a £120,000 annual paid media budget.",
      "Delivered the CRM migration project across three business teams.",
    ];

    for (const sentence of cases) {
      const proposals = detectKnowledgeChanges("Managed digital marketing delivery.", `Managed digital marketing delivery. ${sentence}`, []);
      expect(proposals).toHaveLength(1);
      expect(proposals[0]?.proposedChange.content).toBe(sentence);
    }
  });

  it("creates a pending proposal without writing to knowledge_items", async () => {
    const harness = createClient();
    const service = createKnowledgeUpdateService(harness.client as never);

    await service.createPendingProposal({
      proposedChange: {
        category: "achievement",
        title: "Resume review update",
        content: "Increased qualified leads by 18%.",
        status: "user_confirmed",
        sourceType: "resume_review",
      },
      reason: "New factual information was added during resume review.",
      source: "resume_review",
      status: "pending",
    });

    expect(harness.from).toHaveBeenCalledWith("knowledge_update_proposals");
    expect(harness.from).not.toHaveBeenCalledWith("knowledge_items");
  });

  it("rejects a proposal without writing to knowledge_items", async () => {
    const harness = createClient({
      id: "proposal-1",
      user_id: "user-a",
      status: "pending",
      proposed_change: {},
    });
    const service = createKnowledgeUpdateService(harness.client as never);

    await service.rejectKnowledgeProposal("proposal-1");

    expect(harness.from).not.toHaveBeenCalledWith("knowledge_items");
    expect(harness.queries.knowledge_update_proposals.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected" }),
    );
  });

  it("writes to the Knowledge Bank only after explicit approval", async () => {
    const harness = createClient({
      id: "proposal-1",
      user_id: "user-a",
      knowledge_item_id: null,
      status: "pending",
      proposed_change: {
        category: "achievement",
        title: "Qualified lead improvement",
        content: "Increased qualified leads by 18%.",
        status: "user_confirmed",
        sourceType: "resume_review",
        sourceReference: "Resume review",
      },
    });
    const service = createKnowledgeUpdateService(harness.client as never);

    await service.approveKnowledgeProposal("proposal-1");

    expect(harness.from).toHaveBeenCalledWith("knowledge_items");
    expect(harness.queries.knowledge_items.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-a",
        content: "Increased qualified leads by 18%.",
        source_type: "resume_review",
        status: "user_confirmed",
      }),
    );
    expect(harness.queries.knowledge_update_proposals.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved" }),
    );
  });

  it("allows the user to edit a proposal before approving it", async () => {
    const harness = createClient({
      id: "proposal-1",
      user_id: "user-a",
      knowledge_item_id: null,
      status: "pending",
      proposed_change: {
        category: "achievement",
        title: "Initial wording",
        content: "Increased qualified leads by 18%.",
        status: "user_confirmed",
        sourceType: "resume_review",
      },
    });
    const service = createKnowledgeUpdateService(harness.client as never);

    await service.approveKnowledgeProposal("proposal-1", {
      category: "achievement",
      title: "Qualified lead growth",
      content: "Increased qualified leads by 18% after retargeting paid campaigns.",
      status: "user_confirmed",
      sourceType: "resume_review",
    });

    expect(harness.queries.knowledge_items.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Qualified lead growth",
        content: "Increased qualified leads by 18% after retargeting paid campaigns.",
      }),
    );
  });
});
