import { appendAudit, applyTransition, newId } from "@/lib/audit";
import type {
  AnalysisRecord,
  AnalysisResult,
  ChecklistItem,
  ProviderSummary,
} from "@/types";

/**
 * Build the persisted analysis record. The lifecycle starts at DETECTED, then
 * moves to FIX_RECOMMENDED after recommendations are recorded. Every step is
 * captured in the append-only audit trail.
 */
export function createAnalysisRecord(
  result: AnalysisResult,
  provider: ProviderSummary | null,
  checklist: ChecklistItem[],
  now: Date = new Date(),
): AnalysisRecord {
  const createdAt = now.toISOString();
  const record: AnalysisRecord = {
    id: newId("tl"),
    indicatorType: result.indicatorType,
    input: result.input,
    normalized: result.normalized,
    host: result.host,
    createdAt,
    method: result.method,
    score: result.score,
    severity: result.severity,
    findings: result.findings,
    provider,
    checklist,
    state: "DETECTED",
    actions: [],
    verification: null,
    audit: [],
  };

  appendAudit(
    record,
    "ANALYSIS_CREATED",
    "success",
    "Analysis created using local heuristic rules.",
    {
      indicatorType: result.indicatorType,
      method: result.method,
      score: result.score,
      severity: result.severity,
    },
    createdAt,
  );
  appendAudit(
    record,
    "FINDINGS_RECORDED",
    "success",
    `${result.findings.length} finding(s) recorded with explicit score contributions.`,
    {
      findingCount: result.findings.length,
      score: result.score,
    },
    createdAt,
  );
  appendAudit(
    record,
    "RECOMMENDATIONS_GENERATED",
    "success",
    `${checklist.length} remediation checklist item(s) generated.`,
    {
      checklistCount: checklist.length,
    },
    createdAt,
  );

  applyTransition(
    record,
    "FIX_RECOMMENDED",
    "Recommendations are ready. No remediation action has been performed.",
    createdAt,
  );

  return record;
}
