import { normaliseData } from "./normalise";
import { withMasterProfileFoundation } from "./profile-data";
import type { CareerOsData } from "./types";

export const CAREER_OS_CACHE_KEY = "careeros:v1";

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
