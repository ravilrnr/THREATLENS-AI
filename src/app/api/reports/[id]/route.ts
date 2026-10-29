import { jsonFailure, jsonSuccess } from "@/lib/api/response";
import { getRecord } from "@/lib/persistence/serverStore";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) {
    return jsonFailure(400, "INVALID_ID", "The report ID is invalid.");
  }
  const record = getRecord(id);
  if (!record) {
    return jsonFailure(
      404,
      "NOT_FOUND",
      "This report is not available in the current server session. Browser-local snapshots may still be available in Analysis History.",
    );
  }
  return jsonSuccess(record);
}
