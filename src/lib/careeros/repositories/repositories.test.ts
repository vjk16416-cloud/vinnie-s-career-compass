import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProfileRepository } from "./profile-repository";
import { createEmploymentRepository } from "./employment-repository";
import { createKnowledgeRepository } from "./knowledge-repository";
import { createEvidenceRepository } from "./evidence-repository";

function createQuery(result: unknown = []) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "insert", "update", "delete", "eq", "order"]) {
    query[method] = vi.fn(() => query);
  }
  query.single = vi.fn(async () => ({ data: result, error: null }));
  query.maybeSingle = vi.fn(async () => ({ data: result, error: null }));
  query.then = vi.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: result, error: null }).then(resolve),
  );
  return query;
}

function createClient(userId = "user-a") {
  let activeUserId = userId;
  const queries: Record<string, ReturnType<typeof createQuery>> = {};
  const from = vi.fn((table: string) => {
    queries[table] ??= createQuery([]);
    return queries[table];
  });
  const getUser = vi.fn(async () => ({
    data: { user: activeUserId ? { id: activeUserId } : null },
    error: null,
  }));

  return {
    client: { auth: { getUser }, from },
    queries,
    from,
    getUser,
    setUser(next: string) {
      activeUserId = next;
    },
  };
}

const knowledgeDraft = {
  category: "achievement",
  title: "Improved campaign performance",
  content: "Optimised paid media based on performance data.",
  starContext: "Campaign performance needed improvement.",
  starAction: "Reworked targeting and creative testing.",
  starResult: "Improved qualified lead volume.",
  metrics: { qualifiedLeadIncrease: 18 },
  status: "user_confirmed" as const,
  sourceType: "user_input",
};

describe("CareerOS repositories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists Knowledge Bank items only for the authenticated user", async () => {
    const harness = createClient("user-a");
    const repository = createKnowledgeRepository(harness.client as never);

    await repository.listKnowledgeItems();

    expect(harness.from).toHaveBeenCalledWith("knowledge_items");
    expect(harness.queries.knowledge_items.eq).toHaveBeenCalledWith("user_id", "user-a");
  });

  it("never accepts a caller-supplied user_id when creating Knowledge Bank data", async () => {
    const harness = createClient("user-a");
    const repository = createKnowledgeRepository(harness.client as never);

    await repository.createKnowledgeItem({
      ...knowledgeDraft,
      user_id: "user-b",
    } as never);

    const payload = harness.queries.knowledge_items.insert.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      user_id: "user-a",
      category: "achievement",
      title: "Improved campaign performance",
      status: "user_confirmed",
    });
    expect(payload).not.toMatchObject({ user_id: "user-b" });
  });

  it("scopes Knowledge Bank updates and archive operations to the authenticated user", async () => {
    const harness = createClient("user-a");
    const repository = createKnowledgeRepository(harness.client as never);

    await repository.updateKnowledgeItem("knowledge-1", {
      title: "Updated title",
      user_id: "user-b",
    } as never);
    await repository.archiveKnowledgeItem("knowledge-1");

    expect(harness.queries.knowledge_items.update.mock.calls[0]?.[0]).toEqual({
      title: "Updated title",
    });
    expect(harness.queries.knowledge_items.eq).toHaveBeenCalledWith("id", "knowledge-1");
    expect(harness.queries.knowledge_items.eq).toHaveBeenCalledWith("user_id", "user-a");
    expect(harness.queries.knowledge_items.update).toHaveBeenCalledWith({ status: "archived" });
  });

  it("supports permanent removal but only inside the authenticated user's scope", async () => {
    const harness = createClient("user-a");
    const repository = createKnowledgeRepository(harness.client as never);

    await repository.deleteKnowledgeItem("knowledge-1");

    expect(harness.queries.knowledge_items.delete).toHaveBeenCalledTimes(1);
    expect(harness.queries.knowledge_items.eq).toHaveBeenCalledWith("id", "knowledge-1");
    expect(harness.queries.knowledge_items.eq).toHaveBeenCalledWith("user_id", "user-a");
  });

  it("assigns authenticated ownership to new employment and evidence records", async () => {
    const harness = createClient("user-a");
    const employment = createEmploymentRepository(harness.client as never);
    const evidence = createEvidenceRepository(harness.client as never);

    await employment.createEmploymentRole({
      employer: "Example Ltd",
      title: "Marketing Manager",
      isCurrent: true,
      user_id: "user-b",
    } as never);
    await evidence.createEvidenceItem({
      evidenceType: "certificate",
      notes: "Professional certification",
      user_id: "user-b",
    } as never);

    expect(harness.queries.employment_roles.insert.mock.calls[0]?.[0]).toMatchObject({
      user_id: "user-a",
      employer: "Example Ltd",
      title: "Marketing Manager",
    });
    expect(harness.queries.evidence_items.insert.mock.calls[0]?.[0]).toMatchObject({
      user_id: "user-a",
      evidence_type: "certificate",
    });
  });

  it("updates only approved profile fields for the authenticated user", async () => {
    const harness = createClient("user-a");
    const repository = createProfileRepository(harness.client as never);

    await repository.updateProfile({
      displayName: "Alex Taylor",
      professionalSummary: "Digital marketing leader",
      user_id: "user-b",
    } as never);

    expect(harness.queries.profiles.update.mock.calls[0]?.[0]).toEqual({
      display_name: "Alex Taylor",
      professional_summary: "Digital marketing leader",
    });
    expect(harness.queries.profiles.eq).toHaveBeenCalledWith("user_id", "user-a");
  });

  it("changes repository scope when a different authenticated user signs in", async () => {
    const harness = createClient("user-a");
    const repository = createKnowledgeRepository(harness.client as never);

    await repository.listKnowledgeItems();
    harness.setUser("user-b");
    await repository.listKnowledgeItems();

    expect(harness.queries.knowledge_items.eq).toHaveBeenCalledWith("user_id", "user-a");
    expect(harness.queries.knowledge_items.eq).toHaveBeenCalledWith("user_id", "user-b");
  });

  it("rejects repository access without an authenticated Supabase user", async () => {
    const harness = createClient("");
    const repository = createKnowledgeRepository(harness.client as never);

    await expect(repository.listKnowledgeItems()).rejects.toThrow(
      "CareerOS authentication is required.",
    );
    expect(harness.from).not.toHaveBeenCalled();
  });
});
