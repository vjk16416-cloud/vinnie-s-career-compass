import type { KnowledgeItem } from "@/lib/careeros/knowledge/types";

const SUPPORTED_STATUSES = new Set<KnowledgeItem["status"]>([
  "verified",
  "user_confirmed",
]);

const CONTEXT_STATUSES = new Set<KnowledgeItem["status"]>([
  "imported_cv",
  "imported_linkedin",
  "needs_verification",
]);

const BLOCKED_STATUSES = new Set<KnowledgeItem["status"]>(["archived", "excluded"]);

export interface EvidenceStrengtheningPrompt {
  evidenceId: string;
  title: string;
  reason: string;
  status: KnowledgeItem["status"];
}

export interface RoleEvidenceSelection {
  supported: KnowledgeItem[];
  needsStrengthening: EvidenceStrengtheningPrompt[];
  blocked: KnowledgeItem[];
}

function hasText(value: string | null) {
  return Boolean(value?.trim());
}

function evidenceStrength(item: KnowledgeItem) {
  if (hasText(item.star_action) && hasText(item.star_result)) return 3;
  if (hasText(item.star_action) || hasText(item.star_result)) return 2;
  return 1;
}

function provenanceStrength(status: KnowledgeItem["status"]) {
  switch (status) {
    case "verified":
      return 4;
    case "user_confirmed":
      return 3;
    default:
      return 0;
  }
}

function strengtheningReason(status: KnowledgeItem["status"]) {
  switch (status) {
    case "imported_cv":
      return "This information was imported from a CV and needs user confirmation before CareerOS can use it as a factual resume bullet.";
    case "imported_linkedin":
      return "This information was imported from LinkedIn and needs user confirmation before CareerOS can use it as a factual resume bullet.";
    case "needs_verification":
      return "This information needs verification before CareerOS can use it as a factual resume bullet.";
    default:
      return "This information is not eligible for factual resume reuse yet.";
  }
}

export function selectRoleEvidence(
  items: KnowledgeItem[],
  employmentRoleId: string,
): RoleEvidenceSelection {
  const roleItems = items.filter((item) => item.employment_role_id === employmentRoleId);

  const blocked = roleItems.filter((item) => BLOCKED_STATUSES.has(item.status));
  const contextOnly = roleItems.filter((item) => CONTEXT_STATUSES.has(item.status));
  const supported = roleItems
    .filter((item) => SUPPORTED_STATUSES.has(item.status))
    .sort((left, right) => {
      const qualityDifference = evidenceStrength(right) - evidenceStrength(left);
      if (qualityDifference) return qualityDifference;
      const provenanceDifference = provenanceStrength(right.status) - provenanceStrength(left.status);
      if (provenanceDifference) return provenanceDifference;
      return right.updated_at.localeCompare(left.updated_at);
    });

  return {
    supported,
    needsStrengthening: contextOnly.map((item) => ({
      evidenceId: item.id,
      title: item.title,
      status: item.status,
      reason: strengtheningReason(item.status),
    })),
    blocked,
  };
}
