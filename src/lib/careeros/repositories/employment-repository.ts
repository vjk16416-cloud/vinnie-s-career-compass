import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import {
  requireAuthenticatedUserId,
  throwRepositoryError,
  type CareerOsSupabaseClient,
} from "./repository-utils";

const EMPLOYMENT_COLUMNS =
  "id,user_id,employer,title,employment_type,start_date,end_date,is_current,summary,created_at,updated_at";

export type EmploymentRoleDraft = {
  employer: string;
  title: string;
  employmentType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  summary?: string | null;
};

export type EmploymentRolePatch = Partial<EmploymentRoleDraft>;

function insertPayload(userId: string, draft: EmploymentRoleDraft): TablesInsert<"employment_roles"> {
  return {
    user_id: userId,
    employer: draft.employer,
    title: draft.title,
    employment_type: draft.employmentType ?? null,
    start_date: draft.startDate ?? null,
    end_date: draft.endDate ?? null,
    is_current: draft.isCurrent ?? false,
    summary: draft.summary ?? null,
  };
}

function updatePayload(patch: EmploymentRolePatch): TablesUpdate<"employment_roles"> {
  const payload: TablesUpdate<"employment_roles"> = {};
  if (patch.employer !== undefined) payload.employer = patch.employer;
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.employmentType !== undefined) payload.employment_type = patch.employmentType;
  if (patch.startDate !== undefined) payload.start_date = patch.startDate;
  if (patch.endDate !== undefined) payload.end_date = patch.endDate;
  if (patch.isCurrent !== undefined) payload.is_current = patch.isCurrent;
  if (patch.summary !== undefined) payload.summary = patch.summary;
  return payload;
}

export function createEmploymentRepository(client: CareerOsSupabaseClient = supabase) {
  return {
    async listEmploymentRoles() {
      const userId = await requireAuthenticatedUserId(client);
      const { data, error } = await client
        .from("employment_roles")
        .select(EMPLOYMENT_COLUMNS)
        .eq("user_id", userId)
        .order("start_date", { ascending: false });
      throwRepositoryError(error);
      return data ?? [];
    },

    async createEmploymentRole(draft: EmploymentRoleDraft) {
      const userId = await requireAuthenticatedUserId(client);
      const { data, error } = await client
        .from("employment_roles")
        .insert(insertPayload(userId, draft))
        .select(EMPLOYMENT_COLUMNS)
        .single();
      throwRepositoryError(error);
      return data;
    },

    async updateEmploymentRole(id: string, patch: EmploymentRolePatch) {
      const userId = await requireAuthenticatedUserId(client);
      const { data, error } = await client
        .from("employment_roles")
        .update(updatePayload(patch))
        .eq("id", id)
        .eq("user_id", userId)
        .select(EMPLOYMENT_COLUMNS)
        .single();
      throwRepositoryError(error);
      return data;
    },

    async deleteEmploymentRole(id: string) {
      const userId = await requireAuthenticatedUserId(client);
      const { error } = await client
        .from("employment_roles")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      throwRepositoryError(error);
    },
  };
}

const employmentRepository = createEmploymentRepository();
export const listEmploymentRoles = employmentRepository.listEmploymentRoles;
export const createEmploymentRole = employmentRepository.createEmploymentRole;
export const updateEmploymentRole = employmentRepository.updateEmploymentRole;
export const deleteEmploymentRole = employmentRepository.deleteEmploymentRole;
