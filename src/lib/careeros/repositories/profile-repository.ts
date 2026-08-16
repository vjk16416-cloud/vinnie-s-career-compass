import type { Json, TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import {
  requireAuthenticatedUserId,
  throwRepositoryError,
  type CareerOsSupabaseClient,
} from "./repository-utils";

const PROFILE_COLUMNS =
  "user_id,display_name,location,professional_summary,target_roles,target_industries,writing_preferences,created_at,updated_at";

export type ProfilePatch = {
  displayName?: string | null;
  location?: string | null;
  professionalSummary?: string | null;
  targetRoles?: string[];
  targetIndustries?: string[];
  writingPreferences?: Record<string, string | number | boolean | null>;
};

function updatePayload(patch: ProfilePatch): TablesUpdate<"profiles"> {
  const payload: TablesUpdate<"profiles"> = {};
  if (patch.displayName !== undefined) payload.display_name = patch.displayName;
  if (patch.location !== undefined) payload.location = patch.location;
  if (patch.professionalSummary !== undefined) payload.professional_summary = patch.professionalSummary;
  if (patch.targetRoles !== undefined) payload.target_roles = patch.targetRoles;
  if (patch.targetIndustries !== undefined) payload.target_industries = patch.targetIndustries;
  if (patch.writingPreferences !== undefined) {
    payload.writing_preferences = patch.writingPreferences as Json;
  }
  return payload;
}

export function createProfileRepository(client: CareerOsSupabaseClient = supabase) {
  return {
    async getProfile() {
      const userId = await requireAuthenticatedUserId(client);
      const { data, error } = await client
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();
      throwRepositoryError(error);
      return data;
    },

    async updateProfile(patch: ProfilePatch) {
      const userId = await requireAuthenticatedUserId(client);
      const { data, error } = await client
        .from("profiles")
        .update(updatePayload(patch))
        .eq("user_id", userId)
        .select(PROFILE_COLUMNS)
        .maybeSingle();
      throwRepositoryError(error);
      return data;
    },
  };
}

const profileRepository = createProfileRepository();
export const getProfile = profileRepository.getProfile;
export const updateProfile = profileRepository.updateProfile;
