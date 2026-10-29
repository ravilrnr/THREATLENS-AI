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
import { getConfiguredIntegration } from "@/lib/remediation/integration";
import { executeBlockAction } from "@/lib/remediation/service";

const requestSchema = z
  .object({
    analysisId: z.string().min(1).max(120),
    /** Explicit confirmation is mandatory for a security-changing action. */
    confirm: z.literal(true, {
      message: "Explicit confirmation is required before executing a block action.",
    }),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
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

    const { state, integration } = getConfiguredIntegration();
    const outcome = await executeBlockAction(record, {
      integrationState: state,
      integration,
    });
    saveRecord(outcome.record);

    if (outcome.outcome === "not_configured") {
      return jsonFailure(
        409,
        "NOT_CONFIGURED",
        outcome.message,
        {
          headers,
          details: {
            record: outcome.record,
            attempted: false,
          },
        },
      );
    }

    if (outcome.outcome === "failed") {
      return jsonFailure(
        502,
        "INTEGRATION_ACTION_FAILED",
        outcome.message,
        {
          headers,
          details: {
            record: outcome.record,
          },
        },
      );
    }

    return jsonSuccess(outcome.record, { headers });
  } catch (error) {
    return handleRouteError(error);
  }
}
