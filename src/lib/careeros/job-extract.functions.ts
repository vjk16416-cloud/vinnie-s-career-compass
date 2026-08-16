import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthorisedUser } from "../auth/auth.server";
import { extractJobPosting } from "./job-extract.server";

const Input = z.object({ url: z.string().url() });

export const extractJobFromUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    await requireAuthorisedUser();

    try {
      const res = await fetch(data.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        return { ok: false as const, reason: `The site responded with status ${res.status}.` };
      }
      return extractJobPosting(await res.text(), data.url);
    } catch {
      return {
        ok: false as const,
        reason: "We could not open that link from here.",
      };
    }
  });
