import type { EmploymentRole, KnowledgeItem } from "@/lib/careeros/knowledge/types";
import type { CareerOsData, EmploymentRecord, JobRecord, ScanResult } from "@/lib/careeros/types";
import { buildRoleBulletPlan, MIN_ROLE_BULLETS, MAX_ROLE_BULLETS } from "./role-bullet-policy";

export interface TailoredCvKnowledgeContext {
  knowledgeItems: KnowledgeItem[];
  employmentRoles: EmploymentRole[];
}

export interface TailoredCvRoleGap {
  profileRoleId: string;
  knowledgeRoleId: string | null;
  roleTitle: string;
  employer: string;
  missing: number;
  message: string;
  options: ["strengthen", "use_as_is", "exclude"];
}

export interface TailoredCvStrengtheningPrompt {
  profileRoleId: string;
  knowledgeRoleId: string | null;
  evidenceId: string;
  reason: string;
}

export interface TailoredCvBuildResult {
  body: string;
  evidenceIds: string[];
  roleEvidenceMap: Record<string, string[]>;
  roleGaps: TailoredCvRoleGap[];
  strengthening: TailoredCvStrengtheningPrompt[];
  ready: boolean;
}

function normalise(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function findKnowledgeRole(
  profileRole: EmploymentRecord,
  roles: EmploymentRole[],
): EmploymentRole | undefined {
  const direct = roles.find((role) => role.id === profileRole.id);
  if (direct) return direct;

  return roles.find(
    (role) =>
      normalise(role.title) === normalise(profileRole.title) &&
      normalise(role.employer) === normalise(profileRole.company),
  );
}

function focusFromScan(scan: ScanResult | undefined) {
  if (!scan) return "delivery, analytics and stakeholder management";
  return scan.subScores
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((score) => score.label.replace(" Fit", ""))
    .join(", ");
}

export function buildTailoredCvFromKnowledge(
  data: CareerOsData,
  job: JobRecord,
  scan: ScanResult | undefined,
  knowledge: TailoredCvKnowledgeContext,
): TailoredCvBuildResult {
  const profile = data.profile;
  const roleEvidenceMap: Record<string, string[]> = {};
  const roleGaps: TailoredCvRoleGap[] = [];
  const strengthening: TailoredCvStrengtheningPrompt[] = [];
  const evidenceIds: string[] = [];
  const rolePlans = new Map<
    string,
    {
      knowledgeRole: EmploymentRole | undefined;
      bullets: ReturnType<typeof buildRoleBulletPlan>["bullets"];
    }
  >();

  for (const profileRole of profile.employment) {
    const knowledgeRole = findKnowledgeRole(profileRole, knowledge.employmentRoles);
    if (!knowledgeRole) {
      roleEvidenceMap[profileRole.id] = [];
      roleGaps.push({
        profileRoleId: profileRole.id,
        knowledgeRoleId: null,
        roleTitle: profileRole.title,
        employer: profileRole.company,
        missing: MIN_ROLE_BULLETS,
        message: `CareerOS cannot safely generate role bullets for ${profileRole.title} at ${profileRole.company} until this employment role is linked to Knowledge Bank evidence.`,
        options: ["strengthen", "use_as_is", "exclude"],
      });
      rolePlans.set(profileRole.id, { knowledgeRole, bullets: [] });
      continue;
    }

    const plan = buildRoleBulletPlan(knowledge.knowledgeItems, knowledgeRole.id);
    const mappedIds = plan.bullets.map((bullet) => bullet.evidenceId);
    roleEvidenceMap[profileRole.id] = mappedIds;
    evidenceIds.push(...mappedIds);
    rolePlans.set(profileRole.id, { knowledgeRole, bullets: plan.bullets });

    strengthening.push(
      ...plan.strengthening.map((prompt) => ({
        profileRoleId: profileRole.id,
        knowledgeRoleId: knowledgeRole.id,
        evidenceId: prompt.evidenceId,
        reason: prompt.reason,
      })),
    );

    if (plan.gap) {
      roleGaps.push({
        profileRoleId: profileRole.id,
        knowledgeRoleId: knowledgeRole.id,
        roleTitle: profileRole.title,
        employer: profileRole.company,
        missing: plan.gap.missing,
        message: plan.gap.message,
        options: plan.gap.options,
      });
    }
  }

  const lines: string[] = [];
  lines.push(`# ${profile.name}`);
  lines.push(`${profile.location} | ${profile.headline}`);
  lines.push("");
  lines.push("## Professional Summary");
  lines.push(
    `${profile.summary} Applying for ${job.title} at ${job.company}, with emphasis on ${focusFromScan(scan).toLowerCase()}.`,
  );
  lines.push("");
  lines.push("## Core Skills");
  lines.push(profile.skills.slice(0, 14).join(" | "));
  lines.push("");
  lines.push("## Tools and Platforms");
  lines.push(profile.tools.join(" | "));
  lines.push("");
  lines.push("## Professional Experience");

  profile.employment.forEach((role) => {
    lines.push(`### ${role.title} — ${role.company} (${role.employmentType})`);
    lines.push(`${role.start} – ${role.end} | ${role.location}`);
    const plan = rolePlans.get(role.id);
    plan?.bullets.slice(0, MAX_ROLE_BULLETS).forEach((bullet) => {
      lines.push(`- ${bullet.text}`);
    });
    lines.push("");
  });

  lines.push("## Education");
  profile.education.forEach((entry) =>
    lines.push(`- ${entry.qualification}, ${entry.institution} — ${entry.detail}`),
  );
  lines.push("");
  lines.push("## Certifications");
  profile.certifications.forEach((entry) =>
    lines.push(`- ${entry.name}, ${entry.issuer} (${entry.completed})`),
  );
  lines.push("");
  lines.push("## Selected Projects");
  profile.projects.forEach((project) => lines.push(`- ${project.name}: ${project.summary}`));

  return {
    body: lines.join("\n"),
    evidenceIds: [...new Set(evidenceIds)],
    roleEvidenceMap,
    roleGaps,
    strengthening,
    ready: roleGaps.length === 0,
  };
}
