import type { JobRecord } from "@/lib/careeros/types";
import { suggestCvCategory } from "@/lib/careeros/generate";

export type MasterCvFamily =
  | "Product / Product Management"
  | "Project / PMO / Delivery"
  | string;

const PRODUCT_TERMS: Record<string, number> = {
  product: 4,
  roadmap: 3,
  discovery: 3,
  feature: 2,
  customer: 2,
  users: 2,
  user: 2,
  backlog: 2,
  experimentation: 2,
  proposition: 2,
};

const PROJECT_TERMS: Record<string, number> = {
  project: 4,
  pmo: 4,
  programme: 3,
  governance: 3,
  raid: 3,
  milestone: 2,
  milestones: 2,
  dependency: 2,
  dependencies: 2,
  delivery: 2,
  plan: 1,
  planning: 1,
};

function score(text: string, terms: Record<string, number>) {
  const lower = text.toLowerCase();
  return Object.entries(terms).reduce(
    (total, [term, weight]) => total + (lower.includes(term) ? weight : 0),
    0,
  );
}

export function selectMasterCvFamily(job: JobRecord): MasterCvFamily {
  const text = `${job.title} ${job.description}`;
  const productScore = score(text, PRODUCT_TERMS);
  const projectScore = score(text, PROJECT_TERMS);

  if (productScore >= 5 && productScore > projectScore) {
    return "Product / Product Management";
  }

  if (projectScore >= 5 && projectScore > productScore) {
    return "Project / PMO / Delivery";
  }

  return suggestCvCategory(job);
}
