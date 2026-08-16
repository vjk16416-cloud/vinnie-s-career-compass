import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type CareerOsSupabaseClient = SupabaseClient<Database>;

export async function requireAuthenticatedUserId(client: CareerOsSupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("CareerOS authentication is required.");
  return data.user.id;
}

export function throwRepositoryError(error: unknown) {
  if (error) throw error;
}
