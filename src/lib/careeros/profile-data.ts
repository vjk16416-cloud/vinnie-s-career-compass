import { PROFILE_ITEMS, PROFILE_SOURCES } from "./profile-foundation";
import { createSeedData } from "./seed";
import type { CareerOsData } from "./types";

export function withMasterProfileFoundation(data: CareerOsData): CareerOsData {
  return {
    ...data,
    profileSources: PROFILE_SOURCES,
    profileItems: PROFILE_ITEMS,
  };
}

export function createCareerOsData(): CareerOsData {
  return withMasterProfileFoundation(createSeedData());
}
