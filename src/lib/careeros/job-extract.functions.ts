import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ url: z.string().url() });

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<br\s*\/?>(?=)/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const extractJobFromUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    try {
      const res = await fetch(data.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CareerOS/0.1)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        return { ok: false as const, reason: `The site responded with status ${res.status}.` };
      }
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const text = stripHtml(html);
      if (text.split(/\s+/).length < 120) {
        return {
          ok: false as const,
          reason: "The page did not return enough readable text — it is likely loaded after sign-in or by scripts.",
        };
      }
      return {
        ok: true as const,
        title: titleMatch?.[1]?.trim().slice(0, 140) ?? "",
        text: text.slice(0, 20000),
      };
    } catch {
      return {
        ok: false as const,
        reason: "We could not open that link from here.",
      };
    }
  });
