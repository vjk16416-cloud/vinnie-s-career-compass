import type { SupabaseClient } from "@supabase/supabase-js";
import { createClientOnlyFn } from "@tanstack/react-start";
import { getBrowserSupabase } from "@/lib/auth/supabase.client";
import type { CareerOsData } from "./types";

export const CAREER_STATE_SCHEMA_VERSION = 1;

export interface CareerStateRow {
  userId: string;
  schemaVersion: number;
  data: CareerOsData;
  createdAt: string;
  updatedAt: string;
}

export class CareerStatePersistenceError extends Error {
  constructor(readonly operation: "read" | "create" | "save") {
    super(`CareerOS cloud ${operation} failed`);
    this.name = "CareerStatePersistenceError";
  }
}

export interface CareerStateRepository {
  load(userId: string): Promise<CareerStateRow | null>;
  create(userId: string, data: CareerOsData, schemaVersion: number): Promise<CareerStateRow>;
  save(userId: string, data: CareerOsData, schemaVersion: number): Promise<CareerStateRow>;
}

type RawCareerStateRow = {
  user_id: string;
  schema_version: number;
  data: CareerOsData;
  created_at: string;
  updated_at: string;
};

function mapRow(raw: RawCareerStateRow): CareerStateRow {
  return {
    userId: raw.user_id,
    schemaVersion: raw.schema_version,
    data: raw.data,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export const createSupabaseCareerStateRepository = createClientOnlyFn(
  function createSupabaseCareerStateRepository(
    client: SupabaseClient = getBrowserSupabase(),
  ): CareerStateRepository {
    return {
      async load(userId) {
        const { data, error } = await client
          .from("career_state")
          .select("user_id,schema_version,data,created_at,updated_at")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw new CareerStatePersistenceError("read");
        return data ? mapRow(data as RawCareerStateRow) : null;
      },

      async create(userId, data, schemaVersion) {
        const result = await client
          .from("career_state")
          .insert({ user_id: userId, schema_version: schemaVersion, data })
          .select("user_id,schema_version,data,created_at,updated_at")
          .single();

        if (result.error || !result.data) throw new CareerStatePersistenceError("create");
        return mapRow(result.data as RawCareerStateRow);
      },

      async save(userId, data, schemaVersion) {
        const result = await client
          .from("career_state")
          .upsert(
            { user_id: userId, schema_version: schemaVersion, data },
            { onConflict: "user_id" },
          )
          .select("user_id,schema_version,data,created_at,updated_at")
          .single();

        if (result.error || !result.data) throw new CareerStatePersistenceError("save");
        return mapRow(result.data as RawCareerStateRow);
      },
    };
  },
);
