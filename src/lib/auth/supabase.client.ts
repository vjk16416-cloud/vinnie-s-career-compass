import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "./config";

let browserSupabase: SupabaseClient | undefined;

export function getBrowserSupabase(): SupabaseClient {
  if (!browserSupabase) {
    const { url, publishableKey } = getSupabaseConfig();
    browserSupabase = createBrowserClient(url, publishableKey);
  }

  return browserSupabase;
}
