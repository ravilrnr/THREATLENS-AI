import { ApiError } from "@/lib/api/response";

/**
 * CSRF-style origin check for state-changing remediation endpoints. Requests
 * without an Origin header (CLI, same-origin server calls) are allowed; a
 * present and mismatched browser Origin is rejected. Configure
 * THREATLENS_ALLOWED_ORIGIN when running behind a rewriting proxy.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  if (origin === "null") {
    throw new ApiError({
      status: 403,
      code: "ORIGIN_REJECTED",
      message: "This request origin is not allowed to change remediation state.",
    });
  }

  let originUrl: URL;
  let requestUrl: URL;
  try {
    originUrl = new URL(origin);
    requestUrl = new URL(request.url);
  } catch {
    throw new ApiError({
      status: 403,
      code: "ORIGIN_REJECTED",
      message: "The request origin could not be validated.",
    });
  }

  const configured = (process.env.THREATLENS_ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const allowed =
    originUrl.host === requestUrl.host ||
    configured.includes(originUrl.origin);

  if (!allowed) {
    throw new ApiError({
      status: 403,
      code: "ORIGIN_REJECTED",
      message: "Cross-origin remediation requests are not permitted.",
    });
  }
}
