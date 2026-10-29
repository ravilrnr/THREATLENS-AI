import type { RemediationState } from "@/types";

/**
 * Documented remediation lifecycle.
 *
 * DETECTED                     analysis just created
 * UNDER_REVIEW                 a human is reviewing the result
 * FIX_RECOMMENDED              recommendations / checklist generated
 * REMEDIATION_PENDING          work started or a block action is in progress
 * REMEDIATED                   user-reported actions recorded (NOT verified)
 * VERIFIED                     integration confirmed the block and required checks passed
 * VERIFICATION_FAILED          verification ran and did not confirm remediation
 * VERIFICATION_PENDING         verification started but could not complete
 * FALSE_POSITIVE_PENDING_REVIEW user asked for a false-positive review
 * NOT_CONFIGURED               required automation is unavailable
 *
 * Transitions are enforced server-side. A client cannot set VERIFIED directly;
 * the verification service must satisfy its evidence rules first.
 */
export const REMEDIATION_STATES: RemediationState[] = [
  "DETECTED",
  "UNDER_REVIEW",
  "FIX_RECOMMENDED",
  "REMEDIATION_PENDING",
  "REMEDIATED",
  "VERIFIED",
  "VERIFICATION_FAILED",
  "VERIFICATION_PENDING",
  "FALSE_POSITIVE_PENDING_REVIEW",
  "NOT_CONFIGURED",
];

export const STATE_TRANSITIONS: Record<RemediationState, RemediationState[]> = {
  DETECTED: [
    "FIX_RECOMMENDED",
    "UNDER_REVIEW",
    "VERIFICATION_PENDING",
    "FALSE_POSITIVE_PENDING_REVIEW",
    "NOT_CONFIGURED",
  ],
  UNDER_REVIEW: [
    "FIX_RECOMMENDED",
    "REMEDIATION_PENDING",
    "FALSE_POSITIVE_PENDING_REVIEW",
    "VERIFICATION_PENDING",
    "NOT_CONFIGURED",
  ],
  FIX_RECOMMENDED: [
    "REMEDIATION_PENDING",
    "UNDER_REVIEW",
    "VERIFICATION_PENDING",
    "FALSE_POSITIVE_PENDING_REVIEW",
    "NOT_CONFIGURED",
  ],
  REMEDIATION_PENDING: [
    "REMEDIATED",
    "VERIFICATION_PENDING",
    "NOT_CONFIGURED",
    "UNDER_REVIEW",
    "FALSE_POSITIVE_PENDING_REVIEW",
  ],
  REMEDIATED: [
    "VERIFICATION_PENDING",
    "REMEDIATION_PENDING",
    "UNDER_REVIEW",
    "FALSE_POSITIVE_PENDING_REVIEW",
  ],
  VERIFIED: [
    "VERIFICATION_PENDING",
    "REMEDIATION_PENDING",
    "UNDER_REVIEW",
    "FALSE_POSITIVE_PENDING_REVIEW",
  ],
  VERIFICATION_PENDING: [
    "VERIFIED",
    "VERIFICATION_FAILED",
    "NOT_CONFIGURED",
    "FALSE_POSITIVE_PENDING_REVIEW",
  ],
  VERIFICATION_FAILED: [
    "VERIFICATION_PENDING",
    "REMEDIATION_PENDING",
    "UNDER_REVIEW",
    "FALSE_POSITIVE_PENDING_REVIEW",
    "NOT_CONFIGURED",
  ],
  FALSE_POSITIVE_PENDING_REVIEW: [
    "UNDER_REVIEW",
    "FIX_RECOMMENDED",
    "VERIFICATION_PENDING",
  ],
  NOT_CONFIGURED: [
    "REMEDIATION_PENDING",
    "VERIFICATION_PENDING",
    "UNDER_REVIEW",
    "FALSE_POSITIVE_PENDING_REVIEW",
    "FIX_RECOMMENDED",
  ],
};

export const STATE_LABELS: Record<RemediationState, string> = {
  DETECTED: "Detected",
  UNDER_REVIEW: "Under review",
  FIX_RECOMMENDED: "Fix recommended",
  REMEDIATION_PENDING: "Remediation pending",
  REMEDIATED: "Remediated (user-reported)",
  VERIFIED: "Verified",
  VERIFICATION_FAILED: "Verification failed",
  VERIFICATION_PENDING: "Verification pending",
  FALSE_POSITIVE_PENDING_REVIEW: "False positive pending review",
  NOT_CONFIGURED: "Not configured",
};

export const STATE_DESCRIPTIONS: Record<RemediationState, string> = {
  DETECTED: "The indicator has been analyzed locally and recorded.",
  UNDER_REVIEW: "A human review has been requested or is in progress.",
  FIX_RECOMMENDED:
    "Remediation steps have been generated. No action has been performed yet.",
  REMEDIATION_PENDING:
    "Remediation work has been started or a configured integration action is in progress.",
  REMEDIATED:
    "The user reported the checklist as complete or an integration action succeeded. This is not proof that the indicator is blocked.",
  VERIFIED:
    "A configured integration confirmed the block and the required verification checks passed.",
  VERIFICATION_FAILED:
    "Verification ran, but block evidence was missing, negative, or the integration reported an error.",
  VERIFICATION_PENDING:
    "Verification started but a required check could not complete. Retry when the dependency is available.",
  FALSE_POSITIVE_PENDING_REVIEW:
    "A false-positive review was requested. The detection has not been overridden automatically.",
  NOT_CONFIGURED:
    "A required integration is not configured. Manual remediation instructions are available.",
};

export class InvalidTransitionError extends Error {
  readonly code = "INVALID_TRANSITION";
  readonly from: RemediationState;
  readonly to: RemediationState;

  constructor(from: RemediationState, to: RemediationState) {
    super(`Transition from ${from} to ${to} is not permitted.`);
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canTransition(
  from: RemediationState,
  to: RemediationState,
): boolean {
  return STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: RemediationState,
  to: RemediationState,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export function isTerminalState(state: RemediationState): boolean {
  return STATE_TRANSITIONS[state].length === 0;
}
