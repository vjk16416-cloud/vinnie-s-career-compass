import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import {
  requireAuthenticatedUserId,
  throwRepositoryError,
  type CareerOsSupabaseClient,
} from "./repository-utils";

const EVIDENCE_COLUMNS =
  "id,user_id,knowledge_item_id,evidence_type,source_reference,notes,verified_at,created_at";

export type EvidenceItemDraft = {
  knowledgeItemId?: string | null;
  evidenceType: string;
  sourceReference?: string | null;
  notes?: string | null;
  verifiedAt?: string | null;
};

export type EvidenceItemPatch = Partial<EvidenceItemDraft>;

function insertPayload(userId: string, draft: EvidenceItemDraft): TablesInsert<"evidence_items"> {
  return {
    user_id: userId,
    knowledge_item_id: draft.knowledgeItemId ?? null,
    evidence_type: draft.evidenceType,
    source_reference: draft.sourceReference ?? null,
    notes: draft.notes ?? null,
    verified_at: draft.verifiedAt ?? null,
  };
}

function updatePayload(patch: EvidenceItemPatch): TablesUpdate<"evidence_items"> {
  const payload: TablesUpdate<"evidence_items"> = {};
  if (patch.knowledgeItemId !== undefined) payload.knowledge_item_id = patch.knowledgeItemId;
  if (patch.evidenceType !== undefined) payload.evidence_type = patch.evidenceType;
  if (patch.sourceReference !== undefined) payload.source_reference = patch.sourceReference;
  if (patch.notes !== undefined) payload.notes = patch.notes;
  if (patch.verifiedAt !== undefined) payload.verified_at = patch.verifiedAt;
  return payload;
}

export function createEvidenceRepository(client: CareerOsSupabaseClient = supabase) {
  return {
    async listEvidenceItems() {
      const userId = await requireAuthenticatedUserId(client);
      const { data, error } = await client
        .from("evidence_items")
        .select(EVIDENCE_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      throwRepositoryError(error);
      return data ?? [];
    },

    async createEvidenceItem(draft: EvidenceItemDraft) {
      const userId = await requireAuthenticatedUserId(client);
      const { data, error } = await client
        .from("evidence_items")
        .insert(insertPayload(userId, draft))
        .select(EVIDENCE_COLUMNS)
        .single();
      throwRepositoryError(error);
      return data;
    },

    async updateEvidenceItem(id: string, patch: EvidenceItemPatch) {
      const userId = await requireAuthenticatedUserId(client);
      const { data, error } = await client
        .from("evidence_items")
        .update(updatePayload(patch))
        .eq("id", id)
        .eq("user_id", userId)
        .select(EVIDENCE_COLUMNS)
        .single();
      throwRepositoryError(error);
      return data;
    },

    async deleteEvidenceItem(id: string) {
      const userId = await requireAuthenticatedUserId(client);
      const { error } = await client
        .from("evidence_items")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      throwRepositoryError(error);
    },
  };
}

const evidenceRepository = createEvidenceRepository();
export const listEvidenceItems = evidenceRepository.listEvidenceItems;
export const createEvidenceItem = evidenceRepository.createEvidenceItem;
export const updateEvidenceItem = evidenceRepository.updateEvidenceItem;
export const deleteEvidenceItem = evidenceRepository.deleteEvidenceItem;
