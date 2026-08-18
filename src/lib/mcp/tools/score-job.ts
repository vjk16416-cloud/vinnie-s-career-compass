import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runScan } from "@/lib/careeros/scoring";
import type { JobRecord } from "@/lib/careeros/types";
import { careerData } from "../data";
import { denyUnlessOwner } from "../guard";

export default defineTool({
  name: "score_job",
  title: "Score a job description",
  description:
    "Run the CareerOS Role Compatibility Score against a job description: overall score, verdict, sub-scores, strengths, gaps and keyword coverage.",
  inputSchema: {
    title: z.string().min(1).describe("Job title."),
    company: z.string().describe("Hiring company. Use '' if unknown."),
    location: z.string().describe("Job location. Use '' if unknown."),
    description: z.string().min(50).describe("Full job description text."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ title, company, location, description }, ctx) => {
    const denied = denyUnlessOwner(ctx);
    if (denied) return denied;

    const job: JobRecord = {
      id: `mcp-${Date.now()}`,
      title,
      company,
      location,
      description,
      createdAt: new Date().toISOString(),
      sourceType: "paste",
    };

    const scan = runScan(job, careerData());
    const summary = [
      `Overall: ${scan.overall}/100 — ${scan.verdict} (${scan.strategy})`,
      "",
      "Sub-scores:",
      ...scan.subScores.map((s) => `- ${s.label}: ${s.score} — ${s.reason}`),
      "",
      "Strengths:",
      ...scan.strengths.map((s) => `- ${s.text}`),
      "",
      "Gaps:",
      ...scan.gaps.map((g) => `- ${g}`),
    ].join("\n");

    return {
      content: [{ type: "text" as const, text: summary }],
      structuredContent: { scan },
    };
  },
});
