import { analyzeIndicator } from "@/lib/analysis/indicator";
import { analyzeUrl } from "@/lib/analysis/url";
import { appendAudit } from "@/lib/audit";
import { generateChecklist } from "@/lib/remediation/recommendations";
import { createAnalysisRecord } from "@/lib/remediation/records";
import type {
  AnalysisRecord,
  ChecklistStatus,
  VerificationCheck,
  VerificationResult,
  VerificationStatus,
} from "@/types";

/**
 * Fictional demo records. All domains use reserved example.* names and all IPs
 * use documentation ranges. Nothing here is live threat intelligence and no
 * demo record is ever merged into the user's browser-local history.
 */

function demoChecks(
  at: string,
  options: {
    blockStatus: "fail" | "error" | "not_configured";
    blockDetail: string;
    providerDetail: string;
  },
): VerificationCheck[] {
  return [
    {
      id: "fresh-analysis",
      label: "Fresh local heuristic analysis",
      status: "pass",
      detail: "DEMO DATA: a fictional fresh local analysis was recorded.",
      at,
    },
    {
      id: "provider-check",
      label: "Threat intelligence provider check",
      status: "not_configured",
      detail: options.providerDetail,
      at,
    },
    {
      id: "integration-configured",
      label: "Block integration configured",
      status: "pass",
      detail:
        "DEMO DATA: a fictional gateway is shown as configured only to illustrate the verification UI.",
      at,
    },
    {
      id: "block-confirmed",
      label: "Block status confirmed by integration",
      status: options.blockStatus,
      detail: options.blockDetail,
      at,
    },
    {
      id: "action-result",
      label: "Remediation action result",
      status: "info",
      detail: "DEMO DATA: no real remediation action was performed.",
      at,
    },
    {
      id: "limitations",
      label: "Verification limitations",
      status: "info",
      detail:
        "Demo snapshots are illustrative. They are not evidence that any real indicator is blocked.",
      at,
    },
  ];
}

function verification(
  status: VerificationStatus,
  checkedAt: string,
  explanation: string,
  checks: VerificationCheck[],
): VerificationResult {
  return { status, checkedAt, explanation, checks };
}

function markDemo(
  record: AnalysisRecord,
  id: string,
  createdAt: string,
  options: {
    state: AnalysisRecord["state"];
    checklist?: Partial<Record<string, ChecklistStatus>>;
    verification?: VerificationResult;
    failedAction?: boolean;
  },
): AnalysisRecord {
  record.id = id;
  record.demo = true;
  record.createdAt = createdAt;
  for (const event of record.audit) {
    event.analysisId = id;
    event.at = createdAt;
  }

  for (const [itemId, status] of Object.entries(options.checklist ?? {})) {
    const item = record.checklist.find((entry) => entry.id === itemId);
    if (item && status) {
      item.status = status;
      item.updatedAt = createdAt;
    }
  }

  if (options.failedAction) {
    const at = new Date(Date.parse(createdAt) + 45 * 60_000).toISOString();
    record.actions.push({
      id: `${id}_action`,
      type: "block_indicator",
      integrationId: "demo-gateway",
      integrationName: "DEMO — Fictional Security Gateway",
      requestedAt: at,
      completedAt: at,
      status: "failed",
      message:
        "DEMO DATA: fictional gateway reported that the block was not applied. No real action occurred.",
      confirmedByUser: true,
    });
    appendAudit(
      record,
      "REMEDIATION_ACTION_FAILED",
      "failure",
      "DEMO DATA: fictional gateway reported a failed block action.",
      { demo: true, attempted: true },
      at,
    );
  }

  if (options.verification) {
    record.verification = options.verification;
    appendAudit(
      record,
      options.verification.status === "failed"
        ? "VERIFICATION_FAILED"
        : options.verification.status === "verified"
          ? "VERIFICATION_SUCCEEDED"
          : "VERIFICATION_PENDING",
      options.verification.status === "failed" ? "failure" : "info",
      options.verification.explanation,
      { demo: true },
      options.verification.checkedAt,
    );
  }

  record.state = options.state;
  return record;
}

export function buildDemoDataset(now: Date = new Date()): AnalysisRecord[] {
  const iso = (offsetMinutes: number) =>
    new Date(now.getTime() - offsetMinutes * 60_000).toISOString();

  const lowAt = iso(35);
  const low = createAnalysisRecord(
    analyzeUrl("https://www.example.com/security-awareness", new Date(lowAt)),
    null,
    generateChecklist(
      analyzeUrl("https://www.example.com/security-awareness", new Date(lowAt)),
      { integrationConfigured: false },
    ),
    new Date(lowAt),
  );

  const mediumAt = iso(4 * 60);
  const mediumResult = analyzeUrl(
    "https://secure.login.paypal.account.example.net/verify/account",
    new Date(mediumAt),
  );
  const medium = createAnalysisRecord(
    mediumResult,
    null,
    generateChecklist(mediumResult, { integrationConfigured: true }),
    new Date(mediumAt),
  );

  const highAt = iso(26 * 60);
  const highResult = analyzeUrl(
    "http://user:pass@paypal.com.verify-account.example.net/login?redirect=http://example.org/report",
    new Date(highAt),
  );
  const high = createAnalysisRecord(
    highResult,
    null,
    generateChecklist(highResult, { integrationConfigured: true }),
    new Date(highAt),
  );

  const criticalAt = iso(3 * 24 * 60);
  const criticalResult = analyzeUrl(
    "http://paypal.com@198.51.100.10:8080/secure/login/verify?url=http%3A%2F%2Fevil.example&next=javascript:alert(1)",
    new Date(criticalAt),
  );
  const critical = createAnalysisRecord(
    criticalResult,
    null,
    generateChecklist(criticalResult, { integrationConfigured: false }),
    new Date(criticalAt),
  );

  const domainAt = iso(5 * 24 * 60);
  const domainResult = analyzeIndicator(
    "secure-login.paypal-verify.example.xyz",
    new Date(domainAt),
  );
  const domain = createAnalysisRecord(
    domainResult,
    null,
    generateChecklist(domainResult, { integrationConfigured: false }),
    new Date(domainAt),
  );

  const ipAt = iso(8 * 24 * 60);
  const ipResult = analyzeIndicator("203.0.113.42", new Date(ipAt));
  const ip = createAnalysisRecord(
    ipResult,
    null,
    generateChecklist(ipResult, { integrationConfigured: false }),
    new Date(ipAt),
  );

  const pendingCheckedAt = iso(3 * 60);
  const failedCheckedAt = iso(24 * 60);
  const notConfiguredAt = iso(4 * 24 * 60);

  return [
    markDemo(low, "demo_low_001", lowAt, {
      state: "FIX_RECOMMENDED",
      checklist: { "do-not-open": "completed", "report-message": "completed" },
    }),
    markDemo(medium, "demo_medium_002", mediumAt, {
      state: "VERIFICATION_PENDING",
      checklist: {
        "do-not-open": "completed",
        "verify-through-channel": "in_progress",
        "report-message": "completed",
      },
      verification: verification(
        "pending",
        pendingCheckedAt,
        "DEMO DATA: verification is pending because a fictional integration check could not complete. This is an illustration, not a real verification result.",
        demoChecks(pendingCheckedAt, {
          blockStatus: "error",
          blockDetail:
            "DEMO DATA: the fictional integration could not be reached; verification stays pending.",
          providerDetail:
            "DEMO DATA: no provider is configured in this demonstration scenario.",
        }),
      ),
    }),
    markDemo(high, "demo_high_003", highAt, {
      state: "VERIFICATION_FAILED",
      checklist: {
        "do-not-open": "completed",
        "report-message": "completed",
        "credential-response": "in_progress",
        "manual-block": "failed",
      },
      failedAction: true,
      verification: verification(
        "failed",
        failedCheckedAt,
        "DEMO DATA: verification failed because the fictional integration reported the indicator as not blocked. No real remediation occurred.",
        demoChecks(failedCheckedAt, {
          blockStatus: "fail",
          blockDetail:
            "DEMO DATA: fictional gateway reported the indicator as not blocked.",
          providerDetail:
            "DEMO DATA: no provider is configured in this demonstration scenario.",
        }),
      ),
    }),
    markDemo(critical, "demo_critical_004", criticalAt, {
      state: "FIX_RECOMMENDED",
      checklist: { "do-not-open": "in_progress" },
    }),
    markDemo(domain, "demo_domain_005", domainAt, {
      state: "NOT_CONFIGURED",
      checklist: {
        "do-not-open": "completed",
        "manual-block": "completed",
      },
      verification: verification(
        "not_configured",
        notConfiguredAt,
        "DEMO DATA: no integration is configured, so the fictional verification cannot confirm a block. Only local analysis is available.",
        demoChecks(notConfiguredAt, {
          blockStatus: "not_configured",
          blockDetail:
            "DEMO DATA: no integration is configured, so block status is unknown.",
          providerDetail:
            "DEMO DATA: live threat intelligence is unavailable in this scenario.",
        }),
      ),
    }),
    markDemo(ip, "demo_ip_006", ipAt, {
      state: "FIX_RECOMMENDED",
    }),
  ];
}
