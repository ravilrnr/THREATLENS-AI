import { z } from "zod";
import {
  enforceRateLimit,
  handleRouteError,
  jsonFailure,
  jsonSuccess,
  readJsonBody,
  validateBody,
} from "@/lib/api/response";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import { getRecord, mutateRecord } from "@/lib/persistence/serverStore";
import { generateChecklist, deriveNextActions } from "@/lib/remediation/recommendations";
import { readIntegrationConfig } from "@/lib/remediation/integration";
import { appendAudit } from "@/lib/audit";
import type { AnalysisRecord } from "@/types";

const requestSchema = z
  .object({
    analysisId: z.string().min(1).max(120),
  })
  .strict();

function ensureChecklist(record: AnalysisRecord): AnalysisRecord {
  if (record.checklist.length > 0) return record;
  const checklist = generateChecklist(
    {
      indicatorType: record.indicatorType,
      input: record.input,
      normalized: record.normalized,
      host: record.host,
      score: record.score,
      severity: record.severity,
      findings: record.findings,
      limitations: [],
      method: record.method,
      analyzedAt: record.createdAt,
    },
    {
      integrationConfigured: readIntegrationConfig().configured,
      providerVerdict: record.provider?.verdict ?? null,
    },
  );
  record.checklist = checklist;
  appendAudit(
    record,
    "RECOMMENDATIONS_GENERATED",
    "success",
    `${checklist.length} remediation checklist item(s) generated.`,
    { checklistCount: checklist.length },
  );
  return record;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const headers = enforceRateLimit(request, "remediation", consumeRateLimit);
    const body = validateBody(requestSchema, await readJsonBody(request));

    if (!getRecord(body.analysisId)) {
      return jsonFailure(
        404,
        "NOT_FOUND",
        "That analysis is not loaded in the current server session. Re-run the analysis to generate a fresh record.",
      );
    }

    const record = mutateRecord(body.analysisId, ensureChecklist);
    if (!record) {
      return jsonFailure(404, "NOT_FOUND", "Analysis not found.");
    }

    return jsonSuccess(
      {
        record,
        checklist: record.checklist,
        nextActions: deriveNextActions(record.checklist),
      },
      { headers },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
