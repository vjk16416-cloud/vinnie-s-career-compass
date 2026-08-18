import { LoaderCircle, LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { startGoogleSignIn, type GoogleSignInResult } from "@/lib/auth/oauth.functions";

export type LoginCardProps = {
  error?: "unauthorised" | "authentication";
  returnTo?: string;
  startSignIn?: (returnTo?: string) => Promise<GoogleSignInResult>;
};

const CALLBACK_ERROR_MESSAGE = "CareerOS could not complete Google Sign-In. Please try again.";
const UNAUTHORISED_MESSAGE = "This Google account is not authorised for CareerOS.";

function messageForError(error: LoginCardProps["error"]): string {
  if (error === "unauthorised") return UNAUTHORISED_MESSAGE;
  if (error === "authentication") return CALLBACK_ERROR_MESSAGE;
  return "";
}

export function LoginCard({ error, returnTo, startSignIn = startGoogleSignIn }: LoginCardProps) {
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState(() => messageForError(error));
  const [hasError, setHasError] = useState(Boolean(error));
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (hasError && !pending) buttonRef.current?.focus();
  }, [hasError, pending]);

  async function handleSignIn() {
    setPending(true);
    setHasError(false);
    setStatusMessage("Opening Google Sign-In…");

    const result = await startSignIn(returnTo);
    setPending(false);

    if (result.error) {
      setHasError(true);
      setStatusMessage(result.error);
      return;
    }

    setStatusMessage("");
  }

  const buttonLabel = pending
    ? "Opening Google Sign-In…"
    : hasError
      ? "Try Google Sign-In again"
      : "Sign in with Google";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-sm font-medium tracking-wide text-muted-foreground">
          <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-primary">
            <LockKeyhole aria-hidden="true" className="size-4" />
          </span>
          Private career workspace
        </div>

        <Card className="border-border/80 bg-card shadow-2xl shadow-black/20">
          <CardHeader className="space-y-3 pb-5 text-center">
            <CardTitle className="text-3xl tracking-tight">
              <h1>CareerOS</h1>
            </CardTitle>
            <CardDescription className="text-sm leading-6">
              Sign in with your approved Google account to open your private workspace.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {statusMessage ? (
              <p
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={
                  hasError
                    ? "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive-foreground"
                    : "sr-only"
                }
              >
                {statusMessage}
              </p>
            ) : (
              <p role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
            )}

            <Button
              ref={buttonRef}
              type="button"
              size="lg"
              className="w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              disabled={pending}
              aria-describedby="login-access-note"
              onClick={handleSignIn}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-4 items-center justify-center rounded-full bg-primary-foreground text-[10px] font-bold text-primary"
                >
                  G
                </span>
              )}
              {buttonLabel}
            </Button>

            <div id="login-access-note" className="space-y-1 text-center text-xs leading-5 text-muted-foreground">
              <p>No CareerOS password required.</p>
              <p>Access is limited to vjk16416@gmail.com</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
