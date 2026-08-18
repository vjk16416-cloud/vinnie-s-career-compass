import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { careerData } from "../data";
import { denyUnlessOwner } from "../guard";

export default defineTool({
  name: "get_career_profile",
  title: "Get career profile",
  description:
    "Return the CareerOS career record: headline profile, employment history, education, certifications and projects.",
  inputSchema: {},
  outputSchema: { profile: z.unknown() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (_input, ctx) => {
    const denied = denyUnlessOwner(ctx);
    if (denied) return denied;

    const { profile } = careerData();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(profile, null, 2) }],
      structuredContent: { profile },
    };
  },
});
