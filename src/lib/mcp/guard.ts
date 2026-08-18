import type { ToolContext } from "@lovable.dev/mcp-js";
import { isAllowedEmail } from "@/lib/auth/policy";

export type Denied = { content: [{ type: "text"; text: string }]; isError: true };

/** CareerOS is a single-owner workspace: only the owner's account may call these tools. */
export function denyUnlessOwner(ctx: ToolContext): Denied | null {
  if (!ctx.isAuthenticated()) {
    return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
  }
  if (!isAllowedEmail(ctx.getUserEmail())) {
    return {
      content: [{ type: "text", text: "This CareerOS workspace is private to its owner." }],
      isError: true,
    };
  }
  return null;
}
