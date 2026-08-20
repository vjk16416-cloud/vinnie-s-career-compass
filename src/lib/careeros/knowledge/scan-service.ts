import type { JobRecord, ScanResult } from "../types";
import { listEmploymentRoles } from "../repositories/employment-repository";
import { listKnowledgeItems } from "../repositories/knowledge-repository";
import { runCanonicalKnowledgeScan } from "./matching";

export async function runCanonicalJobScan(job: JobRecord): Promise<ScanResult> {
  const [knowledge, roles] = await Promise.all([
    listKnowledgeItems(),
    listEmploymentRoles(),
  ]);

  return runCanonicalKnowledgeScan(job, knowledge, roles);
}
