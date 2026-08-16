import type { Json, TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { KnowledgeItemDraft, KnowledgeItemPatch } from "../knowledge/types";
import {
  requireAuthenticatedUserId,
  throwRepositoryError,
  type CareerOsSupabaseClient,
} from "./repository-utils";

const KNOWLEDGE_COLUMNS =
  "id,user_id,employment_role_id,category,title,content,star_context,star_action,star_result,metrics,status,source_type,source_reference,created_at,updated_at";

function insertPayload(userId: string, draft: KnowledgeItemDraft) {
  return {
    user_id: userId,
    employment_role_id: draft.employmentRoleId ?? null,
    category: draft.category,
    title: draft.title,
    content: draft.content,
    star_context: draft.starContext ?? null,
    star_action: draft.starAction ?? null,
    star_result: draft.starResult ?? null,
    metrics: (draft.metrics ?? {}) as Json,
    status: draft.status,
    source_type: draft.sourceType,
    source_reference: draft.sourceReference ?? null,
  };
}

function updatePayload(patch: KnowledgeItemPatch): TablesUpdate<"knowledge_items"> {
  const payload: TablesUpdate<"knowledge_items"> = {};
  if (patch.employmentRoleId !== undefined) payload.employment_role_id = patch.employmentRoleId;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.content !== undefined) payload.content = patch.content;
  if (patch.starContext !== undefined) payload.star_context = patch.starContext;
  if (patch.starAction !== undefined) payload.star_action = patch.starAction;
  if (patch.starResult !== undefined) payload.star_result = patch.starResult;
  if (patch.metrics !== undefined) payload.metrics = patch.metrics as Json;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.sourceType !== undefined) payload.source_type = patch.sourceType;
  if (patch.sourceReference !== undefined) payload.source_reference = patch.sourceReference;
  return payload;
}

export function createKnowledgeRepository(client: CareerOsSupabaseClient = supabase) {
  return {
    async listKnowledgeItems() {
      const userId = await requireAuthenticatedUserId(client);
      const { data, error } = await client
        .from("knowledge_items")
        .select(KNOWLEDGE_COLUMNS)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      throwRepositoryError(error);
      return data ?? [];
    },

    async createKnowledgeItem(draft: KnowledgeItemDraft) {
      const userId = await requireAuthenticatedUserId(client);
      const { data, error } = await client
        .from("knowledge_items")
        .insert(insertPayload(userId, draft))
        .select(KNOWLEDGE_COLUMNS)
        .single();
      throwRepositoryError(error);
      return data;
    },

    async updateKnowledgeItem(id: string, patch: KnowledgeItemPatch) {
      const userId = await requireAuthenticatedUserId(client);
      const { data, error } = await client
        .from("knowledge_items")
        .update(updatePayload(patch))
        .eq("id", id)
        .eq("user_id", userId)
        .select(KNOWLEDGE_COLUMNS)
        .single();
      throwRepositoryError(error);
      return data;
    },

    async archiveKnowledgeItem(id: string) {
      const userId = await requireAuthenticatedUserId(client);
      const { error } = await client
        .from("knowledge_items")
        .update({ status: "archived" })
        .eq("id", id)
        .eq("user_id", userId);
      throwRepositoryError(error);
    },

    async deleteKnowledgeItem(id: string) {
      const userId = await requireAuthenticatedUserId(client);
      const { error } = await client
        .from("knowledge_items")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      throwRepositoryError(error);
    },
  };
}

const knowledgeRepository = createKnowledgeRepository();
export const listKnowledgeItems = knowledgeRepository.listKnowledgeItems;
export const createKnowledgeItem = knowledgeRepository.createKnowledgeItem;
export const updateKnowledgeItem = knowledgeRepository.updateKnowledgeItem;
export const archiveKnowledgeItem = knowledgeRepository.archiveKnowledgeItem;
export const deleteKnowledgeItem = knowledgeRepository.deleteKnowledgeItem;
