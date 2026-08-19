import type { EvidenceMapItem, RequirementPriority } from "./types";

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanRequirement(value: string) {
  return value
    .replace(/^(you|the successful candidate|candidates?)\s+/i, "")
    .replace(/^(will|should|need to|needs to|must)\s+/i, "")
    .replace(/\s+(?:is|are)\s+(?:also\s+)?required$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;:,]+$/, "");
}

function priorityFor(sentence: string): RequirementPriority {
  return /preferred|desirable|nice to have|bonus|advantage/i.test(sentence)
    ? "Preferred"
    : "Required";
}

function requirementPhrase(sentence: string) {
  const trimmed = sentence.trim();
  const mustHave = trimmed.match(/\bmust have\s+(.+)$/i)?.[1];
  if (mustHave) return cleanRequirement(mustHave);

  const required = trimmed.match(/^(.+?)\s+(?:is|are)\s+(?:also\s+)?required\b/i)?.[1];
  if (required) return cleanRequirement(required);

  const experience = trimmed.match(
    /\b(?:experience|knowledge|proficiency|expertise)\s+(?:in|with|of)\s+(.+)$/i,
  )?.[0];
  if (experience && /required|essential|must|need/i.test(trimmed))
    return cleanRequirement(experience);

  const ability = trimmed.match(/\bability to\s+(.+)$/i)?.[0];
  if (ability && /required|essential|must|need/i.test(trimmed)) return cleanRequirement(ability);

  return "";
}

function isAlreadyRepresented(candidate: string, items: EvidenceMapItem[]) {
  const needle = normalise(candidate);
  if (!needle) return true;
  return items.some((item) => {
    const existing = normalise(item.requirement);
    if (!existing) return false;
    return needle === existing || needle.includes(existing) || existing.includes(needle);
  });
}

export function addUnmappedRequirementGaps(
  existing: EvidenceMapItem[],
  jobDescription: string,
): EvidenceMapItem[] {
  const result = [...existing];
  const sentences = jobDescription
    .split(/\n+|(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    const phrase = requirementPhrase(sentence);
    if (!phrase || phrase.length < 5 || phrase.length > 180) continue;
    if (isAlreadyRepresented(phrase, result)) continue;

    result.push({
      id: `unmapped-${normalise(phrase).replace(/\s+/g, "-").slice(0, 80)}`,
      requirement: phrase,
      category: "Skill",
      priority: priorityFor(sentence),
      status: "Gap",
      score: 0,
      evidenceIds: [],
      profileItemIds: [],
      sourceIds: [],
      explanation:
        "CareerOS detected this as a job criterion but could not map it to approved or verified career evidence.",
    });
  }

  return result;
}
