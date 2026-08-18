import { redirect } from "@tanstack/react-router";
import { createClientOnlyFn, createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getAuthorisedUser, type AuthorisedUser } from "./auth.server";
import { safeReturnTo } from "./policy";
import { getBrowserSupabase } from "./supabase.client";
import { createRequestSupabase } from "./supabase.server";

export const GOOGLE_SIGN_IN_ERROR = "CareerOS could not start Google Sign-In. Please try again.";
export const GOOGLE_PROVIDER_SETUP_ERROR =
  "Google Sign-In is not enabled yet. Finish the CareerOS Google setup, then try again.";

export type GoogleSignInResult = { error: string | null };

type SupabaseFactory = () => SupabaseClient;
type AuthoriseUser = (supabase: SupabaseClient) => Promise<AuthorisedUser | null>;

function isGoogleProviderSetupError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

  return (
    code === "validation_failed" &&
    (message.includes("unsupported provider") ||
      message.includes("provider is not enabled") ||
      message.includes("provider not enabled"))
  );
}

export const startGoogleSignIn = createClientOnlyFn(async function startGoogleSignIn(
  returnTo?: string,
  createSupabase: SupabaseFactory = getBrowserSupabase,
): Promise<GoogleSignInResult> {
  try {
    const supabase = createSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(
          safeReturnTo(returnTo),
        )}`,
      },
    });

    if (!error) return { error: null };
    return {
      error: isGoogleProviderSetupError(error) ? GOOGLE_PROVIDER_SETUP_ERROR : GOOGLE_SIGN_IN_ERROR,
    };
  } catch {
    return { error: GOOGLE_SIGN_IN_ERROR };
  }
});

export type OAuthCallbackInput = {
  code?: string | undefined;
  returnTo?: string | undefined;
};

const oauthCallbackInput = z.object({
  code: z.string().optional(),
  returnTo: z.string().optional(),
});

function authenticationRedirect(): never {
  throw redirect({ to: "/login", search: { error: "authentication" } });
}

export async function handleOAuthCallback(
  input: OAuthCallbackInput,
  createSupabase: SupabaseFactory = createRequestSupabase,
  authoriseUser: AuthoriseUser = getAuthorisedUser,
): Promise<never> {
  if (!input.code?.trim()) authenticationRedirect();

  let supabase: SupabaseClient;
  try {
    supabase = createSupabase();
  } catch {
    authenticationRedirect();
  }

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(input.code);
    if (error) authenticationRedirect();
  } catch {
    authenticationRedirect();
  }

  let user: AuthorisedUser | null = null;
  try {
    user = await authoriseUser(supabase);
  } catch {
    user = null;
  }

  if (!user) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Authorisation remains denied even if the provider cannot revoke remotely.
    }

    throw redirect({ to: "/login", search: { error: "unauthorised" } });
  }

  throw redirect({ href: safeReturnTo(input.returnTo) });
}

export const completeGoogleOAuth = createServerFn({ method: "GET" })
  .validator((input: unknown) => oauthCallbackInput.parse(input))
  .handler(({ data }) => handleOAuthCallback(data));
