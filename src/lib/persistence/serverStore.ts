import type {
  AnalysisRecord,
  AnalysisSummary,
  ProviderVerdict,
  VerificationStatus,
} from "@/types";

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RECORDS = 250;

interface StoreGlobal {
  __threatlensAnalysisStore?: Map<string, AnalysisRecord>;
}

function getStore(): Map<string, AnalysisRecord> {
  const globalStore = globalThis as typeof globalThis & StoreGlobal;
  if (!globalStore.__threatlensAnalysisStore) {
    globalStore.__threatlensAnalysisStore = new Map();
  }
  return globalStore.__threatlensAnalysisStore;
}

function prune(now: number = Date.now()): void {
  const store = getStore();
  for (const [id, record] of store) {
    const created = Date.parse(record.createdAt);
    if (!Number.isFinite(created) || now - created > TTL_MS) {
      store.delete(id);
    }
  }
  while (store.size > MAX_RECORDS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/**
 * Process-local, in-memory store for the current server session.
 *
 * This is deliberately simple: no database is required to run ThreatLens, and
 * no analysis record is written to disk. Records expire after 24 hours or when
 * the process restarts. Browser-local history keeps a snapshot for reports.
 * A production deployment would replace this adapter with shared storage.
 */
export function saveRecord(record: AnalysisRecord): AnalysisRecord {
  prune();
  getStore().set(record.id, structuredClone(record));
  return structuredClone(record);
}

export function getRecord(id: string): AnalysisRecord | null {
  prune();
  const found = getStore().get(id);
  return found ? structuredClone(found) : null;
}

export function listRecords(): AnalysisSummary[] {
  prune();
  return [...getStore().values()]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map(toSummary);
}

export function mutateRecord(
  id: string,
  mutator: (record: AnalysisRecord) => void,
): AnalysisRecord | null {
  const existing = getRecord(id);
  if (!existing) return null;
  const draft = structuredClone(existing);
  mutator(draft);
  getStore().set(id, structuredClone(draft));
  return structuredClone(draft);
}

export function deleteRecord(id: string): void {
  getStore().delete(id);
}

export function resetServerStore(): void {
  getStore().clear();
}

export function serverStoreStats(): { count: number; max: number; ttlHours: number } {
  prune();
  return { count: getStore().size, max: MAX_RECORDS, ttlHours: 24 };
}

export function toSummary(record: AnalysisRecord): AnalysisSummary {
  return {
    id: record.id,
    indicatorType: record.indicatorType,
    input: record.input,
    normalized: record.normalized,
    createdAt: record.createdAt,
    score: record.score,
    severity: record.severity,
    state: record.state,
    verificationStatus: (record.verification?.status ??
      null) as VerificationStatus | null,
    providerVerdict: (record.provider?.verdict ?? null) as ProviderVerdict | null,
    demo: record.demo === true,
    findingCount: record.findings.length,
  };
}
