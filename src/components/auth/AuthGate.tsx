import { useEffect, useState, type ReactNode } from "react";

import {
  ALLOWED_EMAIL,
  getStoredSession,
  isAuthConfigured,
  signInWithPassword,
  signOut,
  validateSession,
  type AuthSession,
} from "../../lib/auth/supabase-auth";

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function initialise() {
      if (!isAuthConfigured()) {
        if (active) setChecking(false);
        return;
      }

      const stored = getStoredSession();
      if (!stored) {
        if (active) setChecking(false);
        return;
      }

      const validated = await validateSession(stored).catch(() => null);
      if (active) {
        setSession(validated);
        setChecking(false);
      }
    }

    initialise();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const nextSession = await signInWithPassword(ALLOWED_EMAIL, password);
      setSession(nextSession);
      setPassword("");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    await signOut(session).catch(() => undefined);
    setSession(null);
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <p className="text-sm text-muted-foreground">Checking CareerOS access…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Private workspace
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">CareerOS</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to access your personal career operating system.
            </p>
          </div>

          {!isAuthConfigured() ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              Authentication configuration is missing. Add VITE_SUPABASE_URL and
              VITE_SUPABASE_PUBLISHABLE_KEY to the deployment environment.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={ALLOWED_EMAIL}
                  readOnly
                  autoComplete="username"
                  className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground outline-none"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>

              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sr-only" aria-live="polite">
        Signed in as {session.user.email}.
      </div>
      {children}
      <button
        type="button"
        onClick={handleSignOut}
        className="fixed bottom-4 right-4 z-50 rounded-md border border-border bg-background/95 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
