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
import { assertSameOrigin } from "@/lib/security/origin";
import { getRecord, saveRecord } from "@/lib/persistence/serverStore";
import { runVerification } from "@/lib/remediation/service";

const requestSchema = z
  .object({
    analysisId: z.string().min(1).max(120),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const headers = enforceRateLimit(request, "verify", consumeRateLimit);
    const body = validateBody(requestSchema, await readJsonBody(request));

    const record = getRecord(body.analysisId);
    if (!record) {
      return jsonFailure(
        404,
        "NOT_FOUND",
        "That analysis is not loaded in the current server session. Re-run the analysis to enable verification.",
      );
    }

    await runVerification(record);
    saveRecord(record);

    return jsonSuccess(record, { headers });
  } catch (error) {
    return handleRouteError(error);
  }
}
