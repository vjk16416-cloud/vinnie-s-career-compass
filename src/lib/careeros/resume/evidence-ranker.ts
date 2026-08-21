import type { KnowledgeItem } from "@/lib/careeros/knowledge/types";

const ELIGIBLE_STATUSES = new Set<KnowledgeItem["status"]>(["verified", "user_confirmed"]);
const STOPWORDS = new Set(
  "the and for with from into this that your our you are will have has role work working experience candidate candidates responsible responsibilities manager management associate strong ability skills skill using use used about their they them its job company team teams end-to-end".split(/\s+/),
);

const CATEGORY_BOOST: Record<string, number> = {
  project: 1.25,
  achievement: 1.15,
  star_story: 1.2,
  metric: 1.1,
};

export interface RankedEvidence {
  item: KnowledgeItem;
  relevance: number;
  matchedTerms: string[];
}

function tokenise(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^[-]+|[-]+$/g, ""))
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function evidenceText(item: KnowledgeItem) {
  return [item.title, item.content, item.star_context, item.star_action, item.star_result]
    .filter(Boolean)
    .join(" ");
}

export function rankEvidenceForJob(
  items: KnowledgeItem[],
  jobText: string,
): RankedEvidence[] {
  const jobTokens = tokenise(jobText);
  const jobFrequency = new Map<string, number>();
  for (const token of jobTokens) {
    jobFrequency.set(token, (jobFrequency.get(token) ?? 0) + 1);
  }

  return items
    .filter((item) => ELIGIBLE_STATUSES.has(item.status))
    .map((item) => {
      const itemTokens = new Set(tokenise(evidenceText(item)));
      const matchedTerms = [...itemTokens].filter((token) => jobFrequency.has(token));
      const overlapScore = matchedTerms.reduce(
        (sum, token) => sum + (jobFrequency.get(token) ?? 1),
        0,
      );
      const categoryMultiplier = CATEGORY_BOOST[item.category.toLowerCase()] ?? 1;
      const relevance = Number((overlapScore * categoryMultiplier).toFixed(2));

      return { item, relevance, matchedTerms };
    })
    .filter((row) => row.relevance > 0)
    .sort((left, right) => {
      if (right.relevance !== left.relevance) return right.relevance - left.relevance;
      if (right.matchedTerms.length !== left.matchedTerms.length) {
        return right.matchedTerms.length - left.matchedTerms.length;
      }
      return right.item.updated_at.localeCompare(left.item.updated_at);
    });
}
