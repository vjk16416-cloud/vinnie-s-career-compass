import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAuthorisedUser } from "./auth.server";
import { createBufferedLogoutSupabase } from "./supabase.server";

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () =>
  getAuthorisedUser(),
);

export class LogoutError extends Error {
  constructor() {
    super("CareerOS could not log you out. Please try again.");
    this.name = "LogoutError";
  }
}

type LogoutSession = {
  supabase: Pick<SupabaseClient, "auth">;
  commitCookies: () => void;
};

export async function logoutCurrentSession(
  createLogoutSession: () => LogoutSession = createBufferedLogoutSupabase,
) {
  const { supabase, commitCookies } = createLogoutSession();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) throw new LogoutError();

  commitCookies();
  return { ok: true as const };
}

export const logout = createServerFn({ method: "POST" }).handler(() => logoutCurrentSession());
