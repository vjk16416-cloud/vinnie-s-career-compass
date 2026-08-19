import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { careerData } from "../data";
import { denyUnlessOwner } from "../guard";

export default defineTool({
  name: "list_evidence",
  title: "List evidence bank",
  description:
    "List CareerOS evidence records with their lifecycle status. Only Verified evidence may be used in CVs or cover letters.",
  inputSchema: {
    status: z
      .enum(["Verified", "Needs Evidence", "Archived", "Excluded", "All"])
      .describe("Filter by evidence status. Use 'All' for every record."),
    search: z
      .string()
      .describe("Free-text filter over the claim, employer and skills. Use '' for none."),
  },
  outputSchema: { count: z.number(), items: z.array(z.unknown()) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ status, search }, ctx) => {
    const denied = denyUnlessOwner(ctx);
    if (denied) return denied;

    const term = search.trim().toLowerCase();
    const items = careerData().evidence.filter((record) => {
      if (status !== "All" && record.status !== status) return false;
      if (!term) return true;
      const haystack = `${record.claim} ${record.employer} ${(record.skills ?? []).join(" ")}`;
      return haystack.toLowerCase().includes(term);
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(items, null, 2) }],
      structuredContent: { count: items.length, items },
    };
  },
});
