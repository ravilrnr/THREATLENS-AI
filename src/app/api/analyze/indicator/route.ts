import { z } from "zod";
import { analyzeIndicator } from "@/lib/analysis/indicator";
import {
  IndicatorValidationError,
  parseIndicator,
} from "@/lib/validation/indicator";
import { queryProviderForResult } from "@/lib/providers/query";
import { readIntegrationConfig } from "@/lib/remediation/integration";
import { generateChecklist } from "@/lib/remediation/recommendations";
import { createAnalysisRecord } from "@/lib/remediation/records";
import { saveRecord } from "@/lib/persistence/serverStore";
import {
  enforceRateLimit,
  handleRouteError,
  jsonFailure,
  jsonSuccess,
  readJsonBody,
  validateBody,
} from "@/lib/api/response";
import { consumeRateLimit } from "@/lib/security/rateLimit";

const requestSchema = z
  .object({
    indicator: z
      .string()
      .min(1, "An IP address or domain is required.")
      .max(320, "The indicator is too long."),
    indicatorType: z.enum(["ipv4", "domain"]).optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const headers = enforceRateLimit(request, "analyze", consumeRateLimit);
    const body = validateBody(requestSchema, await readJsonBody(request));

    const parsed = parseIndicator(body.indicator);
    if (body.indicatorType && body.indicatorType !== parsed.type) {
      return jsonFailure(
        400,
        "INDICATOR_TYPE_MISMATCH",
        `The input was recognized as a ${parsed.type}, not a ${body.indicatorType}.`,
      );
    }

    const result = analyzeIndicator(body.indicator);
    const provider = await queryProviderForResult(result);
    const checklist = generateChecklist(result, {
      integrationConfigured: readIntegrationConfig().configured,
      providerVerdict: provider.verdict ?? null,
      providerVerified: provider.status === "ok",
    });
    const record = createAnalysisRecord(result, provider, checklist);
    saveRecord(record);

    return jsonSuccess(record, { status: 201, headers });
  } catch (error) {
    if (error instanceof IndicatorValidationError) {
      return jsonFailure(400, error.code, error.message);
    }
    return handleRouteError(error);
  }
}
