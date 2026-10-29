import { verificationScoreSummary } from "@/lib/scoring";
import type {
  ProviderSummary,
  RemediationAction,
  RiskBand,
  VerificationCheck,
  VerificationResult,
  VerificationStatus,
} from "@/types";

export interface BlockStatusOutcome {
  status: "confirmed" | "not_blocked" | "error" | "not_configured";
  message: string;
  integrationName?: string;
}

export interface ProviderCheckOutcome {
  status: "checked" | "error" | "not_configured";
  message: string;
  summary?: ProviderSummary | null;
}

export interface VerificationInput {
  freshAnalysis: { score: number; severity: RiskBand; at: string };
  integrationConfigured: boolean;
  blockStatus: BlockStatusOutcome;
  providerCheck: ProviderCheckOutcome;
  actions: RemediationAction[];
  now: Date;
}

export const VERIFICATION_LIMITATIONS = [
  "A clean heuristic rescan does not prove that an indicator is blocked.",
  "A remediation recommendation or a checklist marked complete is not independent evidence.",
  "A block can only be confirmed when a configured integration reports the block status.",
  "ThreatLens does not verify browser, DNS, endpoint, or gateway state without an integration response.",
];

const STATUS_TO_STATE: Record<VerificationStatus, string> = {
  verified: "VERIFIED",
  failed: "VERIFICATION_FAILED",
  pending: "VERIFICATION_PENDING",
  not_configured: "NOT_CONFIGURED",
};

export function verificationState(status: VerificationStatus): string {
  return STATUS_TO_STATE[status];
}

/**
 * Build a verification result from recorded evidence. This function is pure so
 * its rules can be unit tested. It never invents a successful integration
 * result: VERIFIED requires a configured integration to report the block.
 */
export function buildVerificationResult(
  input: VerificationInput,
): VerificationResult {
  const {
    freshAnalysis,
    integrationConfigured,
    blockStatus,
    providerCheck,
    actions,
    now,
  } = input;
  const at = now.toISOString();
  const checks: VerificationCheck[] = [];

  checks.push({
    id: "fresh-analysis",
    label: "Fresh local heuristic analysis",
    status: "pass",
    detail: `Completed at ${at}. Current local score: ${verificationScoreSummary(
      freshAnalysis.score,
    )}.`,
    at,
  });

  checks.push({
    id: "provider-check",
    label: "Threat intelligence provider check",
    status:
      providerCheck.status === "checked"
        ? "pass"
        : providerCheck.status === "error"
          ? "error"
          : "not_configured",
    detail: providerCheck.message,
    at,
  });

  checks.push({
    id: "integration-configured",
    label: "Block integration configured",
    status: integrationConfigured ? "pass" : "not_configured",
    detail: integrationConfigured
      ? `${blockStatus.integrationName ?? "Configured integration"} is available server-side.`
      : "No block integration is configured. Automatic blocking and integration-verified status are unavailable.",
    at,
  });

  checks.push({
    id: "block-confirmed",
    label: "Block status confirmed by integration",
    status:
      blockStatus.status === "confirmed"
        ? "pass"
        : blockStatus.status === "not_blocked"
          ? "fail"
          : blockStatus.status === "error"
            ? "error"
            : "not_configured",
    detail: blockStatus.message,
    at,
  });

  const lastAction = actions.at(-1);
  checks.push({
    id: "action-result",
    label: "Remediation action result",
    status: !lastAction
      ? integrationConfigured
        ? "info"
        : "not_configured"
      : lastAction.status === "success"
        ? "pass"
        : lastAction.status === "failed"
          ? "fail"
          : "error",
    detail: lastAction
      ? `Last recorded action (${lastAction.integrationName}) returned “${lastAction.status}”: ${lastAction.message}`
      : integrationConfigured
        ? "No block action has been recorded in this analysis record. A pre-existing block can still be confirmed by the integration status check."
        : "No action was performed because no integration is configured.",
    at,
  });

  checks.push({
    id: "limitations",
    label: "Verification limitations",
    status: "info",
    detail:
      "Heuristic rescanning and user-reported checklist updates are not proof of remediation. Only the configured integration's reported block status is treated as block evidence.",
    at,
  });

  let status: VerificationStatus;
  let explanation: string;

  if (!integrationConfigured) {
    status = "not_configured";
    explanation =
      "Verification could not confirm a block because no remediation integration is configured. The fresh local analysis was recorded, but it only describes the indicator's heuristic risk. Manual remediation steps remain available.";
  } else if (blockStatus.status === "error") {
    status = "failed";
    explanation = `Verification failed because the configured integration could not return a reliable block status: ${blockStatus.message}`;
  } else if (blockStatus.status === "not_blocked") {
    status = "failed";
    explanation =
      "Verification failed because the configured integration reports that the indicator is not blocked. Review the block rule and retry verification.";
  } else if (blockStatus.status !== "confirmed") {
    status = "failed";
    explanation =
      "Verification failed because no confirmed block status was returned by the configured integration.";
  } else if (providerCheck.status === "error") {
    status = "pending";
    explanation = `The block was confirmed by the integration, but the configured threat intelligence provider could not be checked (${providerCheck.message}). Verification remains pending until that dependency is available.`;
  } else {
    status = "verified";
    const providerText =
      providerCheck.status === "checked"
        ? " The configured threat intelligence provider was also checked; its verdict is shown separately and does not replace block evidence."
        : " No threat intelligence provider is configured, so no reputation claim is made.";
    explanation = `The configured integration reported that the indicator is blocked.${providerText} A fresh local heuristic analysis was recorded at ${at}.`;
  }

  return {
    status,
    checks,
    checkedAt: at,
    explanation,
    freshAnalysis,
    provider: providerCheck.summary ?? null,
  };
}
