export const ALLOWED_EMAIL = "vjk16416@gmail.com";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SESSION_STORAGE_KEY = "careeros.supabase.session";

export type AuthUser = {
  id: string;
  email?: string;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type?: string;
  user: AuthUser;
};

function requireConfig() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "CareerOS authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url: SUPABASE_URL, key: SUPABASE_KEY };
}

function authHeaders(accessToken?: string) {
  const { key } = requireConfig();

  return {
    apikey: key,
    Authorization: `Bearer ${accessToken ?? key}`,
    "Content-Type": "application/json",
  };
}

function saveSession(session: AuthSession) {
  const expiresAt = Date.now() + session.expires_in * 1000;
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ ...session, expires_at: expiresAt }),
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    clearSession();
    return null;
  }
}

async function parseError(response: Response) {
  try {
    const payload = (await response.json()) as {
      msg?: string;
      message?: string;
      error_description?: string;
    };
    return payload.msg ?? payload.message ?? payload.error_description ?? "Authentication failed.";
  } catch {
    return "Authentication failed.";
  }
}

export async function signInWithPassword(email: string, password: string) {
  if (email.trim().toLowerCase() !== ALLOWED_EMAIL) {
    throw new Error("This CareerOS workspace is private and access is restricted.");
  }

  const { url } = requireConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email: ALLOWED_EMAIL, password }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const session = (await response.json()) as AuthSession;
  if (session.user?.email?.toLowerCase() !== ALLOWED_EMAIL) {
    clearSession();
    throw new Error("This account is not authorised for CareerOS.");
  }

  saveSession(session);
  return session;
}

export async function refreshSession(session: AuthSession) {
  const { url } = requireConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });

  if (!response.ok) {
    clearSession();
    return null;
  }

  const refreshed = (await response.json()) as AuthSession;
  if (refreshed.user?.email?.toLowerCase() !== ALLOWED_EMAIL) {
    clearSession();
    return null;
  }

  saveSession(refreshed);
  return refreshed;
}

export async function validateSession(session: AuthSession) {
  const { url } = requireConfig();
  let activeSession = session;

  if (session.expires_at && session.expires_at <= Date.now() + 60_000) {
    const refreshed = await refreshSession(session);
    if (!refreshed) return null;
    activeSession = refreshed;
  }

  const response = await fetch(`${url}/auth/v1/user`, {
    method: "GET",
    headers: authHeaders(activeSession.access_token),
  });

  if (!response.ok) {
    clearSession();
    return null;
  }

  const user = (await response.json()) as AuthUser;
  if (user.email?.toLowerCase() !== ALLOWED_EMAIL) {
    clearSession();
    return null;
  }

  return { ...activeSession, user };
}

export async function signOut(session?: AuthSession | null) {
  const { url } = requireConfig();

  if (session?.access_token) {
    await fetch(`${url}/auth/v1/logout`, {
      method: "POST",
      headers: authHeaders(session.access_token),
    }).catch(() => undefined);
  }

  clearSession();
}

export function isAuthConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}
