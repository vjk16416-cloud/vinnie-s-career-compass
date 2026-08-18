# CareerOS P0 Trust Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CareerOS trustworthy for daily use by moving durable state to Supabase, making auth setup failures intelligible, adding actionable evidence governance, and removing misleading CV health-check behaviour.

**Architecture:** Supabase stores one RLS-protected `career_state` JSON document per authenticated user. The existing React store remains the UI API, but bootstraps from cloud, performs a one-time localStorage migration when cloud state is absent, serialises writes, rolls back failed saves, and treats localStorage only as a confirmed cache. Profile review is ported as pure domain logic on top of the cloud-backed store; auth and CV fixes remain isolated UI/domain changes.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript, Supabase JS/SSR, PostgreSQL/RLS, Vitest, Testing Library, Tailwind/shadcn.

**Spec:** `docs/superpowers/specs/2026-08-18-p0-trust-foundation-design.md`

## Global Constraints

- Google sign-in remains the only authentication method.
- Access remains restricted to the approved CareerOS Google account.
- Supabase is authoritative after authentication; `localStorage` is cache only.
- Existing local state migrates automatically only when no cloud row exists.
- A valid cloud row always wins over browser-local state.
- Offline cache is read-only and must be visibly degraded.
- Failed cloud saves roll back to the last confirmed cloud state.
- Cloud writes use one ordered promise queue so stale snapshots cannot overwrite newer confirmed state.
- `career_state.updated_at` is maintained by a database trigger.
- No Google Client Secret or Supabase service-role key enters client code or the repository.
- PR #11 is ported conceptually onto current `main`; it is not merged blindly.
- Unapproved or excluded claims remain blocked from generated documents.
- CV health-check guidance never appends internal review notes to a CV body.
- Changed files must pass Prettier and ESLint even if unrelated repository-wide Lovable formatting debt remains.
- No em dash characters in new user-facing copy.

---

### Task 1: Create the RLS-protected cloud state repository

**Files:**
- Create: `supabase/migrations/20260818211500_create_career_state.sql`
- Create: `src/lib/careeros/cloud-state.repository.ts`
- Test: `src/lib/careeros/cloud-state.repository.test.ts`

**Interfaces:**
- Produces: `CareerStateRow`, `CareerStateRepository`, `CareerStatePersistenceError`, `createSupabaseCareerStateRepository()`.
- Later tasks consume: `repository.load(userId)`, `repository.create(userId, data, schemaVersion)`, `repository.save(userId, data, schemaVersion)`.

- [ ] **Step 1: Write repository tests before the implementation**

Create `src/lib/careeros/cloud-state.repository.test.ts` with a fake Supabase query builder that exposes `from()`, `select()`, `eq()`, `maybeSingle()`, `insert()`, `upsert()`, and `single()`. Prove load, create, save and error mapping:

```ts
it("returns null when the authenticated user has no cloud state", async () => {
  const client = fakeSupabase({ maybeSingle: { data: null, error: null } });
  const repository = createSupabaseCareerStateRepository(client as never);

  await expect(repository.load("user-1")).resolves.toBeNull();
  expect(client.from).toHaveBeenCalledWith("career_state");
});

it("maps a Supabase read error without leaking database details", async () => {
  const client = fakeSupabase({
    maybeSingle: { data: null, error: { message: "sensitive database detail" } },
  });
  const repository = createSupabaseCareerStateRepository(client as never);

  await expect(repository.load("user-1")).rejects.toMatchObject({
    name: "CareerStatePersistenceError",
    operation: "read",
  });
});

it("upserts only the requested user snapshot on save", async () => {
  const state = createCareerOsData();
  const client = fakeSupabase({
    single: {
      data: {
        user_id: "user-1",
        schema_version: 1,
        data: state,
        created_at: "2026-08-18T20:00:00.000Z",
        updated_at: "2026-08-18T20:00:01.000Z",
      },
      error: null,
    },
  });
  const repository = createSupabaseCareerStateRepository(client as never);

  await repository.save("user-1", state, 1);
  expect(client.query.upsert).toHaveBeenCalledWith(
    { user_id: "user-1", schema_version: 1, data: state },
    { onConflict: "user_id" },
  );
});
```

The fake should return the same `query` object from every builder method so chain assertions are deterministic.

- [ ] **Step 2: Run the repository test and verify red**

```bash
npm test -- src/lib/careeros/cloud-state.repository.test.ts
```

Expected: FAIL because `cloud-state.repository.ts` does not exist.

- [ ] **Step 3: Add the database migration**

Create `supabase/migrations/20260818211500_create_career_state.sql`:

```sql
create table if not exists public.career_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version > 0),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.career_state enable row level security;

revoke all on table public.career_state from anon;
grant select, insert, update on table public.career_state to authenticated;

drop policy if exists "career_state_select_own" on public.career_state;
create policy "career_state_select_own"
on public.career_state
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "career_state_insert_own" on public.career_state;
create policy "career_state_insert_own"
on public.career_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "career_state_update_own" on public.career_state;
create policy "career_state_update_own"
on public.career_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.set_career_state_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists career_state_set_updated_at on public.career_state;
create trigger career_state_set_updated_at
before update on public.career_state
for each row
execute function public.set_career_state_updated_at();
```

Do not add a delete policy in P0.

- [ ] **Step 4: Implement the repository boundary**

Create `src/lib/careeros/cloud-state.repository.ts` with this public shape and a typed internal database-row mapper:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/auth/supabase.client";
import type { CareerOsData } from "./types";

export const CAREER_STATE_SCHEMA_VERSION = 1;

type CareerStateDbRow = {
  user_id: string;
  schema_version: number;
  data: unknown;
  created_at: string;
  updated_at: string;
};

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

function mapRow(raw: CareerStateDbRow): CareerStateRow {
  return {
    userId: raw.user_id,
    schemaVersion: raw.schema_version,
    data: raw.data as CareerOsData,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function createSupabaseCareerStateRepository(
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
      return data ? mapRow(data as CareerStateDbRow) : null;
    },
    async create(userId, data, schemaVersion) {
      const result = await client
        .from("career_state")
        .insert({ user_id: userId, schema_version: schemaVersion, data })
        .select("user_id,schema_version,data,created_at,updated_at")
        .single();
      if (result.error || !result.data) throw new CareerStatePersistenceError("create");
      return mapRow(result.data as CareerStateDbRow);
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
      return mapRow(result.data as CareerStateDbRow);
    },
  };
}
```

Keep raw Supabase error objects out of thrown messages.

- [ ] **Step 5: Run repository tests and TypeScript formatting**

```bash
npm test -- src/lib/careeros/cloud-state.repository.test.ts
npx prettier --check src/lib/careeros/cloud-state.repository.ts src/lib/careeros/cloud-state.repository.test.ts
```

Expected: all tests PASS and TypeScript files are formatted. Do not pass SQL files to Prettier because this project has no SQL parser plugin.

- [ ] **Step 6: Commit Task 1**

```bash
git add supabase/migrations/20260818211500_create_career_state.sql src/lib/careeros/cloud-state.repository.ts src/lib/careeros/cloud-state.repository.test.ts
git commit -m "feat: add secure CareerOS cloud state repository"
```

---

### Task 2: Bootstrap cloud state and migrate local data exactly once

**Files:**
- Create: `src/lib/careeros/local-cache.ts`
- Create: `src/lib/careeros/cloud-bootstrap.ts`
- Test: `src/lib/careeros/cloud-bootstrap.test.ts`

**Interfaces:**
- Consumes: `CareerStateRepository`, `CAREER_STATE_SCHEMA_VERSION` from Task 1.
- Produces: `bootstrapCareerState(input): Promise<CareerStateBootstrapResult>` and local cache helpers.

- [ ] **Step 1: Write bootstrap tests for every source-of-truth case**

Create `src/lib/careeros/cloud-bootstrap.test.ts` with an in-memory `Storage` fake and mocked `CareerStateRepository`. Cover cloud wins, one-time local migration, seed creation, invalid local JSON, read-only cache fallback, and idempotent repeated bootstrap:

```ts
it("prefers an existing cloud row over a different local cache", async () => {
  const cloud = createCareerOsData();
  cloud.profile.headline = "Cloud headline";
  const local = createCareerOsData();
  local.profile.headline = "Old local headline";
  const storage = storageWith(local);
  const repository = repositoryWith({ load: cloudRow(cloud) });

  const result = await bootstrapCareerState({ userId: "user-1", repository, storage });

  expect(result.mode).toBe("synced");
  expect(result.source).toBe("cloud");
  expect(result.data.profile.headline).toBe("Cloud headline");
  expect(repository.create).not.toHaveBeenCalled();
});

it("migrates valid local state only when cloud state is absent", async () => {
  const local = createCareerOsData();
  local.profile.headline = "Migrated local headline";
  const storage = storageWith(local);
  const repository = repositoryWith({ load: null });

  const result = await bootstrapCareerState({ userId: "user-1", repository, storage });

  expect(repository.create).toHaveBeenCalledOnce();
  expect(repository.create).toHaveBeenCalledWith(
    "user-1",
    expect.objectContaining({ profile: expect.objectContaining({ headline: "Migrated local headline" }) }),
    CAREER_STATE_SCHEMA_VERSION,
  );
  expect(result.source).toBe("local-migration");
});

it("uploads seed data when neither cloud nor local state exists", async () => {
  const storage = emptyStorage();
  const repository = repositoryWith({ load: null });

  const result = await bootstrapCareerState({ userId: "user-1", repository, storage });

  expect(result.source).toBe("seed");
  expect(repository.create).toHaveBeenCalledOnce();
});

it("falls back to a valid cache in read-only mode when cloud load fails", async () => {
  const storage = storageWith(createCareerOsData());
  const repository = repositoryThatFailsToLoad();

  const result = await bootstrapCareerState({ userId: "user-1", repository, storage });

  expect(result.mode).toBe("offline-cache");
  expect(result.canEdit).toBe(false);
});
```

- [ ] **Step 2: Run bootstrap tests and verify red**

```bash
npm test -- src/lib/careeros/cloud-bootstrap.test.ts
```

Expected: FAIL because the bootstrap module does not exist.

- [ ] **Step 3: Implement cache helpers**

Create `src/lib/careeros/local-cache.ts`:

```ts
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
```

- [ ] **Step 4: Implement bootstrap rules**

Create `src/lib/careeros/cloud-bootstrap.ts` with:

```ts
export type CareerStateBootstrapResult = {
  data: CareerOsData;
  mode: "synced" | "offline-cache";
  source: "cloud" | "local-migration" | "seed" | "cache-fallback";
  canEdit: boolean;
};
```

Use this exact source-of-truth order:

```ts
export async function bootstrapCareerState({ userId, repository, storage }: BootstrapInput) {
  const local = readCareerOsCache(storage);

  let cloud;
  try {
    cloud = await repository.load(userId);
  } catch {
    if (!local) throw new CareerStateBootstrapError("cloud-unavailable-no-cache");
    return { data: local, mode: "offline-cache", source: "cache-fallback", canEdit: false } as const;
  }

  if (cloud) {
    const data = withMasterProfileFoundation(normaliseData(cloud.data));
    writeCareerOsCache(storage, data);
    return { data, mode: "synced", source: "cloud", canEdit: true } as const;
  }

  const initial = local ?? createCareerOsData();
  const confirmed = await repository.create(userId, initial, CAREER_STATE_SCHEMA_VERSION);
  const data = withMasterProfileFoundation(normaliseData(confirmed.data));
  writeCareerOsCache(storage, data);
  return {
    data,
    mode: "synced",
    source: local ? "local-migration" : "seed",
    canEdit: true,
  } as const;
}
```

`CareerStateBootstrapError` exposes only the reason code `cloud-unavailable-no-cache` and public message `CareerOS cloud data is unavailable`.

- [ ] **Step 5: Run bootstrap and existing profile migration tests**

```bash
npm test -- src/lib/careeros/cloud-bootstrap.test.ts src/lib/careeros/profile-foundation.test.ts src/lib/careeros/profile-data.master.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/lib/careeros/local-cache.ts src/lib/careeros/cloud-bootstrap.ts src/lib/careeros/cloud-bootstrap.test.ts
git commit -m "feat: migrate CareerOS browser state to cloud"
```

---

### Task 3: Replace localStorage authority with an ordered cloud-backed store

**Files:**
- Create: `src/lib/careeros/ordered-save-queue.ts`
- Test: `src/lib/careeros/ordered-save-queue.test.ts`
- Modify: `src/lib/careeros/store.tsx`
- Test: `src/lib/careeros/store.cloud.test.tsx`
- Modify: `src/lib/auth/auth-context.tsx`
- Test: `src/components/auth/account-shell.integration.test.tsx`

**Interfaces:**
- Consumes: `bootstrapCareerState`, `CareerStateRepository`, `createSupabaseCareerStateRepository`, cache helpers.
- Produces through `useCareerOs()`: `data`, `hydrated`, `syncStatus`, `syncMessage`, `canEdit`, `update`, `logActivity`, `resetToSeed` plus later profile review actions.

- [ ] **Step 1: Write ordered-save-queue tests**

```ts
it("never starts snapshot 2 before snapshot 1 settles", async () => {
  const first = deferred<void>();
  const calls: number[] = [];
  const queue = createOrderedSaveQueue(async (value: number) => {
    calls.push(value);
    if (value === 1) await first.promise;
  });

  const one = queue.enqueue(1);
  const two = queue.enqueue(2);
  await Promise.resolve();
  expect(calls).toEqual([1]);

  first.resolve();
  await Promise.all([one, two]);
  expect(calls).toEqual([1, 2]);
});

it("rejects queued snapshots after a failed save instead of writing stale descendants", async () => {
  const save = vi.fn(async (value: number) => {
    if (value === 1) throw new Error("network");
  });
  const queue = createOrderedSaveQueue(save);

  const one = queue.enqueue(1);
  const two = queue.enqueue(2);

  await expect(one).rejects.toThrow();
  await expect(two).rejects.toThrow();
  expect(save).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run queue tests and verify red**

```bash
npm test -- src/lib/careeros/ordered-save-queue.test.ts
```

Expected: FAIL because the queue does not exist.

- [ ] **Step 3: Implement the queue**

Create `src/lib/careeros/ordered-save-queue.ts`:

```ts
export function createOrderedSaveQueue<T>(save: (value: T) => Promise<void>) {
  let tail: Promise<void> = Promise.resolve();
  let failed: unknown = null;

  return {
    enqueue(value: T): Promise<void> {
      const next = tail.then(async () => {
        if (failed) throw failed;
        try {
          await save(value);
        } catch (error) {
          failed = error;
          throw error;
        }
      });
      tail = next.catch(() => undefined);
      return next;
    },
    reset() {
      failed = null;
    },
  };
}
```

- [ ] **Step 4: Write cloud-store behaviour tests before changing the provider**

Create `src/lib/careeros/store.cloud.test.tsx`. Mount `CareerOsProvider` with a fake repository and a probe component that reads `syncStatus`, `data`, `canEdit`, and calls `update` from buttons. Test all four trust behaviours:

```tsx
it("does not update durable cache until the cloud save succeeds", async () => {
  const save = deferred<CareerStateRow>();
  const repository = repositoryWithDeferredSave(save);
  renderStore(repository);
  await screen.findByText("synced");

  fireEvent.click(screen.getByRole("button", { name: "Change headline" }));
  expect(screen.getByText("saving")).toBeInTheDocument();
  expect(readCareerOsCache(window.localStorage)?.profile.headline).not.toBe("Changed headline");

  save.resolve(cloudRowWithHeadline("Changed headline"));
  await screen.findByText("synced");
  expect(readCareerOsCache(window.localStorage)?.profile.headline).toBe("Changed headline");
});

it("rolls back to the last confirmed state when a save fails", async () => {
  const repository = repositoryThatRejectsSave();
  renderStore(repository);
  await screen.findByText("synced");

  fireEvent.click(screen.getByRole("button", { name: "Change headline" }));

  await screen.findByText("save-error");
  expect(screen.getByTestId("headline")).toHaveTextContent("Performance Marketing");
});

it("stays in saving state until every queued snapshot is confirmed", async () => {
  const saves = deferredSaveSequence(2);
  renderStore(saves.repository);
  await screen.findByText("synced");

  fireEvent.click(screen.getByRole("button", { name: "Change headline" }));
  fireEvent.click(screen.getByRole("button", { name: "Change location" }));
  saves.resolve(0);

  expect(screen.getByText("saving")).toBeInTheDocument();
  saves.resolve(1);
  await screen.findByText("synced");
});

it("refuses mutations while using an offline cache", async () => {
  renderStore(repositoryThatFailsToLoad(), storageWith(createCareerOsData()));
  await screen.findByText("offline-cache");

  fireEvent.click(screen.getByRole("button", { name: "Change headline" }));
  expect(screen.getByTestId("headline")).not.toHaveTextContent("Changed headline");
});
```

- [ ] **Step 5: Rewrite store bootstrap around the authenticated user**

Change `CareerOsProvider` to accept `userId: string` and optional `repository?: CareerStateRepository`. Bootstrap with `bootstrapCareerState({ userId, repository, storage: window.localStorage })` after mount and do not render mutable route children until bootstrap completes.

Use this sync contract:

```ts
export type CareerSyncStatus =
  | "loading"
  | "synced"
  | "saving"
  | "offline-cache"
  | "save-error";

interface StoreValue {
  data: CareerOsData;
  hydrated: boolean;
  syncStatus: CareerSyncStatus;
  syncMessage: string;
  canEdit: boolean;
  update: (fn: (draft: CareerOsData) => CareerOsData) => void;
  logActivity: (text: string) => void;
  resetToSeed: () => void;
}
```

Keep these refs: `dataRef`, `confirmedRef`, `canEditRef`, `pendingWritesRef`, and `saveEpochRef`. Build one `createOrderedSaveQueue()` whose save callback calls `repository.save(userId, snapshot, CAREER_STATE_SCHEMA_VERSION)`.

For every `update(fn)` use this algorithm:

```ts
if (!canEditRef.current) {
  toast.error("Cloud data is unavailable. Changes are disabled until sync returns.");
  return;
}

const next = fn(structuredClone(dataRef.current));
const epoch = saveEpochRef.current;
dataRef.current = next;
pendingWritesRef.current += 1;
setData(next);
setSyncStatus("saving");
setSyncMessage("Saving to cloud...");

void queue.enqueue(next).then(
  () => {
    if (epoch !== saveEpochRef.current) return;
    pendingWritesRef.current -= 1;
    confirmedRef.current = next;
    writeCareerOsCache(window.localStorage, next);
    if (pendingWritesRef.current === 0) {
      setSyncStatus("synced");
      setSyncMessage("Cloud synced");
    }
  },
  () => {
    if (epoch !== saveEpochRef.current) return;
    saveEpochRef.current += 1;
    pendingWritesRef.current = 0;
    queue.reset();
    dataRef.current = confirmedRef.current;
    setData(confirmedRef.current);
    setSyncStatus("save-error");
    setSyncMessage("The last change could not be saved and was restored.");
  },
);
```

This epoch guard ensures only the first rejection from a failed queue performs the rollback; later rejected descendants from the failed queue are ignored.

For `offline-cache`, set `canEditRef.current = false`, `syncStatus = "offline-cache"`, and `syncMessage = "Cloud data is temporarily unavailable. Viewing the last saved copy."`.

For bootstrap failure without cache, render a blocking error state with `Retry`; do not render seeded mutable data.

Change `resetToSeed()` to call `update(() => createCareerOsData())`, so reset is cloud-persisted rather than a local-only state mutation.

- [ ] **Step 6: Pass the authenticated user ID into the provider**

Update `PrivateCareerOsProvider`:

```tsx
<AuthUserProvider user={authUser}>
  <CareerOsProvider userId={authUser.id}>{children}</CareerOsProvider>
</AuthUserProvider>
```

No unauthenticated route should instantiate the cloud store.

- [ ] **Step 7: Keep the private-shell integration test network-free**

In `src/components/auth/account-shell.integration.test.tsx`, mock `@/lib/careeros/cloud-state.repository` so `createSupabaseCareerStateRepository()` returns a fake repository whose `load()` resolves a cloud row and whose `save()` resolves the same shape. Assert private content is absent while bootstrap is pending and appears after the cloud row resolves.

- [ ] **Step 8: Run focused store/auth tests**

```bash
npm test -- src/lib/careeros/ordered-save-queue.test.ts src/lib/careeros/store.cloud.test.tsx src/lib/careeros/cloud-bootstrap.test.ts src/components/auth/account-shell.integration.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```bash
git add src/lib/careeros/ordered-save-queue.ts src/lib/careeros/ordered-save-queue.test.ts src/lib/careeros/store.tsx src/lib/careeros/store.cloud.test.tsx src/lib/auth/auth-context.tsx src/components/auth/account-shell.integration.test.tsx
git commit -m "feat: make Supabase authoritative for CareerOS state"
```

---

### Task 4: Make auth setup and sync state truthful in the UI

**Files:**
- Modify: `src/lib/auth/oauth.functions.ts`
- Test: `src/lib/auth/oauth.functions.test.ts`
- Modify: `src/components/auth/login-card.tsx`
- Test: `src/components/auth/login-card.test.tsx`
- Modify: `src/components/careeros/app-shell.tsx`

**Interfaces:**
- Consumes: `useCareerOs().syncStatus` and `syncMessage` from Task 3.
- Produces: safe provider-disabled error copy and truthful shell sync indicator.

- [ ] **Step 1: Add a red test for the exact Supabase provider-disabled failure**

```ts
it("maps a disabled Google provider to a setup message without exposing raw Supabase JSON", async () => {
  const providerError = Object.assign(new Error("Unsupported provider: provider is not enabled"), {
    code: "validation_failed",
  });
  const { supabase } = createBrowserSupabase(providerError);

  const result = await startGoogleSignIn("/", () => supabase as never);

  expect(result).toEqual({ error: GOOGLE_PROVIDER_SETUP_ERROR });
  expect(result.error).not.toContain("validation_failed");
  expect(result.error).not.toContain("Unsupported provider");
});
```

- [ ] **Step 2: Run auth test and verify red**

```bash
npm test -- src/lib/auth/oauth.functions.test.ts
```

Expected: FAIL because `GOOGLE_PROVIDER_SETUP_ERROR` and the classifier do not exist.

- [ ] **Step 3: Implement safe auth error classification**

In `oauth.functions.ts` add:

```ts
export const GOOGLE_PROVIDER_SETUP_ERROR =
  "Google Sign-In is not enabled yet. Finish the CareerOS Google setup, then try again.";

function googleSignInError(error: unknown): string {
  const value = error as { code?: unknown; message?: unknown } | null;
  const code = typeof value?.code === "string" ? value.code : "";
  const message = typeof value?.message === "string" ? value.message : "";
  if (code === "validation_failed" && /unsupported provider|provider.*not enabled/i.test(message)) {
    return GOOGLE_PROVIDER_SETUP_ERROR;
  }
  return GOOGLE_SIGN_IN_ERROR;
}
```

Change OAuth initiation to `return { error: error ? googleSignInError(error) : null };`. Keep thrown configuration errors mapped to `GOOGLE_SIGN_IN_ERROR`.

- [ ] **Step 4: Keep login UX Google-only and cover setup state**

Extend `login-card.test.tsx` so an injected `startSignIn` returning `GOOGLE_PROVIDER_SETUP_ERROR` displays only the friendly message and still renders exactly one Google sign-in button. Existing assertions that password, magic-link and sign-up controls are absent must remain.

- [ ] **Step 5: Replace the static local-data footer with sync truth**

In `app-shell.tsx`, call `useCareerOs()` and derive:

```ts
const syncLabel =
  syncStatus === "saving"
    ? "Saving to cloud..."
    : syncStatus === "offline-cache"
      ? "Cloud unavailable: cached copy"
      : syncStatus === "save-error"
        ? "Last change restored after save failure"
        : "Cloud synced";
```

Replace `Data source: Local seeded data / No external systems connected.` with `Data: {syncLabel}`. For `offline-cache` and `save-error`, render `syncMessage` in a compact warning banner above `<main>` using text plus semantic colour.

- [ ] **Step 6: Run auth tests and targeted lint**

```bash
npm test -- src/lib/auth/oauth.functions.test.ts src/components/auth/login-card.test.tsx src/components/auth/account-shell.integration.test.tsx
npx eslint src/lib/auth/oauth.functions.ts src/lib/auth/oauth.functions.test.ts src/components/auth/login-card.tsx src/components/auth/login-card.test.tsx src/components/careeros/app-shell.tsx
```

Expected: PASS with no new lint errors.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/lib/auth/oauth.functions.ts src/lib/auth/oauth.functions.test.ts src/components/auth/login-card.tsx src/components/auth/login-card.test.tsx src/components/careeros/app-shell.tsx
git commit -m "fix: surface CareerOS auth and sync state truthfully"
```

---

### Task 5: Port actionable profile governance onto the cloud-backed store

**Files:**
- Modify: `src/lib/careeros/types.ts`
- Create: `src/lib/careeros/profile-review.ts`
- Create: `src/lib/careeros/profile-review.test.ts`
- Modify: `src/lib/careeros/profile-data.ts`
- Modify: `src/lib/careeros/store.tsx`
- Create: `src/components/careeros/evidence-review-panel.tsx`
- Modify: `src/routes/profile.tsx`
- Modify/Test: `src/lib/careeros/generate.profile.test.ts`

**Interfaces:**
- Produces: `CareerProfileDecision`, `setProfileItemDecision()`, `resolveClaimVariant()`, `profileDecisions()`.
- Extends `useCareerOs()` with `setProfileItemStatus()` and `resolveProfileVariant()`.
- All decisions persist automatically through the Task 3 cloud store.

- [ ] **Step 1: Port the PR #11 domain tests first**

Create `profile-review.test.ts` from the proven PR #11 assertions:

```ts
const reviewed = setProfileItemDecision(data, {
  profileItemId: "pi-google-pm-certificate",
  status: "Approved",
  note: "User supplied the full certificate evidence.",
  at: "2026-08-18T12:45:00.000Z",
});
expect(reviewed.profileDecisions?.[0]).toMatchObject({
  action: "Approve",
  previousStatus: "Conflict",
  newStatus: "Approved",
});
```

and:

```ts
const resolved = resolveClaimVariant(data, {
  canonicalKey: "nas-donor-base",
  selectedVariantId: "nas-donor-23",
  safeWording: "Increased the donor base by 23%.",
  at: "2026-08-18T12:46:00.000Z",
});
expect(resolved.profileItems?.find((item) => item.id === "resolved-nas-donor-base"))
  .toMatchObject({ status: "Approved", safeWording: "Increased the donor base by 23%." });
```

Also preserve the foundation rehydration test so stored decisions survive `withMasterProfileFoundation()`.

- [ ] **Step 2: Run profile review tests and verify red**

```bash
npm test -- src/lib/careeros/profile-review.test.ts
```

Expected: FAIL because the review module/types are absent on the P0 branch.

- [ ] **Step 3: Add decision types to the canonical type model**

Add to `types.ts`:

```ts
export type ProfileDecisionAction = "Approve" | "Needs Evidence" | "Exclude" | "Resolve Conflict";
export type ProfileDecisionTarget = "Profile Item" | "Claim Variant";

export interface CareerProfileDecision {
  id: string;
  at: string;
  action: ProfileDecisionAction;
  targetType: ProfileDecisionTarget;
  profileItemId?: string;
  canonicalKey?: string;
  selectedVariantId?: string;
  previousStatus?: CareerProfileItemStatus;
  newStatus: CareerProfileItemStatus;
  sourceIds: string[];
  note?: string;
}
```

Add `profileDecisions?: CareerProfileDecision[]` to `CareerOsData`.

- [ ] **Step 4: Port the pure review logic**

Create `profile-review.ts` from PR #11, importing all model types from `./types`. Preserve deterministic `resolved-${canonicalKey}` IDs, approval/conflict status updates, provenance, decision history, profile version history and activity history.

- [ ] **Step 5: Preserve decisions through the master-profile foundation**

Update `withMasterProfileFoundation()` so the returned type guarantees `profileDecisions: CareerProfileDecision[]` and assigns `data.profileDecisions ?? []`. Do not reset stored review decisions when seeded profile data evolves.

- [ ] **Step 6: Add cloud-store review actions**

Extend the Task 3 store interface with:

```ts
setProfileItemStatus: (
  profileItemId: string,
  status: Extract<CareerProfileItemStatus, "Approved" | "Needs Evidence" | "Excluded">,
  note?: string,
) => void;
resolveProfileVariant: (
  canonicalKey: string,
  selectedVariantId: string,
  safeWording?: string,
  note?: string,
) => void;
```

Implement them only through `update()`, so review decisions inherit cloud persistence and rollback behaviour.

- [ ] **Step 7: Add the actionable review panel**

Create `evidence-review-panel.tsx` from the PR #11 panel. Use human-readable conflict headings:

```tsx
const variants = variantGroups.get(key) ?? [];
const conflictLabel = variants[0]?.label ?? "Conflicting career claim";
<p className="font-medium text-foreground">{conflictLabel}</p>
```

Keep source IDs as supporting text. Buttons are `Approve`, `Needs evidence`, `Exclude`, and `Resolve with this wording`. Do not render the resolve action for excluded variants.

- [ ] **Step 8: Replace passive Profile conflict panels**

In `src/routes/profile.tsx`, render `<EvidenceReviewPanel />` after Summary/coverage and remove the duplicate passive `Approval layer` and `Conflicting source variants` panels.

- [ ] **Step 9: Port the generator boundary regression**

Extend `generate.profile.test.ts` so unresolved conflict wording remains absent from generated CV/cover-letter content, while a resolved or explicitly approved safe wording becomes eligible only through the existing approved-profile and verified-evidence gates.

- [ ] **Step 10: Run profile and generator tests**

```bash
npm test -- src/lib/careeros/profile-review.test.ts src/lib/careeros/generate.profile.test.ts src/lib/careeros/profile-data.master.test.ts src/lib/careeros/profile-foundation.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit Task 5**

```bash
git add src/lib/careeros/types.ts src/lib/careeros/profile-review.ts src/lib/careeros/profile-review.test.ts src/lib/careeros/profile-data.ts src/lib/careeros/store.tsx src/components/careeros/evidence-review-panel.tsx src/routes/profile.tsx src/lib/careeros/generate.profile.test.ts
git commit -m "feat: make career evidence review actionable"
```

---

### Task 6: Remove the misleading CV health-check apply action

**Files:**
- Create: `src/components/careeros/cv-health-check-panel.tsx`
- Test: `src/components/careeros/cv-health-check-panel.test.tsx`
- Modify: `src/routes/applications.$id.tsx`

**Interfaces:**
- `CvHealthCheckPanel` consumes `health` plus `onRegenerate()` and never receives a callback that mutates raw CV body text.

- [ ] **Step 1: Write a focused component regression test**

Use `fireEvent` from `@testing-library/react`, which is already installed through the existing Testing Library dependency:

```tsx
it("presents health suggestions as guidance and never claims to apply them", () => {
  const onRegenerate = vi.fn();
  render(<CvHealthCheckPanel health={healthFixture()} onRegenerate={onRegenerate} />);

  expect(screen.queryByRole("button", { name: /approve suggestions/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/review notes accepted/i)).not.toBeInTheDocument();
  expect(screen.getByText("Suggested refinements")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Create fresh draft" }));
  expect(onRegenerate).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the component test and verify red**

```bash
npm test -- src/components/careeros/cv-health-check-panel.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Extract the health-check presentation**

Move the score bars, missing keywords, weak bullets, unsupported claims, formatting checks and suggestions into `CvHealthCheckPanel`.

The bottom action is exactly:

```tsx
<div className="mt-4 flex flex-wrap items-center gap-2">
  <Button size="sm" onClick={onRegenerate}>Create fresh draft</Button>
  <p className="text-xs text-muted-foreground">
    Suggestions are guidance only. A fresh draft is regenerated from approved profile items and verified evidence.
  </p>
</div>
```

There is no `Approve suggestions and save new version` action.

- [ ] **Step 4: Delete the contaminating `applySuggestions()` code path**

Remove the function that builds:

```ts
`${latestCvBody}\n\n<!-- Review notes accepted ... -->\n${notes}`
```

Replace the inline health-check panel in `applications.$id.tsx` with:

```tsx
{cv && healthOpen && health ? (
  <CvHealthCheckPanel health={health} onRegenerate={generateCv} />
) : null}
```

`generateCv()` remains the only route to a new CV body and continues to use `buildTailoredCv()` with verified/approved inputs.

- [ ] **Step 5: Run CV and generator regressions**

```bash
npm test -- src/components/careeros/cv-health-check-panel.test.tsx src/lib/careeros/generate.profile.test.ts
! grep -R "Review notes accepted" src
```

Expected: tests PASS and grep exits 0 because the internal marker no longer exists.

- [ ] **Step 6: Commit Task 6**

```bash
git add src/components/careeros/cv-health-check-panel.tsx src/components/careeros/cv-health-check-panel.test.tsx 'src/routes/applications.$id.tsx'
git commit -m "fix: keep CV health guidance out of document bodies"
```

---

### Task 7: Apply the database migration, verify security, and run release gates

**Files:**
- No feature files should be added in this task unless verification finds a defect.
- Update the implementation plan only if recording verified commands/results is useful.

**Interfaces:**
- Consumes all prior tasks.
- Produces a verified P0 branch and implementation PR. It does not merge to `main` without explicit user approval.

- [ ] **Step 1: Run the full automated test suite**

```bash
npm test
```

Expected: all test files and tests pass.

- [ ] **Step 2: Run changed-file formatting and lint**

```bash
npx prettier --check \
  src/lib/careeros/cloud-state.repository.ts \
  src/lib/careeros/cloud-state.repository.test.ts \
  src/lib/careeros/local-cache.ts \
  src/lib/careeros/cloud-bootstrap.ts \
  src/lib/careeros/cloud-bootstrap.test.ts \
  src/lib/careeros/ordered-save-queue.ts \
  src/lib/careeros/ordered-save-queue.test.ts \
  src/lib/careeros/store.tsx \
  src/lib/careeros/store.cloud.test.tsx \
  src/lib/careeros/types.ts \
  src/lib/careeros/profile-review.ts \
  src/lib/careeros/profile-review.test.ts \
  src/components/careeros/app-shell.tsx \
  src/components/careeros/evidence-review-panel.tsx \
  src/components/careeros/cv-health-check-panel.tsx \
  src/components/careeros/cv-health-check-panel.test.tsx \
  src/lib/auth/oauth.functions.ts \
  src/lib/auth/oauth.functions.test.ts \
  src/components/auth/login-card.tsx \
  src/components/auth/login-card.test.tsx \
  src/routes/profile.tsx \
  'src/routes/applications.$id.tsx'

npx eslint \
  src/lib/careeros/cloud-state.repository.ts \
  src/lib/careeros/cloud-state.repository.test.ts \
  src/lib/careeros/local-cache.ts \
  src/lib/careeros/cloud-bootstrap.ts \
  src/lib/careeros/cloud-bootstrap.test.ts \
  src/lib/careeros/ordered-save-queue.ts \
  src/lib/careeros/ordered-save-queue.test.ts \
  src/lib/careeros/store.tsx \
  src/lib/careeros/store.cloud.test.tsx \
  src/lib/careeros/types.ts \
  src/lib/careeros/profile-review.ts \
  src/lib/careeros/profile-review.test.ts \
  src/components/careeros/app-shell.tsx \
  src/components/careeros/evidence-review-panel.tsx \
  src/components/careeros/cv-health-check-panel.tsx \
  src/components/careeros/cv-health-check-panel.test.tsx \
  src/lib/auth/oauth.functions.ts \
  src/lib/auth/oauth.functions.test.ts \
  src/components/auth/login-card.tsx \
  src/components/auth/login-card.test.tsx \
  src/routes/profile.tsx \
  'src/routes/applications.$id.tsx'
```

Expected: no P0 formatting or lint errors. SQL is not passed to Prettier. Existing unrelated repository-wide Lovable formatting debt is reported separately if `npm run lint` still fails.

- [ ] **Step 3: Build production output**

```bash
npm run build
```

Expected: production Vite/Nitro build succeeds.

- [ ] **Step 4: Apply the Supabase migration using the connected project tool**

Apply the exact SQL from `supabase/migrations/20260818211500_create_career_state.sql` to project `gieehxdyzcrrmgxnfsxs` with migration name `create_career_state`.

After application, list `public.career_state` and confirm RLS is enabled, primary key is `user_id`, `data` is non-null `jsonb`, `schema_version` is non-null integer, and timestamps exist.

- [ ] **Step 5: Run Supabase security advisors**

Check security advisors for project `gieehxdyzcrrmgxnfsxs`. Any finding caused by the new table or policies is blocking. Pre-existing unrelated findings are reported separately with their remediation references.

- [ ] **Step 6: Create a P0 pull request without merging**

Create a PR from `agent/p0-trust-foundation` to `main` titled:

```text
Make CareerOS cloud-persistent and evidence-safe
```

The PR body includes one-time migration semantics, RLS ownership, rollback-on-save-failure behaviour, Google-provider setup messaging, profile-governance port from PR #11, CV contamination fix, exact verification results, and any remaining external Google-provider blocker.

- [ ] **Step 7: Verify the published build only after code verification**

Publish through the existing Lovable project only after Tasks 1 to 6 and Steps 1 to 5 pass. Confirm the published project is built from the P0 head commit before manual testing.

- [ ] **Step 8: Complete manual trust checks**

1. Google OAuth sign-in succeeds with the approved account after the provider is externally enabled.
2. First login with no cloud row imports existing `careeros:v1` data once.
3. A fresh browser session loads the same cloud state without relying on the original browser cache.
4. A profile decision persists after reload and changes generator eligibility exactly as expected.
5. CV health-check UI contains no `Review notes accepted` content and produces a fresh generated CV only through `Create fresh draft`.
6. If cloud reads are intentionally blocked, the cached workspace is visibly degraded and store mutations are refused.

If Google provider configuration is still incomplete, stop only the OAuth manual gate and report it as an external operational blocker. Do not misrepresent the rest of P0 verification as failed.

- [ ] **Step 9: Final verification commit only if documentation changed**

If verification results were written into the plan or docs:

```bash
git add docs/superpowers/plans/2026-08-18-p0-trust-foundation.md
git commit -m "docs: record P0 trust verification"
```

Otherwise do not create an empty commit.
