import { analyzeIndicator } from "@/lib/analysis/indicator";
import { analyzeUrl } from "@/lib/analysis/url";
import { appendAudit, applyTransition, newId } from "@/lib/audit";
import {
  getConfiguredIntegration,
  IntegrationError,
  type IntegrationConfigState,
  type RemediationIntegration,
} from "@/lib/remediation/integration";
import { canTransition } from "@/lib/remediation/stateMachine";
import {
  queryProviderForResult,
} from "@/lib/providers/query";
import {
  buildVerificationResult,
  type BlockStatusOutcome,
  type ProviderCheckOutcome,
} from "@/lib/verification";
import type {
  AnalysisRecord,
  AnalysisResult,
  ChecklistStatus,
  ProviderSummary,
  RemediationAction,
} from "@/types";

export class RemediationNotFoundError extends Error {
  readonly status = 404;
  readonly code = "NOT_FOUND";
  constructor(message: string) {
    super(message);
    this.name = "RemediationNotFoundError";
  }
}

export class ActionNotPermittedError extends Error {
  readonly status = 409;
  readonly code = "ACTION_NOT_PERMITTED";
  constructor(message: string) {
    super(message);
    this.name = "ActionNotPermittedError";
  }
}

export function updateChecklistItem(
  record: AnalysisRecord,
  itemId: string,
  status: ChecklistStatus,
  now: Date = new Date(),
): AnalysisRecord {
  const item = record.checklist.find((entry) => entry.id === itemId);
  if (!item) {
    throw new RemediationNotFoundError("That remediation checklist item does not exist.");
  }
  item.status = status;
  item.updatedAt = now.toISOString();

  appendAudit(
    record,
    "CHECKLIST_ITEM_UPDATED",
    "success",
    `Checklist item “${item.title}” marked ${status.replace("_", " ")} by the user. This is a user-reported status, not independent verification.`,
    {
      itemId,
      status,
      userReported: true,
    },
    now.toISOString(),
  );

  const allCompleted = record.checklist.every((entry) => entry.status === "completed");

  if (status === "in_progress" && record.state === "FIX_RECOMMENDED") {
    applyTransition(
      record,
      "REMEDIATION_PENDING",
      "Remediation work started. User-reported progress does not prove the action succeeded.",
      now.toISOString(),
    );
  }

  if (status === "completed" && allCompleted) {
    if (record.state === "FIX_RECOMMENDED" || record.state === "NOT_CONFIGURED") {
      applyTransition(
        record,
        "REMEDIATION_PENDING",
        "All checklist items were marked complete; preparing the remediation record.",
        now.toISOString(),
      );
    }
    if (record.state === "REMEDIATION_PENDING") {
      applyTransition(
        record,
        "REMEDIATED",
        "All checklist items are marked complete by the user. This is not independent proof that the indicator is blocked; run verification.",
        now.toISOString(),
      );
    }
  }

  return record;
}

export function requestFalsePositiveReview(
  record: AnalysisRecord,
  reason: string | undefined,
  now: Date = new Date(),
): AnalysisRecord {
  if (record.state !== "FALSE_POSITIVE_PENDING_REVIEW") {
    if (!canTransition(record.state, "FALSE_POSITIVE_PENDING_REVIEW")) {
      throw new ActionNotPermittedError(
        `A review cannot be requested while the analysis is in state ${record.state}.`,
      );
    }
    applyTransition(
      record,
      "FALSE_POSITIVE_PENDING_REVIEW",
      "False-positive review requested. The detection has not been overridden automatically.",
      now.toISOString(),
    );
  }

  record.review = {
    requestedAt: now.toISOString(),
    ...(reason ? { reason: reason.slice(0, 500) } : {}),
  };

  appendAudit(
    record,
    "MANUAL_REVIEW_REQUESTED",
    "success",
    "User requested a false-positive review. No detection result was silently overridden.",
    {
      reasonProvided: Boolean(reason),
    },
    now.toISOString(),
  );

  return record;
}

export interface BlockExecutionOutcome {
  outcome: "success" | "failed" | "not_configured";
  record: AnalysisRecord;
  message: string;
}

function pushAction(
  record: AnalysisRecord,
  action: Omit<RemediationAction, "id">,
): RemediationAction {
  const stored: RemediationAction = { ...action, id: newId("act") };
  record.actions.push(stored);
  return stored;
}

/**
 * Perform a controlled block action. Explicit user confirmation is enforced at
 * the API boundary; this function additionally treats "no integration" as
 * "not configured" and never fabricates a success.
 */
export async function executeBlockAction(
  record: AnalysisRecord,
  options: {
    integrationState: IntegrationConfigState;
    integration: RemediationIntegration | null;
    now?: Date;
  },
): Promise<BlockExecutionOutcome> {
  const now = options.now ?? new Date();
  const at = now.toISOString();
  const { integrationState, integration } = options;

  appendAudit(
    record,
    "REMEDIATION_ACTION_REQUESTED",
    "info",
    "User requested a controlled block action.",
    { indicatorType: record.indicatorType },
    at,
  );

  if (!integrationState.configured || !integration) {
    const action = pushAction(record, {
      type: "block_indicator",
      integrationId: "none",
      integrationName: integrationState.config?.name ?? "No integration",
      requestedAt: at,
      completedAt: at,
      status: "not_configured",
      message:
        integrationState.reason ??
        "No block integration is configured. No blocking action was attempted.",
      confirmedByUser: true,
    });

    appendAudit(
      record,
      "REMEDIATION_ACTION_FAILED",
      "failure",
      "No blocking action was attempted because no integration is configured. Manual instructions remain available.",
      { actionId: action.id, attempted: false },
      at,
    );

    if (canTransition(record.state, "NOT_CONFIGURED")) {
      applyTransition(
        record,
        "NOT_CONFIGURED",
        "Automatic remediation is unavailable. The analysis remains unverified.",
        at,
      );
    }

    return {
      outcome: "not_configured",
      record,
      message:
        integrationState.reason ??
        "No block integration is configured. Use the manual blocking guidance instead.",
    };
  }

  appendAudit(
    record,
    "REMEDIATION_CONFIRMATION_RECEIVED",
    "success",
    "Explicit confirmation received for the controlled block action.",
    { integrationId: integration.id },
    at,
  );

  if (record.state !== "REMEDIATION_PENDING") {
    if (!canTransition(record.state, "REMEDIATION_PENDING")) {
      throw new ActionNotPermittedError(
        `A block action cannot be started while the analysis is in state ${record.state}.`,
      );
    }
    applyTransition(
      record,
      "REMEDIATION_PENDING",
      "Block action started through the configured integration.",
      at,
    );
  }

  appendAudit(
    record,
    "REMEDIATION_ACTION_ATTEMPTED",
    "info",
    `Calling configured integration “${integration.name}” to block the indicator.`,
    { integrationId: integration.id },
    at,
  );

  const completedAt = new Date().toISOString();

  try {
    const result = await integration.blockIndicator({
      indicator: record.normalized,
      indicatorType: record.indicatorType,
    });

    if (!result.ok) {
      const action = pushAction(record, {
        type: "block_indicator",
        integrationId: integration.id,
        integrationName: integration.name,
        requestedAt: at,
        completedAt,
        status: "failed",
        message: result.message.slice(0, 300),
        confirmedByUser: true,
      });
      appendAudit(
        record,
        "REMEDIATION_ACTION_FAILED",
        "failure",
        `Integration reported that the block was not applied: ${result.message.slice(0, 300)}`,
        { actionId: action.id, integrationId: integration.id },
        completedAt,
      );
      return {
        outcome: "failed",
        record,
        message: result.message.slice(0, 300),
      };
    }

    const action = pushAction(record, {
      type: "block_indicator",
      integrationId: integration.id,
      integrationName: integration.name,
      requestedAt: at,
      completedAt,
      status: "success",
      message: result.message.slice(0, 300),
      confirmedByUser: true,
    });
    appendAudit(
      record,
      "REMEDIATION_ACTION_SUCCEEDED",
      "success",
      `Integration reported the block as applied: ${result.message.slice(0, 300)}`,
      {
        actionId: action.id,
        integrationId: integration.id,
        reference: result.reference ?? null,
      },
      completedAt,
    );
    applyTransition(
      record,
      "REMEDIATED",
      "The integration reported success. Run verification to confirm the block status independently.",
      completedAt,
    );

    return {
      outcome: "success",
      record,
      message: result.message.slice(0, 300),
    };
  } catch (error) {
    const message =
      error instanceof IntegrationError
        ? error.message
        : "The integration action failed unexpectedly. No success is claimed.";
    const action = pushAction(record, {
      type: "block_indicator",
      integrationId: integration.id,
      integrationName: integration.name,
      requestedAt: at,
      completedAt,
      status: error instanceof IntegrationError && error.timedOut ? "timeout" : "failed",
      message: message.slice(0, 300),
      confirmedByUser: true,
    });
    appendAudit(
      record,
      "REMEDIATION_ACTION_FAILED",
      "failure",
      `Block action failed: ${message}`,
      { actionId: action.id, integrationId: integration.id },
      completedAt,
    );
    return { outcome: "failed", record, message };
  }
}

export interface VerificationDeps {
  now?: Date;
  freshAnalysis?: AnalysisResult;
  queryProvider?: (result: AnalysisResult) => Promise<ProviderSummary>;
  integrationState?: IntegrationConfigState;
  integration?: RemediationIntegration | null;
}

/**
 * Fresh local analysis + optional provider + optional integration status.
 * Verification is only VERIFIED when a configured integration confirms the
 * block. No dependency is simulated.
 */
export async function runVerification(
  record: AnalysisRecord,
  deps: VerificationDeps = {},
): Promise<AnalysisRecord> {
  const now = deps.now ?? new Date();
  const at = now.toISOString();

  if (record.state !== "VERIFICATION_PENDING") {
    if (!canTransition(record.state, "VERIFICATION_PENDING")) {
      throw new ActionNotPermittedError(
        `Verification cannot start while the analysis is in state ${record.state}.`,
      );
    }
    applyTransition(
      record,
      "VERIFICATION_PENDING",
      "Verification requested. Running a fresh local analysis and configured integration checks.",
      at,
    );
  }

  appendAudit(
    record,
    "VERIFICATION_ATTEMPTED",
    "info",
    "Verification started: fresh local analysis, provider check, and integration status check.",
    { indicatorType: record.indicatorType },
    at,
  );

  const freshAnalysis =
    deps.freshAnalysis ??
    (record.indicatorType === "url"
      ? analyzeUrl(record.normalized, now)
      : analyzeIndicator(record.normalized, now));

  let providerSummary: ProviderSummary;
  try {
    providerSummary = await (deps.queryProvider ?? queryProviderForResult)(freshAnalysis);
  } catch {
    providerSummary = {
      status: "error",
      providerName: null,
      retrievedAt: at,
      message: "The threat intelligence provider check failed unexpectedly.",
    };
  }

  let providerCheck: ProviderCheckOutcome;
  if (providerSummary.status === "not_configured") {
    providerCheck = {
      status: "not_configured",
      message:
        providerSummary.message ??
        "No threat intelligence provider is configured. No reputation claim is made.",
      summary: providerSummary,
    };
  } else if (providerSummary.status === "ok") {
    providerCheck = {
      status: "checked",
      message: `${providerSummary.providerName ?? "Provider"} returned verdict “${
        providerSummary.verdict ?? "unknown"
      }”${typeof providerSummary.score === "number" ? ` (score ${providerSummary.score}/100)` : ""}. Retrieved ${providerSummary.retrievedAt}.`,
      summary: providerSummary,
    };
  } else {
    providerCheck = {
      status: "error",
      message:
        providerSummary.message ??
        "The threat intelligence provider did not return a usable response.",
      summary: providerSummary,
    };
  }

  const resolved = deps.integrationState
    ? {
        state: deps.integrationState,
        integration: deps.integration ?? null,
      }
    : getConfiguredIntegration();

  let blockStatus: BlockStatusOutcome;
  if (!resolved.state.configured || !resolved.integration) {
    blockStatus = {
      status: "not_configured",
      message:
        resolved.state.reason ??
        "No block integration is configured. Automatic block confirmation is unavailable.",
    };
  } else {
    try {
      const status = await resolved.integration.getBlockStatus({
        indicator: record.normalized,
        indicatorType: record.indicatorType,
      });
      blockStatus = {
        status: status.blocked ? "confirmed" : "not_blocked",
        message: status.message,
        integrationName: resolved.integration.name,
      };
    } catch (error) {
      blockStatus = {
        status: "error",
        message:
          error instanceof IntegrationError
            ? error.message
            : "The configured integration could not be queried.",
        integrationName: resolved.integration.name,
      };
    }
  }

  const verification = buildVerificationResult({
    freshAnalysis: {
      score: freshAnalysis.score,
      severity: freshAnalysis.severity,
      at: freshAnalysis.analyzedAt,
    },
    integrationConfigured: resolved.state.configured && Boolean(resolved.integration),
    blockStatus,
    providerCheck,
    actions: record.actions,
    now,
  });

  record.provider = providerSummary;
  record.verification = verification;

  if (record.state !== "VERIFICATION_PENDING" || verification.status !== "pending") {
    const target =
      verification.status === "verified"
        ? "VERIFIED"
        : verification.status === "failed"
          ? "VERIFICATION_FAILED"
          : verification.status === "not_configured"
            ? "NOT_CONFIGURED"
            : "VERIFICATION_PENDING";
    if (record.state !== target) {
      applyTransition(record, target, verification.explanation, at);
    }
  }

  if (verification.status === "verified") {
    appendAudit(
      record,
      "VERIFICATION_SUCCEEDED",
      "success",
      "A configured integration confirmed the block. Verification succeeded.",
      { status: verification.status },
      at,
    );
  } else if (verification.status === "pending") {
    appendAudit(
      record,
      "VERIFICATION_PENDING",
      "info",
      "Verification could not complete because a dependency was unavailable. It remains pending.",
      { status: verification.status },
      at,
    );
  } else {
    appendAudit(
      record,
      "VERIFICATION_FAILED",
      "failure",
      verification.explanation,
      { status: verification.status },
      at,
    );
  }

  return record;
}
