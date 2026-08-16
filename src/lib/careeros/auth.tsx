import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const ALLOWED_EMAIL = "vjk16416@gmail.com";

interface AuthValue {
  session: Session | null;
  email: string | null;
  loading: boolean;
  deniedEmail: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function isAllowed(session: Session | null) {
  return (session?.user.email ?? "").trim().toLowerCase() === ALLOWED_EMAIL;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const apply = (next: Session | null) => {
      if (!active) return;
      if (next && !isAllowed(next)) {
        // Unauthorised account: sign out immediately and deny access.
        setDeniedEmail(next.user.email ?? "unknown account");
        setSession(null);
        void supabase.auth.signOut();
      } else {
        if (next) setDeniedEmail(null);
        setSession(next);
      }
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      apply(next);
    });

    void supabase.auth.getSession().then(({ data }) => apply(data.session));

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const normalised = email.trim().toLowerCase();
    if (normalised !== ALLOWED_EMAIL) {
      throw new Error("This account is not authorised to access CareerOS.");
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: normalised,
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      email: session?.user.email ?? null,
      loading,
      deniedEmail,
      signIn,
      signOut,
    }),
    [session, loading, deniedEmail, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
