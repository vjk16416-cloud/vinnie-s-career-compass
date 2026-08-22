import type { DiscoveredJob } from "./job-discovery";

const PREFIX = "careeros:discovered-job:";

function isDiscoveredJob(value: unknown): value is DiscoveredJob {
  if (!value || typeof value !== "object") return false;
  const job = value as Partial<DiscoveredJob>;
  return Boolean(
    job.id &&
      job.title &&
      job.company &&
      job.description &&
      job.sourceUrl &&
      (job.provider === "arbeitnow-uk" || job.provider === "remotive"),
  );
}

export function storeDiscoveredJobForAnalysis(
  job: DiscoveredJob,
  storage: Storage = window.sessionStorage,
): string {
  const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  storage.setItem(`${PREFIX}${key}`, JSON.stringify(job));
  return key;
}

export function consumeDiscoveredJobForAnalysis(
  key: string,
  storage: Storage = window.sessionStorage,
): DiscoveredJob | null {
  if (!key) return null;
  const storageKey = `${PREFIX}${key}`;
  const raw = storage.getItem(storageKey);
  if (!raw) return null;
  storage.removeItem(storageKey);

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isDiscoveredJob(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
