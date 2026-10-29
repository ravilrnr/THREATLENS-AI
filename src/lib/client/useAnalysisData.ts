"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getDemoServerSnapshot,
  getLocalHistorySnapshot,
  getServerHistorySnapshot,
  loadDemoPreference,
  setDemoPreference,
  subscribeDemoMode,
  subscribeHistory,
} from "@/lib/persistence/localHistory";
import { buildDemoDataset } from "@/lib/demo/data";
import type { AnalysisRecord } from "@/types";

export function useLocalHistory() {
  return useSyncExternalStore(
    subscribeHistory,
    getLocalHistorySnapshot,
    getServerHistorySnapshot,
  );
}

export function useDemoMode(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(
    subscribeDemoMode,
    loadDemoPreference,
    getDemoServerSnapshot,
  );
  return [enabled, setDemoPreference];
}

const DEMO_RECORDS = buildDemoDataset();

export interface AnalysisData {
  userRecords: AnalysisRecord[];
  demoRecords: AnalysisRecord[];
  records: AnalysisRecord[];
  demoMode: boolean;
  storageAvailable: boolean;
  storageNote: string | null;
  setDemoMode: (enabled: boolean) => void;
}

/** User history and demo data always remain separate collections. */
export function useAnalysisData(): AnalysisData {
  const history = useLocalHistory();
  const [demoMode, setDemoMode] = useDemoMode();

  return useMemo(() => {
    const demoRecords = demoMode ? DEMO_RECORDS : [];
    return {
      userRecords: history.records,
      demoRecords,
      records: [...history.records, ...demoRecords].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      ),
      demoMode,
      storageAvailable: history.available,
      storageNote: history.error,
      setDemoMode,
    };
  }, [history, demoMode, setDemoMode]);
}
