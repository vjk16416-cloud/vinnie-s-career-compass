import type { EmploymentRole, KnowledgeItem } from "@/lib/careeros/knowledge/types";
import type { CareerOsData, JobRecord, ScanResult } from "@/lib/careeros/types";
import { listEmploymentRoles } from "@/lib/careeros/repositories/employment-repository";
import { listKnowledgeItems } from "@/lib/careeros/repositories/knowledge-repository";
import {
  buildTailoredCvFromKnowledge,
  type TailoredCvBuildResult,
  type TailoredCvKnowledgeContext,
} from "./tailored-cv";

export interface TailoredCvWorkflowDependencies {
  loadKnowledgeItems: () => Promise<KnowledgeItem[]>;
  loadEmploymentRoles: () => Promise<EmploymentRole[]>;
  generate: (
    data: CareerOsData,
    job: JobRecord,
    scan: ScanResult | undefined,
    knowledge: TailoredCvKnowledgeContext,
  ) => TailoredCvBuildResult;
}

export function createTailoredCvWorkflow(dependencies: TailoredCvWorkflowDependencies) {
  return async (
    data: CareerOsData,
    job: JobRecord,
    scan: ScanResult | undefined,
  ): Promise<TailoredCvBuildResult> => {
    const [knowledgeItems, employmentRoles] = await Promise.all([
      dependencies.loadKnowledgeItems(),
      dependencies.loadEmploymentRoles(),
    ]);

    return dependencies.generate(data, job, scan, {
      knowledgeItems,
      employmentRoles,
    });
  };
}

export const buildTailoredCvForCurrentUser = createTailoredCvWorkflow({
  loadKnowledgeItems: listKnowledgeItems,
  loadEmploymentRoles: listEmploymentRoles,
  generate: buildTailoredCvFromKnowledge,
});
