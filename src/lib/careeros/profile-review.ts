import type {
  CareerClaimVariant,
  CareerOsData,
  CareerProfileItem,
  CareerProfileItemStatus,
} from "./types";

export type ProfileDecisionAction = "Approve" | "Needs Evidence" | "Exclude" | "Resolve Conflict";
export type ProfileDecisionTarget = "Profile Item" | "Claim Variant";

export interface CareerProfileDecision {
  id: string;
  at: string;
  action: ProfileDecisionAction;
  targetType: ProfileDecisionTarget;
  profileItemId?: string;
  canonicalKey?: string;
  selectedVariantId?: string;
  previousStatus?: CareerProfileItemStatus;
  newStatus: CareerProfileItemStatus;
  sourceIds: string[];
  note?: string;
}

export type CareerOsDataWithDecisions = CareerOsData & {
  profileDecisions?: CareerProfileDecision[];
};

interface ProfileItemDecisionInput {
  profileItemId: string;
  status: Extract<CareerProfileItemStatus, "Approved" | "Needs Evidence" | "Excluded">;
  note?: string;
  at?: string;
}

interface ClaimVariantResolutionInput {
  canonicalKey: string;
  selectedVariantId: string;
  safeWording?: string;
  note?: string;
  at?: string;
}

function timestamp(input?: string): string {
  return input ?? new Date().toISOString();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function decisionId(action: ProfileDecisionAction, target: string, at: string): string {
  return `decision-${slug(action)}-${slug(target)}-${at.replace(/[^0-9]/g, "")}`;
}

function actionForStatus(
  status: Extract<CareerProfileItemStatus, "Approved" | "Needs Evidence" | "Excluded">,
): ProfileDecisionAction {
  if (status === "Approved") return "Approve";
  if (status === "Excluded") return "Exclude";
  return "Needs Evidence";
}

function addAuditTrail(
  data: CareerOsDataWithDecisions,
  decision: CareerProfileDecision,
  summary: string,
): void {
  data.profileDecisions = [decision, ...(data.profileDecisions ?? [])];
  data.profileVersions = [
    {
      id: `profile-review-${decision.id}`,
      createdAt: decision.at,
      label: "Evidence review",
      note: summary,
    },
    ...data.profileVersions,
  ];
  data.activity = [
    {
      id: `activity-${decision.id}`,
      at: decision.at,
      text: summary,
    },
    ...data.activity,
  ].slice(0, 40);
}

export function profileDecisions(data: CareerOsData): CareerProfileDecision[] {
  return (data as CareerOsDataWithDecisions).profileDecisions ?? [];
}

export function setProfileItemDecision(
  data: CareerOsData,
  input: ProfileItemDecisionInput,
): CareerOsDataWithDecisions {
  const draft = structuredClone(data) as CareerOsDataWithDecisions;
  const item = draft.profileItems?.find((candidate) => candidate.id === input.profileItemId);
  if (!item) throw new Error(`Unknown profile item: ${input.profileItemId}`);

  const at = timestamp(input.at);
  const previousStatus = item.status;
  item.status = input.status;
  item.updatedAt = at;

  const action = actionForStatus(input.status);
  const decision: CareerProfileDecision = {
    id: decisionId(action, item.id, at),
    at,
    action,
    targetType: "Profile Item",
    profileItemId: item.id,
    previousStatus,
    newStatus: input.status,
    sourceIds: [...item.sourceIds],
    ...(input.note ? { note: input.note } : {}),
  };

  addAuditTrail(draft, decision, `${action}d ${item.label}.`);
  return draft;
}

function resolvedProfileItem(
  canonicalKey: string,
  selected: CareerClaimVariant,
  safeWording: string | undefined,
  note: string | undefined,
  at: string,
): CareerProfileItem {
  return {
    id: `resolved-${canonicalKey}`,
    kind: selected.kind,
    label: selected.label,
    value: selected.value,
    safeWording: safeWording?.trim() || selected.value,
    sourceIds: [...selected.sourceIds],
    evidenceIds: [],
    status: "Approved",
    confidence: selected.confidence,
    ...(note ? { notes: note } : {}),
    updatedAt: at,
  };
}

export function resolveClaimVariant(
  data: CareerOsData,
  input: ClaimVariantResolutionInput,
): CareerOsDataWithDecisions {
  const draft = structuredClone(data) as CareerOsDataWithDecisions;
  const variants = (draft.profileClaimVariants ?? []).filter(
    (variant) => variant.canonicalKey === input.canonicalKey,
  );
  const selected = variants.find((variant) => variant.id === input.selectedVariantId);
  if (!selected) {
    throw new Error(
      `Unknown claim variant ${input.selectedVariantId} for ${input.canonicalKey}`,
    );
  }

  const at = timestamp(input.at);
  const previousStatus = selected.status;
  variants.forEach((variant) => {
    if (variant.id === selected.id) {
      variant.status = "Approved";
      variant.updatedAt = at;
    } else if (variant.status === "Approved") {
      variant.status = "Conflict";
      variant.updatedAt = at;
    }
  });

  const resolved = resolvedProfileItem(
    input.canonicalKey,
    selected,
    input.safeWording,
    input.note,
    at,
  );
  const existingIndex = (draft.profileItems ?? []).findIndex((item) => item.id === resolved.id);
  if (!draft.profileItems) draft.profileItems = [];
  if (existingIndex >= 0) draft.profileItems[existingIndex] = resolved;
  else draft.profileItems.push(resolved);

  const decision: CareerProfileDecision = {
    id: decisionId("Resolve Conflict", input.canonicalKey, at),
    at,
    action: "Resolve Conflict",
    targetType: "Claim Variant",
    profileItemId: resolved.id,
    canonicalKey: input.canonicalKey,
    selectedVariantId: selected.id,
    previousStatus,
    newStatus: "Approved",
    sourceIds: [...selected.sourceIds],
    ...(input.note ? { note: input.note } : {}),
  };

  addAuditTrail(draft, decision, `Resolved ${selected.label}: approved ${selected.value}.`);
  return draft;
}
