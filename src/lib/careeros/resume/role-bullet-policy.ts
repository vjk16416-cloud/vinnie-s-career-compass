import type { KnowledgeItem } from "@/lib/careeros/knowledge/types";
import {
  selectRoleEvidence,
  type EvidenceStrengtheningPrompt,
} from "./evidence-selector";

export const MIN_ROLE_BULLETS = 3;
export const MAX_ROLE_BULLETS = 5;

export interface RoleBullet {
  text: string;
  evidenceId: string;
  status: KnowledgeItem["status"];
  sourceType: string;
  sourceReference: string | null;
}

export interface RoleBulletGap {
  missing: number;
  message: string;
  options: ["strengthen", "use_as_is", "exclude"];
}

export interface RoleBulletPlan {
  bullets: RoleBullet[];
  coverage: ReturnType<typeof assessRoleBulletCoverage>;
  strengthening: EvidenceStrengtheningPrompt[];
  blockedEvidenceIds: string[];
  gap: RoleBulletGap | null;
}

export function assessRoleBulletCoverage(count: number) {
  return {
    complete: count >= MIN_ROLE_BULLETS,
    count,
    target: `${MIN_ROLE_BULLETS}-${MAX_ROLE_BULLETS}`,
  };
}

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function bulletText(item: KnowledgeItem) {
  const action = clean(item.star_action);
  const result = clean(item.star_result);
  if (action && result) return `${action} ${result}`;
  if (action) return action;
  return clean(item.content);
}

export function buildRoleBulletPlan(
  items: KnowledgeItem[],
  employmentRoleId: string,
  preferredEvidenceIds: string[] = [],
): RoleBulletPlan {
  const selection = selectRoleEvidence(items, employmentRoleId);
  const preferredIndex = new Map(preferredEvidenceIds.map((id, index) => [id, index]));
  const supported = selection.supported.slice().sort((left, right) => {
    const leftRank = preferredIndex.get(left.id);
    const rightRank = preferredIndex.get(right.id);
    if (leftRank !== undefined && rightRank !== undefined) return leftRank - rightRank;
    if (leftRank !== undefined) return -1;
    if (rightRank !== undefined) return 1;
    return 0;
  });
  const chosen = supported.slice(0, MAX_ROLE_BULLETS);
  const bullets = chosen.map<RoleBullet>((item) => ({
    text: bulletText(item),
    evidenceId: item.id,
    status: item.status,
    sourceType: item.source_type,
    sourceReference: item.source_reference,
  }));

  const strengthening = [...selection.needsStrengthening];
  for (const item of chosen) {
    if (!clean(item.star_result)) {
      strengthening.push({
        evidenceId: item.id,
        title: item.title,
        status: item.status,
        reason:
          "A supported result or outcome is not recorded. Strengthening this evidence would make the resume bullet more effective without inventing impact.",
      });
    }
  }

  const coverage = assessRoleBulletCoverage(bullets.length);
  const gap = coverage.complete
    ? null
    : {
        missing: Math.max(0, MIN_ROLE_BULLETS - bullets.length),
        message: `This role has ${bullets.length} supported resume bullet${bullets.length === 1 ? "" : "s"}. CareerOS needs ${MIN_ROLE_BULLETS} to ${MAX_ROLE_BULLETS} supported bullets per included role. Add or strengthen Knowledge Bank evidence rather than inventing missing results.`,
        options: ["strengthen", "use_as_is", "exclude"] as [
          "strengthen",
          "use_as_is",
          "exclude",
        ],
      };

  return {
    bullets,
    coverage,
    strengthening,
    blockedEvidenceIds: selection.blocked.map((item) => item.id),
    gap,
  };
}
