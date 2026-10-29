import { jsonSuccess } from "@/lib/api/response";
import { listRecords, serverStoreStats } from "@/lib/persistence/serverStore";

export async function GET(): Promise<Response> {
  return jsonSuccess({
    records: listRecords(),
    storage: {
      scope: "server-session",
      persistence: "in-memory",
      note: "Server-session records expire after 24 hours or when the process restarts. Browser-local history is stored separately on this device.",
      ...serverStoreStats(),
    },
  });
}
