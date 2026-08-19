import { normaliseData } from "./normalise";
import { createCareerOsData, withMasterProfileFoundation } from "./profile-data";
import {
  CAREER_STATE_SCHEMA_VERSION,
  type CareerStateRepository,
  type CareerStateRow,
} from "./cloud-state.repository";
import {
  isCareerOsCacheCloudConfirmed,
  markCareerOsCacheCloudConfirmed,
  readCareerOsCache,
  writeCareerOsCache,
} from "./local-cache";
import type { CareerOsData } from "./types";

export type CareerStateBootstrapResult = {
  data: CareerOsData;
  mode: "synced" | "offline-cache" | "local-conflict";
  source: "cloud" | "local-migration" | "seed" | "cache-fallback" | "local-conflict";
  canEdit: boolean;
  pendingLocalData?: CareerOsData;
};

export class CareerStateBootstrapError extends Error {
  constructor(readonly reason: "cloud-unavailable-no-cache") {
    super("CareerOS cloud data is unavailable");
    this.name = "CareerStateBootstrapError";
  }
}

type BootstrapInput = {
  userId: string;
  repository: CareerStateRepository;
  storage: Storage;
};

function normaliseCloudRow(row: CareerStateRow): CareerOsData {
  return withMasterProfileFoundation(normaliseData(row.data));
}

function sameCareerState(left: CareerOsData, right: CareerOsData): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function bootstrapCareerState({
  userId,
  repository,
  storage,
}: BootstrapInput): Promise<CareerStateBootstrapResult> {
  const local = readCareerOsCache(storage);

  let cloud: CareerStateRow | null;
  try {
    cloud = await repository.load(userId);
  } catch {
    if (!local) throw new CareerStateBootstrapError("cloud-unavailable-no-cache");
    return {
      data: local,
      mode: "offline-cache",
      source: "cache-fallback",
      canEdit: false,
    };
  }

  if (cloud) {
    const data = normaliseCloudRow(cloud);
    const localIsConfirmedCloudCopy = isCareerOsCacheCloudConfirmed(storage, userId);

    if (local && !localIsConfirmedCloudCopy && !sameCareerState(local, data)) {
      return {
        data,
        mode: "local-conflict",
        source: "local-conflict",
        canEdit: false,
        pendingLocalData: local,
      };
    }

    writeCareerOsCache(storage, data);
    markCareerOsCacheCloudConfirmed(storage, userId);
    return { data, mode: "synced", source: "cloud", canEdit: true };
  }

  const initial = local ?? createCareerOsData();
  const confirmed = await repository.create(userId, initial, CAREER_STATE_SCHEMA_VERSION);
  const data = normaliseCloudRow(confirmed);
  writeCareerOsCache(storage, data);
  markCareerOsCacheCloudConfirmed(storage, userId);

  return {
    data,
    mode: "synced",
    source: local ? "local-migration" : "seed",
    canEdit: true,
  };
}
