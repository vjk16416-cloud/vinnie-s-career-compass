import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/lib/auth/auth-context";
import { logout } from "@/lib/auth/auth.functions";

const LOGOUT_ERROR_MESSAGE = "CareerOS could not log you out. Please try again.";

type AccountMenuProps = {
  replaceLocation?: (to: string) => void;
};

export function AccountMenu({
  replaceLocation = (to) => window.location.replace(to),
}: AccountMenuProps) {
  const { email } = useAuthUser();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [hasError, setHasError] = useState(false);
  const logoutButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (hasError && !pending) logoutButtonRef.current?.focus();
  }, [hasError, pending]);

  async function handleLogout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setHasError(false);

    try {
      await logout();
    } catch {
      setHasError(true);
      setPending(false);
      return;
    }

    queryClient.clear();

    try {
      await router.invalidate();
    } catch {
      // The authoritative server session is already gone; continue to the login screen.
    }

    try {
      await router.navigate({ to: "/login", replace: true });
    } catch {
      replaceLocation("/login");
    }

    setPending(false);
  }

  const buttonLabel = pending ? "Logging out…" : hasError ? "Try logging out again" : "Log out";

  return (
    <div className="flex items-center gap-2">
      <p className="max-w-32 truncate text-xs text-muted-foreground sm:max-w-48">{email}</p>
      <form method="post" onSubmit={handleLogout}>
        <Button
          ref={logoutButtonRef}
          type="submit"
          variant="outline"
          size="sm"
          disabled={pending}
          className="gap-1.5"
        >
          <LogOut aria-hidden="true" className="size-3.5" />
          {buttonLabel}
        </Button>
      </form>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={hasError ? "text-xs text-destructive" : "hidden"}
      >
        {hasError ? LOGOUT_ERROR_MESSAGE : ""}
      </p>
    </div>
  );
}
