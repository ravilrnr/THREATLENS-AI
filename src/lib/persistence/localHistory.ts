"use client";

import type { AnalysisRecord } from "@/types";

const HISTORY_KEY = "threatlens.history.v1";
const DEMO_MODE_KEY = "threatlens.demo-mode.v1";
const MAX_RECORDS = 40;
const EVENT_NAME = "threatlens:history-changed";
const EMPTY: AnalysisRecord[] = [];

interface StoredHistory {
  version: 1;
  updatedAt: string;
  records: AnalysisRecord[];
}

export interface HistorySnapshot {
  records: AnalysisRecord[];
  available: boolean;
  error: string | null;
  storageLabel: string;
}

let cache: HistorySnapshot = {
  records: EMPTY,
  available: true,
  error: null,
  storageLabel: "Browser-local history (this device only)",
};
let initialized = false;
let demoCache = false;
let demoInitialized = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function storage(): Storage | null {
  if (!isBrowser()) return null;
  try {
    const probe = "__threatlens_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

function isAnalysisRecord(value: unknown): value is AnalysisRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AnalysisRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.input === "string" &&
    typeof record.normalized === "string" &&
    (record.indicatorType === "url" ||
      record.indicatorType === "ipv4" ||
      record.indicatorType === "domain") &&
    Array.isArray(record.findings) &&
    Array.isArray(record.audit) &&
    Array.isArray(record.checklist) &&
    typeof record.createdAt === "string" &&
    typeof record.score === "number" &&
    record.demo !== true
  );
}

function readFromStorage(): HistorySnapshot {
  const store = storage();
  if (!store) {
    return {
      records: EMPTY,
      available: false,
      error:
        "Browser storage is unavailable. Analysis history will not persist on this device.",
      storageLabel: "Storage unavailable",
    };
  }
  const raw = store.getItem(HISTORY_KEY);
  if (!raw) {
    return {
      records: EMPTY,
      available: true,
      error: null,
      storageLabel: "Browser-local history (this device only)",
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredHistory>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.records)) {
      throw new Error("Unexpected history shape");
    }
    const records = parsed.records
      .filter(isAnalysisRecord)
      .slice(0, MAX_RECORDS);
    return {
      records,
      available: true,
      error: null,
      storageLabel: "Browser-local history (this device only)",
    };
  } catch {
    return {
      records: EMPTY,
      available: true,
      error:
        "Stored analysis history could not be read. It may have been created by an older version.",
      storageLabel: "Browser-local history (this device only)",
    };
  }
}

function emit(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(EVENT_NAME));
}

function writeRecords(records: AnalysisRecord[]): { ok: boolean; message?: string } {
  const store = storage();
  if (!store) {
    return {
      ok: false,
      message:
        "Browser storage is unavailable. This analysis is shown for this session but will not be saved.",
    };
  }
  const payload: StoredHistory = {
    version: 1,
    updatedAt: new Date().toISOString(),
    records: records.slice(0, MAX_RECORDS),
  };
  try {
    store.setItem(HISTORY_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch {
    // Quota exceeded: keep a smaller recent window rather than losing the app.
    try {
      store.setItem(
        HISTORY_KEY,
        JSON.stringify({ ...payload, records: records.slice(0, 10) }),
      );
      return {
        ok: true,
        message:
          "Browser storage was nearly full. Older local analyses were dropped from this device's history.",
      };
    } catch {
      return {
        ok: false,
        message:
          "Browser storage is full. This analysis could not be saved locally.",
      };
    }
  }
}

export function getLocalHistorySnapshot(): HistorySnapshot {
  if (!initialized && isBrowser()) {
    cache = readFromStorage();
    initialized = true;
  }
  return cache;
}

export function subscribeHistory(listener: () => void): () => void {
  if (!isBrowser()) return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === HISTORY_KEY) {
      cache = readFromStorage();
      listener();
    }
  };
  window.addEventListener(EVENT_NAME, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getServerHistorySnapshot(): HistorySnapshot {
  return cache;
}

export function addToLocalHistory(
  record: AnalysisRecord,
): { ok: boolean; message?: string } {
  if (record.demo) return { ok: true };
  const current = getLocalHistorySnapshot().records.filter(
    (entry) => entry.id !== record.id,
  );
  const next = [record, ...current].slice(0, MAX_RECORDS);
  const result = writeRecords(next);
  cache = {
    ...getLocalHistorySnapshot(),
    records: result.ok ? next : [record, ...current],
    error: result.ok ? null : result.message ?? null,
    available: result.ok || storage() !== null,
  };
  if (isBrowser()) initialized = true;
  emit();
  return result;
}

export function updateLocalHistory(
  record: AnalysisRecord,
): { ok: boolean; message?: string } {
  const exists = getLocalHistorySnapshot().records.some(
    (entry) => entry.id === record.id,
  );
  if (!exists) return addToLocalHistory(record);
  return addToLocalHistory(record);
}

export function deleteFromLocalHistory(id: string): void {
  const next = getLocalHistorySnapshot().records.filter(
    (entry) => entry.id !== id,
  );
  writeRecords(next);
  cache = { ...getLocalHistorySnapshot(), records: next };
  emit();
}

export function clearLocalHistory(): void {
  const store = storage();
  try {
    store?.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
  cache = {
    ...getLocalHistorySnapshot(),
    records: EMPTY,
    error: null,
  };
  emit();
}

export function loadDemoPreference(): boolean {
  if (!demoInitialized && isBrowser()) {
    try {
      demoCache = window.localStorage.getItem(DEMO_MODE_KEY) === "true";
    } catch {
      demoCache = false;
    }
    demoInitialized = true;
  }
  return demoCache;
}

export function setDemoPreference(enabled: boolean): void {
  demoCache = enabled;
  demoInitialized = true;
  try {
    storage()?.setItem(DEMO_MODE_KEY, String(enabled));
  } catch {
    /* preference is session-only if storage is unavailable */
  }
  if (isBrowser()) {
    window.dispatchEvent(new Event("threatlens:demo-mode-changed"));
  }
}

export function subscribeDemoMode(listener: () => void): () => void {
  if (!isBrowser()) return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === DEMO_MODE_KEY) {
      demoCache = event.newValue === "true";
      listener();
    }
  };
  window.addEventListener("threatlens:demo-mode-changed", listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("threatlens:demo-mode-changed", listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getDemoServerSnapshot(): boolean {
  return false;
}

export function exportHistoryJson(): { ok: boolean; message?: string } {
  const records = getLocalHistorySnapshot().records;
  try {
    const payload = {
      exportedAt: new Date().toISOString(),
      scope: "browser-local-demonstration-history",
      warning:
        "This file was generated from browser-local history. It is not live threat intelligence and contains no provider credentials.",
      records,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `threatlens-local-history-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, message: "The browser could not create the export file." };
  }
}
