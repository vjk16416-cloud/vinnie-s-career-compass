import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { normaliseData } from "./normalise";
import { createCareerOsData, withMasterProfileFoundation } from "./profile-data";
import { resolveClaimVariant, setProfileItemDecision } from "./profile-review";
import type { ActivityEntry, CareerOsData, CareerProfileItemStatus } from "./types";

const STORAGE_KEY = "careeros:v1";

interface StoreValue {
  data: CareerOsData;
  hydrated: boolean;
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

const StoreContext = createContext<StoreValue | null>(null);

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function CareerOsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CareerOsData>(() => createCareerOsData());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setData(withMasterProfileFoundation(normaliseData(JSON.parse(raw))));
    } catch {
      /* fall back to seed */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable */
    }
  }, [data, hydrated]);

  const update = useCallback((fn: (draft: CareerOsData) => CareerOsData) => {
    setData((prev) => fn(structuredClone(prev)));
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
    setData(createCareerOsData());
  }, []);

  const value = useMemo(
    () => ({
      data,
      hydrated,
      update,
      logActivity,
      setProfileItemStatus,
      resolveProfileVariant,
      resetToSeed,
    }),
    [data, hydrated, update, logActivity, setProfileItemStatus, resolveProfileVariant, resetToSeed],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useCareerOs() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useCareerOs must be used inside CareerOsProvider");
  return ctx;
}
