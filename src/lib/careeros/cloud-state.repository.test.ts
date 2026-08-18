import { describe, expect, it, vi } from "vitest";
import { createCareerOsData } from "./profile-data";
import {
  CareerStatePersistenceError,
  createSupabaseCareerStateRepository,
} from "./cloud-state.repository";

type Result = { data: unknown; error: unknown };

function fakeSupabase({ maybeSingle, single }: { maybeSingle?: Result; single?: Result }) {
  const maybeSingleFn = vi.fn().mockResolvedValue(maybeSingle ?? { data: null, error: null });
  const singleFn = vi.fn().mockResolvedValue(single ?? { data: null, error: null });
  const eq = vi.fn(() => ({ maybeSingle: maybeSingleFn }));
  const select = vi.fn(() => ({ eq, single: singleFn }));
  const insert = vi.fn(() => ({ select }));
  const upsert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ select, insert, upsert }));

  return { from, insert, upsert, select, eq, maybeSingle: maybeSingleFn, single: singleFn };
}

describe("createSupabaseCareerStateRepository", () => {
  it("returns null when the authenticated user has no cloud state", async () => {
    const client = fakeSupabase({ maybeSingle: { data: null, error: null } });
    const repository = createSupabaseCareerStateRepository(client as never);

    await expect(repository.load("user-1")).resolves.toBeNull();
    expect(client.from).toHaveBeenCalledWith("career_state");
    expect(client.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("maps a Supabase read error without leaking provider details", async () => {
    const client = fakeSupabase({
      maybeSingle: { data: null, error: { message: "sensitive database detail" } },
    });
    const repository = createSupabaseCareerStateRepository(client as never);

    await expect(repository.load("user-1")).rejects.toMatchObject({
      name: "CareerStatePersistenceError",
      operation: "read",
    });

    try {
      await repository.load("user-1");
    } catch (error) {
      expect(error).toBeInstanceOf(CareerStatePersistenceError);
      expect(String(error)).not.toContain("sensitive database detail");
    }
  });

  it("creates the first cloud row for the requested user", async () => {
    const state = createCareerOsData();
    const row = {
      user_id: "user-1",
      schema_version: 1,
      data: state,
      created_at: "2026-08-18T20:00:00.000Z",
      updated_at: "2026-08-18T20:00:00.000Z",
    };
    const client = fakeSupabase({ single: { data: row, error: null } });
    const repository = createSupabaseCareerStateRepository(client as never);

    await expect(repository.create("user-1", state, 1)).resolves.toMatchObject({
      userId: "user-1",
      schemaVersion: 1,
      data: state,
    });
    expect(client.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      schema_version: 1,
      data: state,
    });
  });

  it("upserts only the requested user snapshot on save", async () => {
    const state = createCareerOsData();
    const row = {
      user_id: "user-1",
      schema_version: 1,
      data: state,
      created_at: "2026-08-18T20:00:00.000Z",
      updated_at: "2026-08-18T20:00:01.000Z",
    };
    const client = fakeSupabase({ single: { data: row, error: null } });
    const repository = createSupabaseCareerStateRepository(client as never);

    await repository.save("user-1", state, 1);
    expect(client.upsert).toHaveBeenCalledWith(
      { user_id: "user-1", schema_version: 1, data: state },
      { onConflict: "user_id" },
    );
  });

  it("maps create and save failures to operation-specific safe errors", async () => {
    const state = createCareerOsData();
    const client = fakeSupabase({
      single: { data: null, error: { message: "private database detail" } },
    });
    const repository = createSupabaseCareerStateRepository(client as never);

    await expect(repository.create("user-1", state, 1)).rejects.toMatchObject({
      name: "CareerStatePersistenceError",
      operation: "create",
    });
    await expect(repository.save("user-1", state, 1)).rejects.toMatchObject({
      name: "CareerStatePersistenceError",
      operation: "save",
    });
  });
});
