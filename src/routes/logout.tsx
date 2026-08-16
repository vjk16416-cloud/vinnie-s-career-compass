import { createFileRoute } from "@tanstack/react-router";

import { AccountMenu } from "@/components/auth/account-menu";

export const Route = createFileRoute("/logout")({
  head: () => ({
    meta: [{ title: "Log out — CareerOS" }],
  }),
  component: LogoutPage,
});

function LogoutPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Log out of CareerOS?</h1>
          <p className="text-sm text-muted-foreground">
            Confirm to end this session on this device.
          </p>
        </div>
        <AccountMenu />
      </section>
    </main>
  );
}
