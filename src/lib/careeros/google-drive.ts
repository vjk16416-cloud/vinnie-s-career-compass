import type { SupabaseClient } from "@supabase/supabase-js";
import { createClientOnlyFn } from "@tanstack/react-start";

import { getBrowserSupabase } from "@/lib/auth/supabase.client";
import { safeReturnTo } from "@/lib/auth/policy";

export const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
export const DRIVE_CONNECTION_ERROR =
  "CareerOS could not start the Google Drive connection. Please try again.";
export const DRIVE_READ_ERROR = "CareerOS could not read that Google Drive folder.";

export type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
};

type SupabaseFactory = () => SupabaseClient;
type Fetcher = typeof fetch;

export const startGoogleDriveConnection = createClientOnlyFn(
  async function startGoogleDriveConnection(
    returnTo = "/settings",
    createSupabase: SupabaseFactory = getBrowserSupabase,
    origin = window.location.origin,
  ): Promise<{ error: string | null }> {
    try {
      const supabase = createSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: DRIVE_READONLY_SCOPE,
          redirectTo: `${origin}/auth/callback?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      return { error: error ? DRIVE_CONNECTION_ERROR : null };
    } catch {
      return { error: DRIVE_CONNECTION_ERROR };
    }
  },
);

export function extractDriveFolderId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (!/^https?:\/\//i.test(value)) {
    return /^[a-zA-Z0-9_-]+$/.test(value) ? value : null;
  }

  try {
    const url = new URL(value);
    if (url.hostname !== "drive.google.com") return null;
    const match = url.pathname.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export const getGoogleProviderToken = createClientOnlyFn(async function getGoogleProviderToken(
  createSupabase: SupabaseFactory = getBrowserSupabase,
): Promise<string | null> {
  try {
    const supabase = createSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session?.provider_token ?? null;
  } catch {
    return null;
  }
});

export async function listDriveFolderFiles(
  folderReference: string,
  providerToken: string,
  fetcher: Fetcher = fetch,
): Promise<GoogleDriveFile[]> {
  const folderId = extractDriveFolderId(folderReference);
  if (!folderId || !providerToken) throw new Error(DRIVE_READ_ERROR);

  const query = `'${folderId}' in parents and trashed = false`;
  const params = new URLSearchParams({
    q: query,
    pageSize: "100",
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
  });

  const response = await fetcher(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${providerToken}` },
  });

  if (!response.ok) throw new Error(DRIVE_READ_ERROR);

  const payload = (await response.json()) as { files?: GoogleDriveFile[] };
  return Array.isArray(payload.files) ? payload.files : [];
}
