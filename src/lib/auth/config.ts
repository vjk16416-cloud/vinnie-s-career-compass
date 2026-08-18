export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

type SupabaseEnv = Partial<{
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_PUBLISHABLE_KEY: string;
}>;

export const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  url: "https://gieehxdyzcrrmgxnfsxs.supabase.co",
  publishableKey: "sb_publishable_7NVzhglqzn08aWpSonqhfA_hzlc5A7i",
};

export function resolveSupabaseConfig(env: SupabaseEnv): SupabaseConfig {
  return {
    url: env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_CONFIG.url,
    publishableKey:
      env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || DEFAULT_SUPABASE_CONFIG.publishableKey,
  };
}

export function getSupabaseConfig(): SupabaseConfig {
  return resolveSupabaseConfig(import.meta.env);
}
