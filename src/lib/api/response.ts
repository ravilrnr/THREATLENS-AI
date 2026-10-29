import { ZodError, type ZodType } from "zod";
import { rateLimitHeaders, type RateLimitResult } from "@/lib/security/rateLimit";

export interface ApiErrorOptions {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.headers = options.headers;
  }
}

const NO_STORE = { "Cache-Control": "no-store" } as const;

function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  return { ...NO_STORE, "Content-Type": "application/json; charset=utf-8", ...extra };
}

export function jsonSuccess<T>(
  data: T,
  options: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: options.status ?? 200,
    headers: baseHeaders(options.headers),
  });
}

export function jsonFailure(
  status: number,
  code: string,
  message: string,
  options: { details?: unknown; headers?: Record<string, string> } = {},
): Response {
  const body: Record<string, unknown> = {
    ok: false,
    error: { code, message },
  };
  if (options.details !== undefined && options.details !== null) {
    body.error = { ...(body.error as object), details: options.details };
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: baseHeaders(options.headers),
  });
}

export function handleRouteError(error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonFailure(error.status, error.code, error.message, {
      details: error.details,
      headers: error.headers,
    });
  }
  if (error instanceof ZodError) {
    return jsonFailure(400, "VALIDATION_ERROR", "The request body is invalid.", {
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  // Log server-side for diagnosis but never return stack traces or internals.
  console.error(
    "[threatlens] Unhandled API error:",
    error instanceof Error ? error.name : "UnknownError",
  );
  return jsonFailure(
    500,
    "INTERNAL_ERROR",
    "An unexpected server error occurred. No action was performed.",
  );
}

export function enforceRateLimit(
  request: Request,
  category: "analyze" | "remediation" | "verify",
  consume: (
    request: Request,
    category: "analyze" | "remediation" | "verify",
  ) => RateLimitResult,
): Record<string, string> {
  const result = consume(request, category);
  const headers = rateLimitHeaders(result);
  if (!result.allowed) {
    throw new ApiError({
      status: 429,
      code: "RATE_LIMITED",
      message: "Too many requests. Wait a moment before trying again.",
      headers,
    });
  }
  return headers;
}

export function getMaxBodyBytes(): number {
  const parsed = Number(process.env.THREATLENS_MAX_BODY_BYTES ?? "");
  if (Number.isFinite(parsed) && parsed >= 1024 && parsed <= 1_000_000) {
    return Math.floor(parsed);
  }
  return 16_384;
}

/** Read and bound a JSON request body without trusting Content-Length alone. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const limit = getMaxBodyBytes();
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > limit) {
    throw new ApiError({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: `Request bodies must be ${limit} bytes or fewer.`,
    });
  }
  if (!request.body) {
    throw new ApiError({
      status: 400,
      code: "EMPTY_BODY",
      message: "A JSON request body is required.",
    });
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > limit) {
          await reader.cancel().catch(() => undefined);
          throw new ApiError({
            status: 413,
            code: "PAYLOAD_TOO_LARGE",
            message: `Request bodies must be ${limit} bytes or fewer.`,
          });
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) {
    throw new ApiError({
      status: 400,
      code: "EMPTY_BODY",
      message: "A JSON request body is required.",
    });
  }

  const text = new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError({
      status: 400,
      code: "INVALID_JSON",
      message: "The request body is not valid JSON.",
    });
  }
  return json;
}

export function validateBody<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "The request body is invalid.",
      details: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

export const DISCLAIMER_SHORT =
  "Local heuristics only. Not a malware verdict or a guarantee of safety.";
