import type {
  AnalysisRecord,
  AuditEvent,
  AuditEventType,
  AuditResult,
  RemediationState,
} from "@/types";
import { assertTransition } from "@/lib/remediation/stateMachine";

export function newId(prefix = "tl"): string {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

export function appendAudit(
  record: AnalysisRecord,
  type: AuditEventType,
  result: AuditResult,
  message: string,
  metadata?: AuditEvent["metadata"],
  at: string = new Date().toISOString(),
): AuditEvent {
  const event: AuditEvent = {
    id: newId("evt"),
    at,
    type,
    analysisId: record.id,
    result,
    message,
    ...(metadata ? { metadata } : {}),
  };
  record.audit.push(event);
  return event;
}

/**
 * Apply a validated state transition and append an immutable audit event.
 * Throws InvalidTransitionError when the transition is not permitted.
 */
export function applyTransition(
  record: AnalysisRecord,
  to: RemediationState,
  message: string,
  at: string = new Date().toISOString(),
): AnalysisRecord {
  const from = record.state;
  assertTransition(from, to);
  record.state = to;
  appendAudit(record, "STATE_TRANSITION", "success", message, {
    from,
    to,
  }, at);
  return record;
}

/** Ensure the record is in `target`, moving through a direct valid edge only. */
export function ensureState(
  record: AnalysisRecord,
  target: RemediationState,
  message: string,
  at?: string,
): void {
  if (record.state === target) return;
  applyTransition(record, target, message, at);
}
