import type { Tables } from "@/integrations/supabase/types";

export type KnowledgeStatus =
  | "verified"
  | "user_confirmed"
  | "imported_cv"
  | "imported_linkedin"
  | "needs_verification"
  | "archived"
  | "excluded";

export type KnowledgeItemDraft = {
  employmentRoleId?: string | null;
  category: string;
  title: string;
  content: string;
  starContext?: string | null;
  starAction?: string | null;
  starResult?: string | null;
  metrics?: Record<string, string | number>;
  status: KnowledgeStatus;
  sourceType: string;
  sourceReference?: string | null;
};

export type KnowledgeItemPatch = Partial<KnowledgeItemDraft>;
export type KnowledgeItem = Tables<"knowledge_items">;
export type EmploymentRole = Tables<"employment_roles">;
export type EvidenceItem = Tables<"evidence_items">;
export type CareerProfile = Tables<"profiles">;
