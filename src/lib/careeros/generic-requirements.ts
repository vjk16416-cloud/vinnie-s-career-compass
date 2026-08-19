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

function priorityFor(context: string): RequirementPriority {
  return /preferred|desirable|nice to have|bonus|advantage/i.test(context)
    ? "Preferred"
    : "Required";
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

interface CandidateRequirement {
  phrase: string;
  context: string;
}

function collectCandidateRequirements(jobDescription: string): CandidateRequirement[] {
  const candidates: CandidateRequirement[] = [];
  const patterns = [
    /\bmust have\s+([^.!?\n]+)/gi,
    /\b(?:required|essential)\s*:\s*([^.!?\n]+)/gi,
    /([^.!?\n]{5,160}?)\s+(?:is|are)\s+(?:also\s+)?required\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of jobDescription.matchAll(pattern)) {
      const raw = match[1] ?? "";
      const phrase = cleanRequirement(raw);
      if (!phrase) continue;
      candidates.push({ phrase, context: match[0] });
    }
  }

  const sentences = jobDescription
    .split(/\n+|(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    if (!/required|essential|must|need/i.test(sentence)) continue;
    const experience = sentence.match(
      /\b(?:experience|knowledge|proficiency|expertise)\s+(?:in|with|of)\s+([^.!?\n]+)/i,
    )?.[0];
    if (experience) candidates.push({ phrase: cleanRequirement(experience), context: sentence });

    const ability = sentence.match(/\bability to\s+([^.!?\n]+)/i)?.[0];
    if (ability) candidates.push({ phrase: cleanRequirement(ability), context: sentence });
  }

  return candidates;
}

export function addUnmappedRequirementGaps(
  existing: EvidenceMapItem[],
  jobDescription: string,
): EvidenceMapItem[] {
  const result = [...existing];

  for (const candidate of collectCandidateRequirements(jobDescription)) {
    const phrase = candidate.phrase;
    if (!phrase || phrase.length < 5 || phrase.length > 180) continue;
    if (isAlreadyRepresented(phrase, result)) continue;

    result.push({
      id: `unmapped-${normalise(phrase).replace(/\s+/g, "-").slice(0, 80)}`,
      requirement: phrase,
      category: "Skill",
      priority: priorityFor(candidate.context),
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
