import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
  type SetAllCookies,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequestHeader, getResponseHeaders } from "@tanstack/react-start/server";

import { getSupabaseConfig } from "./config";

function writeResponseCookies(...[cookies, headers]: Parameters<SetAllCookies>) {
  const responseHeaders = getResponseHeaders();

  for (const { name, value, options } of cookies) {
    responseHeaders.append("Set-Cookie", serializeCookieHeader(name, value, options));
  }

  for (const [name, value] of Object.entries(headers)) {
    responseHeaders.set(name, value);
  }
}

function createRequestSupabaseWithCookieWriter(setAll: SetAllCookies): SupabaseClient {
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(getRequestHeader("cookie") ?? "");
      },
      setAll,
    },
  });
}

export function createRequestSupabase(): SupabaseClient {
  return createRequestSupabaseWithCookieWriter(writeResponseCookies);
}

export function createBufferedLogoutSupabase() {
  const pendingCookieWrites: Array<Parameters<SetAllCookies>> = [];

  return {
    supabase: createRequestSupabaseWithCookieWriter((cookies, headers) => {
      pendingCookieWrites.push([cookies, headers]);
    }),
    commitCookies() {
      for (const cookieWrite of pendingCookieWrites) {
        writeResponseCookies(...cookieWrite);
      }
    },
  };
}
