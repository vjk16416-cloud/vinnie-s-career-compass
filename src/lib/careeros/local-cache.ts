import { normaliseData } from "./normalise";
import { withMasterProfileFoundation } from "./profile-data";
import type { CareerOsData } from "./types";

export const CAREER_OS_CACHE_KEY = "careeros:v1";
export const CAREER_OS_CACHE_META_KEY = "careeros:v1:cloud-cache";

type CareerOsCacheMeta = {
  userId: string;
  confirmed: true;
};

export function readCareerOsCache(storage: Storage): CareerOsData | null {
  try {
    const raw = storage.getItem(CAREER_OS_CACHE_KEY);
    if (!raw) return null;
    return withMasterProfileFoundation(normaliseData(JSON.parse(raw)));
  } catch {
    return null;
  }
}

export function writeCareerOsCache(storage: Storage, data: CareerOsData): void {
  storage.setItem(CAREER_OS_CACHE_KEY, JSON.stringify(data));
}

export function isCareerOsCacheCloudConfirmed(storage: Storage, userId: string): boolean {
  try {
    const raw = storage.getItem(CAREER_OS_CACHE_META_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<CareerOsCacheMeta>;
    return parsed.userId === userId && parsed.confirmed === true;
  } catch {
    return false;
  }
}

export function markCareerOsCacheCloudConfirmed(storage: Storage, userId: string): void {
  const meta: CareerOsCacheMeta = { userId, confirmed: true };
  storage.setItem(CAREER_OS_CACHE_META_KEY, JSON.stringify(meta));
}
