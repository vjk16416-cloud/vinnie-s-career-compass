import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { bootstrapCareerState } from "./cloud-bootstrap";
import {
  CAREER_STATE_SCHEMA_VERSION,
  createSupabaseCareerStateRepository,
  type CareerStateRepository,
} from "./cloud-state.repository";
import { markCareerOsCacheCloudConfirmed, writeCareerOsCache } from "./local-cache";
import { createOrderedSaveQueue } from "./ordered-save-queue";
import { createCareerOsData } from "./profile-data";
import { resolveClaimVariant, setProfileItemDecision } from "./profile-review";
import type { ActivityEntry, CareerOsData, CareerProfileItemStatus } from "./types";

export type CareerSyncStatus =
  "loading" | "synced" | "saving" | "offline-cache" | "save-error" | "local-conflict";

interface StoreValue {
  data: CareerOsData;
  hydrated: boolean;
  syncStatus: CareerSyncStatus;
  syncMessage: string;
  canEdit: boolean;
  update: (fn: (draft: CareerOsData) => CareerOsData) => void;
  logActivity: (text: string) => void;
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
  resetToSeed: () => void;
}

type SaveQueue = {
  enqueue(value: CareerOsData): Promise<void>;
  reset(): void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function CareerOsProvider({
  userId,
  repository,
  children,
}: {
  userId: string;
  repository?: CareerStateRepository;
  children: ReactNode;
}) {
  const [data, setData] = useState<CareerOsData>(() => createCareerOsData());
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<CareerSyncStatus>("loading");
  const [syncMessage, setSyncMessage] = useState("Loading cloud data...");
  const [bootstrapError, setBootstrapError] = useState(false);
  const [localConflict, setLocalConflict] = useState<CareerOsData | null>(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const dataRef = useRef(data);
  const confirmedRef = useRef(data);
  const canEditRef = useRef(false);
  const pendingWritesRef = useRef(0);
  const saveEpochRef = useRef(0);
  const queueRef = useRef<SaveQueue | null>(null);
  const repositoryRef = useRef<CareerStateRepository | null>(repository ?? null);

  const load = useCallback(async () => {
    setBootstrapError(false);
    setHydrated(false);
    setLocalConflict(null);
    setResolvingConflict(false);
    setConflictError(null);
    setSyncStatus("loading");
    setSyncMessage("Loading cloud data...");
    canEditRef.current = false;
    pendingWritesRef.current = 0;
    saveEpochRef.current += 1;

    const activeRepository = repository ?? createSupabaseCareerStateRepository();
    repositoryRef.current = activeRepository;
    queueRef.current = createOrderedSaveQueue(async (snapshot) => {
      await activeRepository.save(userId, snapshot, CAREER_STATE_SCHEMA_VERSION);
    });

    try {
      const result = await bootstrapCareerState({
        userId,
        repository: activeRepository,
        storage: window.localStorage,
      });

      dataRef.current = result.data;
      confirmedRef.current = result.data;
      canEditRef.current = result.canEdit;
      setData(result.data);
      setHydrated(true);

      if (result.mode === "offline-cache") {
        setSyncStatus("offline-cache");
        setSyncMessage("Cloud data is temporarily unavailable. Viewing the last saved copy.");
      } else if (result.mode === "local-conflict") {
        setLocalConflict(result.pendingLocalData ?? null);
        setSyncStatus("local-conflict");
        setSyncMessage("Different local and cloud CareerOS data need your review.");
      } else {
        setSyncStatus("synced");
        setSyncMessage("Cloud synced");
      }
    } catch {
      setBootstrapError(true);
      setHydrated(false);
      setSyncStatus("loading");
      setSyncMessage("CareerOS cloud data is unavailable.");
    }
  }, [repository, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const keepCloudVersion = useCallback(() => {
    const cloud = confirmedRef.current;
    writeCareerOsCache(window.localStorage, cloud);
    markCareerOsCacheCloudConfirmed(window.localStorage, userId);
    dataRef.current = cloud;
    canEditRef.current = true;
    setData(cloud);
    setLocalConflict(null);
    setConflictError(null);
    setSyncStatus("synced");
    setSyncMessage("Cloud synced");
  }, [userId]);

  const useLocalVersion = useCallback(async () => {
    const local = localConflict;
    const activeRepository = repositoryRef.current;
    if (!local || !activeRepository || resolvingConflict) return;

    setResolvingConflict(true);
    setConflictError(null);
    setSyncStatus("saving");
    setSyncMessage("Saving this device's local version to cloud...");

    try {
      await activeRepository.save(userId, local, CAREER_STATE_SCHEMA_VERSION);
      queueRef.current?.reset();
      pendingWritesRef.current = 0;
      saveEpochRef.current += 1;
      dataRef.current = local;
      confirmedRef.current = local;
      canEditRef.current = true;
      writeCareerOsCache(window.localStorage, local);
      markCareerOsCacheCloudConfirmed(window.localStorage, userId);
      setData(local);
      setLocalConflict(null);
      setSyncStatus("synced");
      setSyncMessage("Cloud synced");
    } catch {
      canEditRef.current = false;
      setConflictError("The local version could not be saved. Nothing has been replaced.");
      setSyncStatus("local-conflict");
      setSyncMessage("Different local and cloud CareerOS data still need your review.");
    } finally {
      setResolvingConflict(false);
    }
  }, [localConflict, resolvingConflict, userId]);

  const update = useCallback(
    (fn: (draft: CareerOsData) => CareerOsData) => {
      if (!canEditRef.current) {
        toast.error("Cloud data is unavailable. Changes are disabled until sync returns.");
        return;
      }

      const queue = queueRef.current;
      if (!queue) return;

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
          markCareerOsCacheCloudConfirmed(window.localStorage, userId);
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
    },
    [userId],
  );

  const logActivity = useCallback(
    (text: string) => {
      update((draft) => {
        const entry: ActivityEntry = { id: uid("act"), at: new Date().toISOString(), text };
        draft.activity = [entry, ...draft.activity].slice(0, 40);
        return draft;
      });
    },
    [update],
  );

  const setProfileItemStatus = useCallback(
    (
      profileItemId: string,
      status: Extract<CareerProfileItemStatus, "Approved" | "Needs Evidence" | "Excluded">,
      note?: string,
    ) => {
      update((draft) => setProfileItemDecision(draft, { profileItemId, status, note }));
    },
    [update],
  );

  const resolveProfileVariant = useCallback(
    (canonicalKey: string, selectedVariantId: string, safeWording?: string, note?: string) => {
      update((draft) =>
        resolveClaimVariant(draft, {
          canonicalKey,
          selectedVariantId,
          safeWording,
          note,
        }),
      );
    },
    [update],
  );

  const resetToSeed = useCallback(() => {
    update(() => createCareerOsData());
  }, [update]);

  const value = useMemo(
    () => ({
      data,
      hydrated,
      syncStatus,
      syncMessage,
      canEdit: canEditRef.current,
      update,
      logActivity,
      setProfileItemStatus,
      resolveProfileVariant,
      resetToSeed,
    }),
    [
      data,
      hydrated,
      syncStatus,
      syncMessage,
      update,
      logActivity,
      setProfileItemStatus,
      resolveProfileVariant,
      resetToSeed,
    ],
  );

  if (bootstrapError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">CareerOS cloud data is unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No saved browser copy is available, so editing is blocked until cloud access returns.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading CareerOS...
      </div>
    );
  }

  if (localConflict) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-xl rounded-lg border border-border bg-card p-5 shadow-sm">
          <h1 className="text-lg font-semibold">Different CareerOS data found on this device</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            CareerOS found an existing cloud record and a different browser-local copy. Nothing has
            been overwritten. Choose which version should become the working copy.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">Cloud version</p>
              <p className="mt-1 text-sm">{data.profile.headline}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {data.applications.length} applications, {data.evidence.length} evidence records
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">This device</p>
              <p className="mt-1 text-sm">{localConflict.profile.headline}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {localConflict.applications.length} applications, {localConflict.evidence.length}{" "}
                evidence records
              </p>
            </div>
          </div>

          {conflictError ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {conflictError}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              disabled={resolvingConflict}
              onClick={keepCloudVersion}
            >
              Keep cloud version
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-60"
              disabled={resolvingConflict}
              onClick={() => void useLocalVersion()}
            >
              {resolvingConflict ? "Saving local version..." : "Use local version"}
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Using the local version will replace the current cloud CareerOS record only after the
            cloud save succeeds.
          </p>
        </div>
      </div>
    );
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useCareerOs() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useCareerOs must be used inside CareerOsProvider");
  return ctx;
}
