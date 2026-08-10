import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createSeedData } from "./seed";
import type { ActivityEntry, CareerOsData } from "./types";

const STORAGE_KEY = "careeros:v1";

interface StoreValue {
  data: CareerOsData;
  hydrated: boolean;
  update: (fn: (draft: CareerOsData) => CareerOsData) => void;
  logActivity: (text: string) => void;
  resetToSeed: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function CareerOsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CareerOsData>(() => createSeedData());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setData(JSON.parse(raw) as CareerOsData);
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

  const resetToSeed = useCallback(() => {
    setData(createSeedData());
  }, []);

  const value = useMemo(
    () => ({ data, hydrated, update, logActivity, resetToSeed }),
    [data, hydrated, update, logActivity, resetToSeed],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useCareerOs() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useCareerOs must be used inside CareerOsProvider");
  return ctx;
}
