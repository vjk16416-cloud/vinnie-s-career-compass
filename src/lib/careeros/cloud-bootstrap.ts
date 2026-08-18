import { normaliseData } from "./normalise";
import { createCareerOsData, withMasterProfileFoundation } from "./profile-data";
import {
  CAREER_STATE_SCHEMA_VERSION,
  type CareerStateRepository,
  type CareerStateRow,
} from "./cloud-state.repository";
import { readCareerOsCache, writeCareerOsCache } from "./local-cache";
import type { CareerOsData } from "./types";

export type CareerStateBootstrapResult = {
  data: CareerOsData;
  mode: "synced" | "offline-cache";
  source: "cloud" | "local-migration" | "seed" | "cache-fallback";
  canEdit: boolean;
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
    writeCareerOsCache(storage, data);
    return { data, mode: "synced", source: "cloud", canEdit: true };
  }

  const initial = local ?? createCareerOsData();
  const confirmed = await repository.create(userId, initial, CAREER_STATE_SCHEMA_VERSION);
  const data = normaliseCloudRow(confirmed);
  writeCareerOsCache(storage, data);

  return {
    data,
    mode: "synced",
    source: local ? "local-migration" : "seed",
    canEdit: true,
  };
}
