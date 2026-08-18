import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { extractJobPosting } from "@/lib/careeros/job-extract.server";
import { denyUnlessOwner } from "../guard";

export default defineTool({
  name: "extract_job_posting",
  title: "Extract a job posting",
  description:
    "Fetch a public job advert URL and return structured fields (title, company, location, responsibilities, skills, qualifications). Some job boards block server-side fetching; paste the text into score_job instead when that happens.",
  inputSchema: {
    url: z.string().url().describe("Public URL of the job advert."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ url }, ctx) => {
    const denied = denyUnlessOwner(ctx);
    if (denied) return denied;

    if (!url.startsWith("https://")) {
      return { content: [{ type: "text" as const, text: "Only https URLs are supported." }], isError: true as const };
    }

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
        redirect: "follow",
      });
      if (!res.ok) {
        return {
          content: [{ type: "text" as const, text: `The site responded with status ${res.status}.` }],
          isError: true as const,
        };
      }
      const result = extractJobPosting(await res.text(), url);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: { result },
      };
    } catch {
      return {
        content: [{ type: "text" as const, text: "We could not open that link from here. Paste the advert text instead." }],
        isError: true as const,
      };
    }
  },
});
