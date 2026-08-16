import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { requireAuthenticatedUserId, throwRepositoryError, type CareerOsSupabaseClient } from "../repositories/repository-utils";
import type { KnowledgeItem, KnowledgeItemDraft } from "./types";

export interface DetectedKnowledgeProposal {
  proposedChange: KnowledgeItemDraft;
  reason: string;
  source: "resume_review";
  status: "pending";
}

export interface CreateKnowledgeProposalInput extends DetectedKnowledgeProposal {
  resumeVersionId?: string | null;
  knowledgeItemId?: string | null;
}

const CONCRETE_FACT_SIGNAL = new RegExp(
  [
    String.raw`\b\d+(?:[,.]\d+)*(?:\s?%)?\b`,
    String.raw`[£$€]\s?\d`,
    String.raw`\b(?:budget|revenue|saving|conversion|project|migration|launch|certification)\b`,
  ].join("|"),
  "i",
);

const NAMED_TOOL_SIGNAL = /\b(?:using|with|via|in)\s+[A-Z][A-Za-z0-9+.#-]*(?:\s+[A-Z][A-Za-z0-9+.#-]*){0,3}\b/;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

function normaliseText(value: string) {
  return value
    .toLowerCase()
    .replace(/[–—-]/g, " ")
    .replace(/[^a-z0-9%£$€+.#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function factTokens(value: string) {
  return new Set(
    normaliseText(value)
      .split(" ")
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );
}

function similarity(left: string, right: string) {
  const a = factTokens(left);
  const b = factTokens(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function sentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function hasFactualSignal(sentence: string) {
  return CONCRETE_FACT_SIGNAL.test(sentence) || NAMED_TOOL_SIGNAL.test(sentence);
}

function alreadyKnown(sentence: string, currentKnowledge: KnowledgeItem[]) {
  return currentKnowledge.some((item) => {
    const combined = `${item.title} ${item.content} ${item.star_action ?? ""} ${item.star_result ?? ""}`;
    return similarity(sentence, combined) >= 0.55;
  });
}

function isNewAgainstOriginal(sentence: string, originalSentences: string[]) {
  return !originalSentences.some((original) => similarity(sentence, original) >= 0.62);
}

function proposalTitle(sentence: string) {
  const plain = sentence.replace(/[.!?]+$/, "").trim();
  if (plain.length <= 72) return plain;
  return `${plain.slice(0, 69).trim()}…`;
}

export function detectKnowledgeChanges(
  original: string,
  edited: string,
  currentKnowledge: KnowledgeItem[],
): DetectedKnowledgeProposal[] {
  if (normaliseText(original) === normaliseText(edited)) return [];

  const originalSentences = sentences(original);
  const candidates = sentences(edited).filter(
    (sentence) =>
      hasFactualSignal(sentence) &&
      isNewAgainstOriginal(sentence, originalSentences) &&
      !alreadyKnown(sentence, currentKnowledge),
  );

  return candidates.map((sentence) => ({
    proposedChange: {
      category: "resume_update",
      title: proposalTitle(sentence),
      content: sentence,
      status: "user_confirmed",
      sourceType: "resume_review",
      sourceReference: "Resume review",
    },
    reason: "New factual career information was added during resume review and is not currently stored in the Knowledge Bank.",
    source: "resume_review",
    status: "pending",
  }));
}

function knowledgeInsertPayload(userId: string, draft: KnowledgeItemDraft) {
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

function proposalDraft(value: Json): KnowledgeItemDraft {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const getString = (key: string) => (typeof record[key] === "string" ? record[key] : undefined);
  const status = getString("status") as KnowledgeItemDraft["status"] | undefined;

  return {
    employmentRoleId: getString("employmentRoleId") ?? null,
    category: getString("category") ?? "resume_update",
    title: getString("title") ?? "Resume review update",
    content: getString("content") ?? "",
    starContext: getString("starContext") ?? null,
    starAction: getString("starAction") ?? null,
    starResult: getString("starResult") ?? null,
    metrics:
      record.metrics && typeof record.metrics === "object" && !Array.isArray(record.metrics)
        ? (record.metrics as Record<string, string | number>)
        : {},
    status: status ?? "user_confirmed",
    sourceType: getString("sourceType") ?? "resume_review",
    sourceReference: getString("sourceReference") ?? "Resume review",
  };
}

export function createKnowledgeUpdateService(client: CareerOsSupabaseClient = supabase) {
  return {
    async createPendingProposal(input: CreateKnowledgeProposalInput) {
      const userId = await requireAuthenticatedUserId(client);
      const { data, error } = await client
        .from("knowledge_update_proposals")
        .insert({
          user_id: userId,
          resume_version_id: input.resumeVersionId ?? null,
          knowledge_item_id: input.knowledgeItemId ?? null,
          proposed_change: {
            ...input.proposedChange,
            source: input.source,
          } as Json,
          reason: input.reason,
          status: "pending",
        })
        .select("id,user_id,resume_version_id,knowledge_item_id,proposed_change,reason,status,created_at,resolved_at")
        .single();
      throwRepositoryError(error);
      return data;
    },

    async rejectKnowledgeProposal(id: string) {
      const userId = await requireAuthenticatedUserId(client);
      const { error } = await client
        .from("knowledge_update_proposals")
        .update({ status: "rejected", resolved_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      throwRepositoryError(error);
    },

    async approveKnowledgeProposal(id: string, editedProposal?: KnowledgeItemDraft) {
      const userId = await requireAuthenticatedUserId(client);
      const { data: proposal, error: proposalError } = await client
        .from("knowledge_update_proposals")
        .select("id,user_id,knowledge_item_id,proposed_change,status")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      throwRepositoryError(proposalError);
      if (!proposal) throw new Error("Knowledge Bank proposal was not found.");
      if (proposal.status !== "pending") throw new Error("Only pending Knowledge Bank proposals can be approved.");

      const draft = editedProposal ?? proposalDraft(proposal.proposed_change);
      const payload = knowledgeInsertPayload(userId, draft);

      if (proposal.knowledge_item_id) {
        const { error } = await client
          .from("knowledge_items")
          .update({
            employment_role_id: payload.employment_role_id,
            category: payload.category,
            title: payload.title,
            content: payload.content,
            star_context: payload.star_context,
            star_action: payload.star_action,
            star_result: payload.star_result,
            metrics: payload.metrics,
            status: payload.status,
            source_type: payload.source_type,
            source_reference: payload.source_reference,
          })
          .eq("id", proposal.knowledge_item_id)
          .eq("user_id", userId);
        throwRepositoryError(error);
      } else {
        const { error } = await client.from("knowledge_items").insert(payload);
        throwRepositoryError(error);
      }

      const { error: resolveError } = await client
        .from("knowledge_update_proposals")
        .update({
          status: "approved",
          proposed_change: {
            ...draft,
            source: "resume_review",
          } as Json,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId);
      throwRepositoryError(resolveError);
    },
  };
}

const knowledgeUpdateService = createKnowledgeUpdateService();
export const createPendingKnowledgeProposal = knowledgeUpdateService.createPendingProposal;
export const approveKnowledgeProposal = knowledgeUpdateService.approveKnowledgeProposal;
export const rejectKnowledgeProposal = knowledgeUpdateService.rejectKnowledgeProposal;
