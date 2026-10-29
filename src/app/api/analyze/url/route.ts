import { z } from "zod";
import { analyzeUrl } from "@/lib/analysis/url";
import { UrlValidationError, MAX_URL_LENGTH } from "@/lib/validation/url";
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
    url: z
      .string()
      .min(1, "A URL is required.")
      .max(MAX_URL_LENGTH + 1, "The URL is too long."),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const headers = enforceRateLimit(request, "analyze", consumeRateLimit);
    const body = validateBody(requestSchema, await readJsonBody(request));

    const result = analyzeUrl(body.url);
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
    if (error instanceof UrlValidationError) {
      return jsonFailure(400, error.code, error.message);
    }
    return handleRouteError(error);
  }
}
