import { describe, expect, it, vi } from "vitest";
import {
  CAREER_STATE_SCHEMA_VERSION,
  type CareerStateRepository,
  type CareerStateRow,
} from "./cloud-state.repository";
import { bootstrapCareerState, CareerStateBootstrapError } from "./cloud-bootstrap";
import { CAREER_OS_CACHE_KEY } from "./local-cache";
import { createCareerOsData } from "./profile-data";
import type { CareerOsData } from "./types";

const CAREER_OS_CACHE_META_KEY = "careeros:v1:cloud-cache";

function memoryStorage(initial?: Record<string, string>): Storage {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function storageWith(data: CareerOsData): Storage {
  return memoryStorage({ [CAREER_OS_CACHE_KEY]: JSON.stringify(data) });
}

function cloudRow(data: CareerOsData): CareerStateRow {
  return {
    userId: "user-1",
    schemaVersion: CAREER_STATE_SCHEMA_VERSION,
    data,
    createdAt: "2026-08-18T20:00:00.000Z",
    updatedAt: "2026-08-18T20:00:00.000Z",
  };
}

function repositoryWith(loadResult: CareerStateRow | null): CareerStateRepository & {
  load: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
} {
  return {
    load: vi.fn().mockResolvedValue(loadResult),
    create: vi.fn(async (userId: string, data: CareerOsData, schemaVersion: number) => ({
      ...cloudRow(data),
      userId,
      schemaVersion,
    })),
    save: vi.fn(async (userId: string, data: CareerOsData, schemaVersion: number) => ({
      ...cloudRow(data),
      userId,
      schemaVersion,
    })),
  };
}

describe("bootstrapCareerState", () => {
  it("prefers an existing cloud row over a different local cache", async () => {
    const cloud = createCareerOsData();
    cloud.profile.headline = "Cloud headline";
    const local = createCareerOsData();
    local.profile.headline = "Old local headline";
    const storage = memoryStorage({
      [CAREER_OS_CACHE_KEY]: JSON.stringify(local),
      [CAREER_OS_CACHE_META_KEY]: JSON.stringify({ userId: "user-1", confirmed: true }),
    });
    const repository = repositoryWith(cloudRow(cloud));

    const result = await bootstrapCareerState({ userId: "user-1", repository, storage });

    expect(result.mode).toBe("synced");
    expect(result.source).toBe("cloud");
    expect(result.canEdit).toBe(true);
    expect(result.data.profile.headline).toBe("Cloud headline");
    expect(repository.create).not.toHaveBeenCalled();
    expect(JSON.parse(storage.getItem(CAREER_OS_CACHE_KEY) ?? "{}").profile.headline).toBe(
      "Cloud headline",
    );
  });

  it("preserves divergent unconfirmed local data when cloud already exists", async () => {
    const cloud = createCareerOsData();
    cloud.profile.headline = "Cloud headline";
    const local = createCareerOsData();
    local.profile.headline = "Local work from this device";
    const storage = storageWith(local);
    const repository = repositoryWith(cloudRow(cloud));

    const result = await bootstrapCareerState({ userId: "user-1", repository, storage });

    expect(result.mode).toBe("local-conflict");
    expect(result.source).toBe("local-conflict");
    expect(result.canEdit).toBe(false);
    expect(result.data.profile.headline).toBe("Cloud headline");
    expect(result.pendingLocalData?.profile.headline).toBe("Local work from this device");
    expect(JSON.parse(storage.getItem(CAREER_OS_CACHE_KEY) ?? "{}").profile.headline).toBe(
      "Local work from this device",
    );
  });

  it("migrates valid local state only when cloud state is absent", async () => {
    const local = createCareerOsData();
    local.profile.headline = "Migrated local headline";
    const storage = storageWith(local);
    const repository = repositoryWith(null);

    const result = await bootstrapCareerState({ userId: "user-1", repository, storage });

    expect(repository.create).toHaveBeenCalledOnce();
    expect(repository.create).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        profile: expect.objectContaining({ headline: "Migrated local headline" }),
      }),
      CAREER_STATE_SCHEMA_VERSION,
    );
    expect(result.source).toBe("local-migration");
    expect(result.data.profile.headline).toBe("Migrated local headline");
    expect(JSON.parse(storage.getItem(CAREER_OS_CACHE_META_KEY) ?? "null")).toEqual({
      userId: "user-1",
      confirmed: true,
    });
  });

  it("uploads seed data when neither cloud nor local state exists", async () => {
    const storage = memoryStorage();
    const repository = repositoryWith(null);

    const result = await bootstrapCareerState({ userId: "user-1", repository, storage });

    expect(result.source).toBe("seed");
    expect(result.mode).toBe("synced");
    expect(repository.create).toHaveBeenCalledOnce();
    expect(storage.getItem(CAREER_OS_CACHE_KEY)).not.toBeNull();
  });

  it("falls back to seed when the local cache is invalid and cloud is absent", async () => {
    const storage = memoryStorage({ [CAREER_OS_CACHE_KEY]: "{invalid-json" });
    const repository = repositoryWith(null);

    const result = await bootstrapCareerState({ userId: "user-1", repository, storage });

    expect(result.source).toBe("seed");
    expect(repository.create).toHaveBeenCalledOnce();
    expect(result.data.profile.name).toBe(createCareerOsData().profile.name);
  });

  it("falls back to a valid cache in read-only mode when cloud load fails", async () => {
    const cached = createCareerOsData();
    cached.profile.headline = "Cached headline";
    const storage = storageWith(cached);
    const repository = repositoryWith(null);
    repository.load.mockRejectedValue(new Error("network"));

    const result = await bootstrapCareerState({ userId: "user-1", repository, storage });

    expect(result.mode).toBe("offline-cache");
    expect(result.source).toBe("cache-fallback");
    expect(result.canEdit).toBe(false);
    expect(result.data.profile.headline).toBe("Cached headline");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("throws a safe bootstrap error when cloud is unavailable and no cache exists", async () => {
    const repository = repositoryWith(null);
    repository.load.mockRejectedValue(new Error("database connection details"));

    await expect(
      bootstrapCareerState({ userId: "user-1", repository, storage: memoryStorage() }),
    ).rejects.toMatchObject({
      name: "CareerStateBootstrapError",
      reason: "cloud-unavailable-no-cache",
      message: "CareerOS cloud data is unavailable",
    });

    try {
      await bootstrapCareerState({ userId: "user-1", repository, storage: memoryStorage() });
    } catch (error) {
      expect(error).toBeInstanceOf(CareerStateBootstrapError);
      expect(String(error)).not.toContain("database connection details");
    }
  });

  it("is idempotent after migration because an existing cloud row never creates again", async () => {
    const local = createCareerOsData();
    local.profile.headline = "Migrated once";
    const storage = storageWith(local);
    const repository = repositoryWith(null);

    const first = await bootstrapCareerState({ userId: "user-1", repository, storage });
    const confirmed = cloudRow(first.data);
    repository.load.mockResolvedValue(confirmed);
    repository.create.mockClear();

    const second = await bootstrapCareerState({ userId: "user-1", repository, storage });

    expect(second.source).toBe("cloud");
    expect(repository.create).not.toHaveBeenCalled();
    expect(second.data.profile.headline).toBe("Migrated once");
  });
});
