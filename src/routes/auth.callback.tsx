import { createFileRoute } from "@tanstack/react-router";

import { completeGoogleOAuth } from "@/lib/auth/oauth.functions";

type CallbackSearch = {
  code?: string;
  returnTo?: string;
};

function validateCallbackSearch(search: Record<string, unknown>): CallbackSearch {
  const code = typeof search["code"] === "string" ? search["code"] : undefined;
  const returnTo = typeof search["returnTo"] === "string" ? search["returnTo"] : undefined;

  return {
    ...(code ? { code } : {}),
    ...(returnTo ? { returnTo } : {}),
  };
}

export const Route = createFileRoute("/auth/callback")({
  validateSearch: validateCallbackSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => completeGoogleOAuth({ data: deps }),
  component: OAuthCallbackPage,
});

function OAuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        Completing Google Sign-In…
      </p>
    </main>
  );
}
