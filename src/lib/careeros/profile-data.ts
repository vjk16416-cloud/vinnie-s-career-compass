import { PROFILE_ITEMS, PROFILE_SOURCES } from "./profile-foundation";
import { createSeedData } from "./seed";
import type { CareerOsData, CareerProfileItem, CareerProfileSource } from "./types";

export type CareerOsDataWithMasterProfile = CareerOsData & {
  profileSources: CareerProfileSource[];
  profileItems: CareerProfileItem[];
};

export function withMasterProfileFoundation(
  data: CareerOsData,
): CareerOsDataWithMasterProfile {
  return {
    ...data,
    profileSources: data.profileSources ?? PROFILE_SOURCES,
    profileItems: data.profileItems ?? PROFILE_ITEMS,
  };
}

export function createCareerOsData(): CareerOsDataWithMasterProfile {
  return withMasterProfileFoundation(createSeedData());
}
