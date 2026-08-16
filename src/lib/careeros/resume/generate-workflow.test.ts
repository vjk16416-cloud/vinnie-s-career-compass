import { describe, expect, it, vi } from "vitest";
import type { CareerOsData, JobRecord } from "@/lib/careeros/types";
import { createTailoredCvWorkflow } from "./generate-workflow";

const minimalData = {
  profile: { employment: [] },
} as unknown as CareerOsData;

const job = {
  id: "job-1",
  title: "Marketing Manager",
  company: "Example Ltd",
  location: "London",
  description: "Marketing role",
  createdAt: "2026-08-16T00:00:00.000Z",
  sourceType: "paste",
} as JobRecord;

describe("authenticated tailored CV workflow", () => {
  it("loads current-user Knowledge Bank data before generating the CV", async () => {
    const knowledgeItems = [{ id: "knowledge-1" }];
    const employmentRoles = [{ id: "role-1" }];
    const loadKnowledgeItems = vi.fn().mockResolvedValue(knowledgeItems);
    const loadEmploymentRoles = vi.fn().mockResolvedValue(employmentRoles);
    const generate = vi.fn().mockReturnValue({ ready: true, body: "CV" });

    const workflow = createTailoredCvWorkflow({
      loadKnowledgeItems: loadKnowledgeItems as never,
      loadEmploymentRoles: loadEmploymentRoles as never,
      generate: generate as never,
    });

    const result = await workflow(minimalData, job, undefined);

    expect(loadKnowledgeItems).toHaveBeenCalledTimes(1);
    expect(loadEmploymentRoles).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith(minimalData, job, undefined, {
      knowledgeItems,
      employmentRoles,
    });
    expect(result).toEqual({ ready: true, body: "CV" });
  });
});
