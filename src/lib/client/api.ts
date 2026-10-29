import type { ApiFailure, ApiSuccess } from "@/types";

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      details?: unknown;
    };

function isFailure(value: unknown): value is ApiFailure {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ApiFailure>;
  return (
    candidate.ok === false &&
    Boolean(candidate.error) &&
    typeof candidate.error?.message === "string" &&
    typeof candidate.error?.code === "string"
  );
}

function isSuccess<T>(value: unknown): value is ApiSuccess<T> {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { ok?: unknown }).ok === true &&
      "data" in (value as object),
  );
}

/**
 * Call a ThreatLens route handler and normalize every outcome into a typed
 * result. Network failures and non-JSON responses never surface stack traces.
 */
export async function apiRequest<T>(
  input: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, {
      cache: "no-store",
      credentials: "same-origin",
      ...init,
      headers: {
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    return {
      ok: false,
      status: 0,
      code: "NETWORK_ERROR",
      message:
        "The request could not reach the ThreatLens server. Check that the app is running and try again.",
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.ok && isSuccess<T>(payload)) {
    return { ok: true, data: payload.data, status: response.status };
  }
  if (isFailure(payload)) {
    return {
      ok: false,
      status: response.status,
      code: payload.error.code,
      message: payload.error.message,
      details: payload.error.details,
    };
  }
  return {
    ok: false,
    status: response.status,
    code: "UNEXPECTED_RESPONSE",
    message: `The server returned an unexpected response (HTTP ${response.status}). No success is assumed.`,
  };
}

/** Extract a record from failure details when a route reports partial progress. */
export function recordFromDetails<T>(details: unknown): T | null {
  if (!details || typeof details !== "object") return null;
  const record = (details as { record?: unknown }).record;
  return record && typeof record === "object" ? (record as T) : null;
}
