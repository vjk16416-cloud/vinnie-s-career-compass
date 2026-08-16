const AUTH_CONFIGURATION_ERROR = "CareerOS authentication is not configured.";

export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

export function getSupabaseConfig(): SupabaseConfig {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey } = import.meta.env;

  if (!url || !publishableKey) {
    throw new Error(AUTH_CONFIGURATION_ERROR);
  }

  return { url, publishableKey };
}
