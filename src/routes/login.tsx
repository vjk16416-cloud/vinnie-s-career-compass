import { createFileRoute } from "@tanstack/react-router";

import { LoginCard } from "@/components/auth/login-card";

type LoginSearch = {
  error?: "unauthorised" | "authentication";
  returnTo?: string;
};

function validateLoginSearch(search: Record<string, unknown>): LoginSearch {
  const error =
    search["error"] === "unauthorised" || search["error"] === "authentication"
      ? search["error"]
      : undefined;
  const returnTo = typeof search["returnTo"] === "string" ? search["returnTo"] : undefined;

  return {
    ...(error ? { error } : {}),
    ...(returnTo ? { returnTo } : {}),
  };
}

export const Route = createFileRoute("/login")({
  validateSearch: validateLoginSearch,
  head: () => ({
    meta: [
      { title: "Sign in — CareerOS" },
      { name: "description", content: "Sign in to the private CareerOS workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  return (
    <LoginCard
      {...(search.error ? { error: search.error } : {})}
      {...(search.returnTo ? { returnTo: search.returnTo } : {})}
    />
  );
}
