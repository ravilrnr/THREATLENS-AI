export type IndicatorType = "url" | "ipv4" | "domain";

/** Finding-level severity. "info" carries no score weight. */
export type Severity = "info" | "low" | "medium" | "high" | "critical";

/** Overall risk band (derived only from the local heuristic score). */
export type RiskBand = "low" | "medium" | "high" | "critical";

export type FindingCategory =
  | "transport"
  | "host"
  | "structure"
  | "obfuscation"
  | "impersonation"
  | "context";

export type Confidence = "low" | "medium" | "high";

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  category: FindingCategory;
  /** Why this characteristic matters, in plain language. */
  explanation: string;
  /** The exact, safely rendered evidence observed in the input. */
  evidence: string;
  /** What an attacker could do if this is malicious. */
  impact: string;
  confidence: Confidence;
  /** Recommended next action for this specific finding. */
  recommendation: string;
  /** Points this finding adds to the local heuristic score (0-100 total). */
  scoreContribution: number;
}

export type AnalysisMethod = "local-heuristic";

export type ProviderStatus =
  | "not_configured"
  | "ok"
  | "error"
  | "timeout"
  | "rate_limited"
  | "invalid_response";

export type ProviderVerdict = "malicious" | "suspicious" | "clean" | "unknown";

/**
 * Provider data is kept separate from local findings. Provider verdicts are
 * never blended into the heuristic score.
 */
export interface ProviderSummary {
  status: ProviderStatus;
  providerName: string | null;
  verdict?: ProviderVerdict;
  score?: number;
  tags?: string[];
  reference?: string;
  checkedAt?: string;
  retrievedAt: string;
  message?: string;
  queryScope?: "hostname" | "indicator";
}

export interface AnalysisResult {
  indicatorType: IndicatorType;
  input: string;
  normalized: string;
  host: string | null;
  score: number;
  severity: RiskBand;
  findings: Finding[];
  limitations: string[];
  method: AnalysisMethod;
  analyzedAt: string;
}

export type RemediationState =
  | "DETECTED"
  | "UNDER_REVIEW"
  | "FIX_RECOMMENDED"
  | "REMEDIATION_PENDING"
  | "REMEDIATED"
  | "VERIFIED"
  | "VERIFICATION_FAILED"
  | "VERIFICATION_PENDING"
  | "FALSE_POSITIVE_PENDING_REVIEW"
  | "NOT_CONFIGURED";

export type ChecklistStatus =
  | "recommended"
  | "in_progress"
  | "completed"
  | "failed";

export type ChecklistCategory =
  | "contain"
  | "report"
  | "credential"
  | "technical"
  | "review";

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  category: ChecklistCategory;
  status: ChecklistStatus;
  requiresIntegration: boolean;
  updatedAt?: string;
}

export type ActionStatus = "success" | "failed" | "not_configured" | "timeout";

export interface RemediationAction {
  id: string;
  type: "block_indicator";
  integrationId: string;
  integrationName: string;
  requestedAt: string;
  completedAt: string;
  status: ActionStatus;
  /** Actual message returned by the integration, truncated and sanitized. */
  message: string;
  confirmedByUser: true;
}

export type VerificationCheckStatus =
  | "pass"
  | "fail"
  | "not_configured"
  | "error"
  | "info";

export interface VerificationCheck {
  id: string;
  label: string;
  status: VerificationCheckStatus;
  detail: string;
  at: string;
}

export type VerificationStatus =
  | "verified"
  | "failed"
  | "pending"
  | "not_configured";

export interface VerificationResult {
  status: VerificationStatus;
  checks: VerificationCheck[];
  checkedAt: string;
  explanation: string;
  freshAnalysis?: {
    score: number;
    severity: RiskBand;
    at: string;
  };
  provider?: ProviderSummary | null;
}

export type AuditEventType =
  | "ANALYSIS_CREATED"
  | "FINDINGS_RECORDED"
  | "RECOMMENDATIONS_GENERATED"
  | "MANUAL_REVIEW_REQUESTED"
  | "CHECKLIST_ITEM_UPDATED"
  | "REMEDIATION_ACTION_REQUESTED"
  | "REMEDIATION_CONFIRMATION_RECEIVED"
  | "REMEDIATION_ACTION_ATTEMPTED"
  | "REMEDIATION_ACTION_SUCCEEDED"
  | "REMEDIATION_ACTION_FAILED"
  | "VERIFICATION_ATTEMPTED"
  | "VERIFICATION_SUCCEEDED"
  | "VERIFICATION_FAILED"
  | "VERIFICATION_PENDING"
  | "STATE_TRANSITION";

export type AuditResult = "success" | "failure" | "info";

export interface AuditEvent {
  id: string;
  at: string;
  type: AuditEventType;
  analysisId: string;
  result: AuditResult;
  message: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ReviewRequest {
  requestedAt: string;
  reason?: string;
}

/**
 * The full record is safe to store in the browser: it contains no credentials,
 * tokens, or internal server data.
 */
export interface AnalysisRecord {
  id: string;
  indicatorType: IndicatorType;
  input: string;
  normalized: string;
  host: string | null;
  createdAt: string;
  method: AnalysisMethod;
  score: number;
  severity: RiskBand;
  findings: Finding[];
  provider: ProviderSummary | null;
  checklist: ChecklistItem[];
  state: RemediationState;
  actions: RemediationAction[];
  verification: VerificationResult | null;
  audit: AuditEvent[];
  review?: ReviewRequest;
  demo?: boolean;
}

/** Compact shape used by history/report lists. */
export interface AnalysisSummary {
  id: string;
  indicatorType: IndicatorType;
  input: string;
  normalized: string;
  createdAt: string;
  score: number;
  severity: RiskBand;
  state: RemediationState;
  verificationStatus: VerificationStatus | null;
  providerVerdict: ProviderVerdict | null;
  demo: boolean;
  findingCount: number;
}

export interface DemoDataset {
  records: AnalysisRecord[];
  generatedAt: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Safe configuration summary returned by GET /api/status. */
export interface SystemStatus {
  provider: {
    configured: boolean;
    name: string | null;
    reason: string | null;
  };
  integration: {
    configured: boolean;
    name: string | null;
    reason: string | null;
  };
  storage: {
    persistence: string;
    scope: string;
    count: number;
    max: number;
    ttlHours: number;
  };
  rateLimits: {
    analyze: number;
    remediation: number;
    verify: number;
  };
  behavior: {
    fetchesSubmittedIndicators: boolean;
    sendsUrlPathToProvider: boolean;
    providerQueryScope: string;
    demoModeIsBrowserLocal: boolean;
  };
  providerUnavailableMessage: string;
  disclaimer: string;
  externalLookupsDisclosure: string;
}
