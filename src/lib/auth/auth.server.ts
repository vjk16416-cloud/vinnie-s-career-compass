import type { SupabaseClient } from "@supabase/supabase-js";

import { isAllowedEmail, normaliseEmail } from "./policy";
import { createRequestSupabase } from "./supabase.server";

export type AuthorisedUser = { id: string; email: string };

export class UnauthorisedError extends Error {
  readonly statusCode = 401;

  constructor() {
    super("Unauthorised");
    this.name = "UnauthorisedError";
  }
}

export async function getAuthorisedUser(
  supabase: SupabaseClient = createRequestSupabase(),
): Promise<AuthorisedUser | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    const user = data.user;

    if (error || !user) return null;

    if (!user.email || !isAllowedEmail(user.email)) {
      try {
        await supabase.auth.signOut();
      } catch {
        // A failed remote sign-out must not make the account authorised.
      }
      return null;
    }

    return { id: user.id, email: normaliseEmail(user.email) };
  } catch {
    return null;
  }
}

export async function requireAuthorisedUser(): Promise<AuthorisedUser> {
  const user = await getAuthorisedUser();
  if (!user) throw new UnauthorisedError();
  return user;
}
