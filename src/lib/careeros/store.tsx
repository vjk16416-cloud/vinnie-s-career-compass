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
import { writeCareerOsCache } from "./local-cache";
import { createOrderedSaveQueue } from "./ordered-save-queue";
import { createCareerOsData } from "./profile-data";
import type { ActivityEntry, CareerOsData } from "./types";

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

  const update = useCallback((fn: (draft: CareerOsData) => CareerOsData) => {
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
  }, []);

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
      resetToSeed,
    }),
    [data, hydrated, syncStatus, syncMessage, update, logActivity, resetToSeed],
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

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useCareerOs() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useCareerOs must be used inside CareerOsProvider");
  return ctx;
}
