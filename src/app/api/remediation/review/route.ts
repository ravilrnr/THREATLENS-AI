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
import { getRecord, saveRecord } from "@/lib/persistence/serverStore";
import { requestFalsePositiveReview } from "@/lib/remediation/service";

const requestSchema = z
  .object({
    analysisId: z.string().min(1).max(120),
    reason: z.string().max(500).optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const headers = enforceRateLimit(request, "remediation", consumeRateLimit);
    const body = validateBody(requestSchema, await readJsonBody(request));

    const record = getRecord(body.analysisId);
    if (!record) {
      return jsonFailure(
        404,
        "NOT_FOUND",
        "That analysis is not loaded in the current server session. Re-run the analysis to continue.",
      );
    }

    const reason = body.reason?.trim() || undefined;
    requestFalsePositiveReview(record, reason);
    saveRecord(record);

    return jsonSuccess(record, { headers });
  } catch (error) {
    return handleRouteError(error);
  }
}
