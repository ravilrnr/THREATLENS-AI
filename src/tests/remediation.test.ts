import { describe, expect, it } from "vitest";
import { analyzeUrl } from "@/lib/analysis/url";
import { createAnalysisRecord } from "@/lib/remediation/records";
import { generateChecklist } from "@/lib/remediation/recommendations";
import {
  canTransition,
  assertTransition,
  InvalidTransitionError,
  REMEDIATION_STATES,
  STATE_TRANSITIONS,
} from "@/lib/remediation/stateMachine";
import {
  executeBlockAction,
  requestFalsePositiveReview,
  runVerification,
  updateChecklistItem,
} from "@/lib/remediation/service";
import {
  buildVerificationResult,
  VERIFICATION_LIMITATIONS,
} from "@/lib/verification";
import { providerUnavailableSummary } from "@/lib/providers/generic";
import type {
  AnalysisRecord,
  ProviderSummary,
} from "@/types";
import type {
  IntegrationConfig,
  RemediationIntegration,
} from "@/lib/remediation/integration";

const FIXED = new Date("2026-02-03T04:05:06.000Z");
const AT = FIXED.toISOString();

function makeRecord(url = "https://www.example.com/"): AnalysisRecord {
  const result = analyzeUrl(url, FIXED);
  const checklist = generateChecklist(result, { integrationConfigured: false });
  return createAnalysisRecord(result, providerUnavailableSummary(FIXED), checklist, FIXED);
}

function integrationConfig(): IntegrationConfig {
  return {
    id: "webhook",
    name: "Test Gateway",
    endpoint: "https://gateway.example.com/actions",
    token: "test-token",
    allowedHosts: ["gateway.example.com"],
    timeoutMs: 1000,
  };
}

function fakeIntegration(
  behavior: "blocked" | "not_blocked" | "error",
): RemediationIntegration {
  return {
    id: "webhook",
    name: "Test Gateway",
    async blockIndicator() {
      if (behavior === "error") throw new Error("network down");
      return behavior === "blocked"
        ? { ok: true, message: "Blocked by test gateway." }
        : { ok: false, message: "The test gateway refused the block." };
    },
    async getBlockStatus() {
      if (behavior === "error") throw new Error("network down");
      return {
        blocked: behavior === "blocked",
        message:
          behavior === "blocked"
            ? "Test gateway reports the indicator as blocked."
            : "Test gateway reports the indicator as not blocked.",
        checkedAt: AT,
      };
    },
  };
}

function notConfiguredProvider(): ProviderSummary {
  return providerUnavailableSummary(FIXED);
}

describe("remediation state machine", () => {
  it("declares every state with a transition table", () => {
    for (const state of REMEDIATION_STATES) {
      expect(Array.isArray(STATE_TRANSITIONS[state])).toBe(true);
    }
  });

  it("permits the documented lifecycle edges", () => {
    expect(canTransition("DETECTED", "FIX_RECOMMENDED")).toBe(true);
    expect(canTransition("FIX_RECOMMENDED", "REMEDIATION_PENDING")).toBe(true);
    expect(canTransition("REMEDIATION_PENDING", "REMEDIATED")).toBe(true);
    expect(canTransition("VERIFICATION_PENDING", "VERIFIED")).toBe(true);
    expect(canTransition("VERIFICATION_PENDING", "VERIFICATION_FAILED")).toBe(true);
    expect(canTransition("VERIFICATION_PENDING", "NOT_CONFIGURED")).toBe(true);
  });

  it("blocks direct and undocumented transitions", () => {
    expect(canTransition("REMEDIATED", "VERIFIED")).toBe(false);
    expect(canTransition("DETECTED", "VERIFIED")).toBe(false);
    expect(canTransition("FIX_RECOMMENDED", "VERIFIED")).toBe(false);
    expect(canTransition("VERIFIED", "REMEDIATED")).toBe(false);
  });

  it("throws a typed error for an invalid transition", () => {
    expect(() => assertTransition("REMEDIATED", "VERIFIED")).toThrow(
      InvalidTransitionError,
    );
    try {
      assertTransition("REMEDIATED", "VERIFIED");
    } catch (error) {
      const invalid = error as InvalidTransitionError;
      expect(invalid.code).toBe("INVALID_TRANSITION");
      expect(invalid.from).toBe("REMEDIATED");
      expect(invalid.to).toBe("VERIFIED");
    }
  });
});

describe("record creation and checklist flow", () => {
  it("starts a new analysis in FIX_RECOMMENDED with an audit trail", () => {
    const record = makeRecord();
    expect(record.state).toBe("FIX_RECOMMENDED");
    expect(record.verification).toBeNull();
    expect(record.actions).toEqual([]);
    expect(record.audit.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "ANALYSIS_CREATED",
        "FINDINGS_RECORDED",
        "RECOMMENDATIONS_GENERATED",
        "STATE_TRANSITION",
      ]),
    );
    expect(record.provider?.status).toBe("not_configured");
  });

  it("records user-reported checklist progress without claiming verification", () => {
    const record = makeRecord();
    const first = record.checklist[0];

    updateChecklistItem(record, first.id, "in_progress", FIXED);
    expect(record.state).toBe("REMEDIATION_PENDING");
    expect(record.checklist[0].status).toBe("in_progress");
    expect(record.verification).toBeNull();

    for (const item of record.checklist) {
      updateChecklistItem(record, item.id, "completed", FIXED);
    }
    expect(record.state).toBe("REMEDIATED");
    expect(record.checklist.every((item) => item.status === "completed")).toBe(true);
    expect(record.state).not.toBe("VERIFIED");
    expect(
      record.audit.filter((event) => event.type === "CHECKLIST_ITEM_UPDATED"),
    ).toHaveLength(record.checklist.length + 1);
    expect(
      record.audit.some((event) => event.message.includes("not independent verification")),
    ).toBe(true);
  });

  it("fails cleanly for an unknown checklist item", () => {
    const record = makeRecord();
    expect(() => updateChecklistItem(record, "missing-item", "completed", FIXED)).toThrow(
      /does not exist/,
    );
  });

  it("requests a false-positive review without overriding the detection", () => {
    const record = makeRecord("http://paypal-secure-login.xyz/verify");
    const scoreBefore = record.score;
    const findingsBefore = structuredClone(record.findings);

    requestFalsePositiveReview(record, "This is an approved internal test domain.", FIXED);

    expect(record.state).toBe("FALSE_POSITIVE_PENDING_REVIEW");
    expect(record.review).toEqual({
      requestedAt: AT,
      reason: "This is an approved internal test domain.",
    });
    expect(record.score).toBe(scoreBefore);
    expect(record.findings).toEqual(findingsBefore);
    expect(record.audit.at(-1)?.type).toBe("MANUAL_REVIEW_REQUESTED");
  });

  it("updates an existing review request without duplicating the transition", () => {
    const record = makeRecord();
    requestFalsePositiveReview(record, "First reason.", FIXED);
    const transitions = record.audit.filter(
      (event) =>
        event.type === "STATE_TRANSITION" &&
        event.metadata?.to === "FALSE_POSITIVE_PENDING_REVIEW",
    );
    expect(transitions).toHaveLength(1);

    requestFalsePositiveReview(record, "Updated reason.", FIXED);
    expect(record.state).toBe("FALSE_POSITIVE_PENDING_REVIEW");
    expect(record.review?.reason).toBe("Updated reason.");
    expect(
      record.audit.filter(
        (event) =>
          event.type === "STATE_TRANSITION" &&
          event.metadata?.to === "FALSE_POSITIVE_PENDING_REVIEW",
      ),
    ).toHaveLength(1);
  });
});

describe("controlled block actions", () => {
  it("reports Not Configured and never claims a block when no integration exists", async () => {
    const record = makeRecord();
    const outcome = await executeBlockAction(record, {
      integrationState: { configured: false, config: null },
      integration: null,
      now: FIXED,
    });

    expect(outcome.outcome).toBe("not_configured");
    expect(outcome.record.state).toBe("NOT_CONFIGURED");
    expect(outcome.record.actions).toHaveLength(1);
    expect(outcome.record.actions[0].status).toBe("not_configured");
    expect(outcome.record.actions[0].confirmedByUser).toBe(true);
    expect(outcome.record.actions[0].message).toMatch(/no block integration/i);
    expect(outcome.record.verification).toBeNull();
    expect(
      outcome.record.audit.some(
        (event) =>
          event.type === "REMEDIATION_ACTION_FAILED" &&
          event.metadata?.attempted === false,
      ),
    ).toBe(true);
  });

  it("records a successful configured action but does not mark it verified", async () => {
    const record = makeRecord();
    const outcome = await executeBlockAction(record, {
      integrationState: { configured: true, config: integrationConfig() },
      integration: fakeIntegration("blocked"),
      now: FIXED,
    });

    expect(outcome.outcome).toBe("success");
    expect(outcome.record.state).toBe("REMEDIATED");
    expect(outcome.record.actions[0].status).toBe("success");
    expect(outcome.record.actions[0].integrationName).toBe("Test Gateway");
    expect(outcome.record.verification).toBeNull();
    expect(outcome.record.state).not.toBe("VERIFIED");
    expect(
      outcome.record.audit.some((event) => event.type === "REMEDIATION_ACTION_SUCCEEDED"),
    ).toBe(true);
  });

  it("records a failed integration response without granting success", async () => {
    const record = makeRecord();
    const outcome = await executeBlockAction(record, {
      integrationState: { configured: true, config: integrationConfig() },
      integration: fakeIntegration("not_blocked"),
      now: FIXED,
    });

    expect(outcome.outcome).toBe("failed");
    expect(outcome.record.state).toBe("REMEDIATION_PENDING");
    expect(outcome.record.actions[0].status).toBe("failed");
    expect(
      outcome.record.audit.some((event) => event.type === "REMEDIATION_ACTION_FAILED"),
    ).toBe(true);
  });

  it("records an unexpected integration exception as a failure", async () => {
    const record = makeRecord();
    const outcome = await executeBlockAction(record, {
      integrationState: { configured: true, config: integrationConfig() },
      integration: fakeIntegration("error"),
      now: FIXED,
    });

    expect(outcome.outcome).toBe("failed");
    expect(outcome.record.actions[0].status).toBe("failed");
    expect(outcome.record.actions[0].message).toMatch(/unexpectedly|failed/i);
  });
});

describe("verification rules", () => {
  const base = {
    freshAnalysis: { score: 12, severity: "low" as const, at: AT },
    actions: [],
    now: FIXED,
  };

  it("never verifies without a configured integration", () => {
    const result = buildVerificationResult({
      ...base,
      integrationConfigured: false,
      blockStatus: {
        status: "not_configured",
        message: "No integration.",
      },
      providerCheck: {
        status: "not_configured",
        message: "No provider.",
      },
    });
    expect(result.status).toBe("not_configured");
    expect(result.explanation).toMatch(/no remediation integration/i);
    expect(result.checks.find((check) => check.id === "block-confirmed")?.status).toBe(
      "not_configured",
    );
  });

  it("verifies only when the configured integration confirms the block", () => {
    const result = buildVerificationResult({
      ...base,
      integrationConfigured: true,
      blockStatus: {
        status: "confirmed",
        message: "Blocked.",
        integrationName: "Test Gateway",
      },
      providerCheck: { status: "not_configured", message: "No provider configured." },
    });
    expect(result.status).toBe("verified");
    expect(result.explanation).toMatch(/reported that the indicator is blocked/i);
    expect(result.explanation).toMatch(/no reputation claim is made/i);
    expect(VERIFICATION_LIMITATIONS.join(" ")).toContain("does not prove");
  });

  it("fails when the integration reports not blocked", () => {
    const result = buildVerificationResult({
      ...base,
      integrationConfigured: true,
      blockStatus: { status: "not_blocked", message: "Not blocked." },
      providerCheck: { status: "not_configured", message: "No provider configured." },
    });
    expect(result.status).toBe("failed");
    expect(result.explanation).toMatch(/not blocked/i);
  });

  it("fails when the integration status check errors", () => {
    const result = buildVerificationResult({
      ...base,
      integrationConfigured: true,
      blockStatus: { status: "error", message: "Gateway timeout." },
      providerCheck: { status: "not_configured", message: "No provider configured." },
    });
    expect(result.status).toBe("failed");
    expect(result.explanation).toContain("Gateway timeout.");
  });

  it("stays pending when the block is confirmed but the provider check errors", () => {
    const result = buildVerificationResult({
      ...base,
      integrationConfigured: true,
      blockStatus: { status: "confirmed", message: "Blocked." },
      providerCheck: { status: "error", message: "Provider unavailable." },
    });
    expect(result.status).toBe("pending");
    expect(result.explanation).toMatch(/remains pending/i);
  });

  it("marks a recorded successful action as evidence only, not proof", () => {
    const result = buildVerificationResult({
      ...base,
      actions: [
        {
          id: "act_1",
          type: "block_indicator",
          integrationId: "webhook",
          integrationName: "Test Gateway",
          requestedAt: AT,
          completedAt: AT,
          status: "success",
          message: "Blocked.",
          confirmedByUser: true,
        },
      ],
      integrationConfigured: true,
      blockStatus: { status: "not_blocked", message: "Not blocked." },
      providerCheck: { status: "not_configured", message: "No provider configured." },
    });
    expect(result.status).toBe("failed");
    expect(result.checks.find((check) => check.id === "action-result")?.status).toBe(
      "pass",
    );
  });
});

describe("runVerification state handling", () => {
  it("ends in NOT_CONFIGURED when no integration is present", async () => {
    const record = makeRecord();
    await runVerification(record, {
      now: FIXED,
      freshAnalysis: analyzeUrl(record.normalized, FIXED),
      queryProvider: async () => notConfiguredProvider(),
      integrationState: { configured: false, config: null },
      integration: null,
    });

    expect(record.state).toBe("NOT_CONFIGURED");
    expect(record.state).not.toBe("VERIFIED");
    expect(record.verification?.status).toBe("not_configured");
    expect(record.audit.map((event) => event.type)).toEqual(
      expect.arrayContaining(["VERIFICATION_ATTEMPTED", "VERIFICATION_FAILED"]),
    );
  });

  it("reaches VERIFIED only through the verification service", async () => {
    const record = makeRecord();
    await runVerification(record, {
      now: FIXED,
      freshAnalysis: analyzeUrl(record.normalized, FIXED),
      queryProvider: async () => notConfiguredProvider(),
      integrationState: { configured: true, config: integrationConfig() },
      integration: fakeIntegration("blocked"),
    });

    expect(record.state).toBe("VERIFIED");
    expect(record.verification?.status).toBe("verified");
    expect(record.audit.at(-1)?.type).toBe("VERIFICATION_SUCCEEDED");
  });

  it("remains VERIFICATION_PENDING when provider evidence is unavailable", async () => {
    const record = makeRecord();
    await runVerification(record, {
      now: FIXED,
      freshAnalysis: analyzeUrl(record.normalized, FIXED),
      queryProvider: async () => ({
        status: "error",
        providerName: "Test Provider",
        retrievedAt: AT,
        message: "Provider failed.",
      }),
      integrationState: { configured: true, config: integrationConfig() },
      integration: fakeIntegration("blocked"),
    });

    expect(record.state).toBe("VERIFICATION_PENDING");
    expect(record.verification?.status).toBe("pending");
    expect(record.verification?.status).not.toBe("verified");
  });

  it("ends in VERIFICATION_FAILED when the integration denies the block", async () => {
    const record = makeRecord();
    await runVerification(record, {
      now: FIXED,
      freshAnalysis: analyzeUrl(record.normalized, FIXED),
      queryProvider: async () => notConfiguredProvider(),
      integrationState: { configured: true, config: integrationConfig() },
      integration: fakeIntegration("not_blocked"),
    });

    expect(record.state).toBe("VERIFICATION_FAILED");
    expect(record.verification?.status).toBe("failed");
  });

  it("keeps the audit trail append-only across operations", async () => {
    const record = makeRecord();
    const initialAudit = structuredClone(record.audit);
    const initialIds = new Set(initialAudit.map((event) => event.id));

    updateChecklistItem(record, record.checklist[0].id, "in_progress", FIXED);
    await executeBlockAction(record, {
      integrationState: { configured: false, config: null },
      integration: null,
      now: FIXED,
    });

    expect(record.audit.length).toBeGreaterThan(initialAudit.length);
    for (const event of initialAudit) {
      expect(record.audit).toContainEqual(event);
    }
    const ids = record.audit.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const event of record.audit) {
      expect(initialIds.has(event.id) || event.analysisId === record.id).toBe(true);
    }
  });
});
