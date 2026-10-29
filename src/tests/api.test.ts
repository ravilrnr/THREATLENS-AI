import { describe, expect, it } from "vitest";
import { POST as analyzeUrlPost } from "@/app/api/analyze/url/route";
import { POST as analyzeIndicatorPost } from "@/app/api/analyze/indicator/route";
import { POST as recommendPost } from "@/app/api/remediation/recommend/route";
import { POST as checklistPost } from "@/app/api/remediation/checklist/route";
import { POST as executePost } from "@/app/api/remediation/execute/route";
import { POST as reviewPost } from "@/app/api/remediation/review/route";
import { POST as verifyPost } from "@/app/api/remediation/verify/route";
import { GET as historyGet } from "@/app/api/history/route";
import { GET as reportGet } from "@/app/api/reports/[id]/route";
import { GET as statusGet } from "@/app/api/status/route";
import { PROVIDER_UNAVAILABLE_MESSAGE } from "@/lib/analysis/constants";
import type {
  AnalysisRecord,
  ApiFailure,
  ApiSuccess,
  SystemStatus,
} from "@/types";

function jsonRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function analyzeExample(): Promise<AnalysisRecord> {
  const response = await analyzeUrlPost(
    jsonRequest("/api/analyze/url", { url: "https://www.example.com/login" }),
  );
  expect(response.status).toBe(201);
  const body = await readJson<ApiSuccess<AnalysisRecord>>(response);
  return body.data;
}

describe("URL analysis API", () => {
  it("returns a validated record and the exact provider-unavailable message", async () => {
    const record = await analyzeExample();

    expect(record.indicatorType).toBe("url");
    expect(record.method).toBe("local-heuristic");
    expect(record.state).toBe("FIX_RECOMMENDED");
    expect(record.score).toBeGreaterThanOrEqual(0);
    expect(record.provider?.status).toBe("not_configured");
    expect(record.provider?.message).toBe(PROVIDER_UNAVAILABLE_MESSAGE);
    expect(record.checklist.length).toBeGreaterThan(0);
    expect(record.audit.length).toBeGreaterThan(0);
  });

  it("rejects an invalid URL with a structured 400", async () => {
    const response = await analyzeUrlPost(
      jsonRequest("/api/analyze/url", { url: "not-a-url" }),
    );
    expect(response.status).toBe(400);
    const body = await readJson<ApiFailure>(response);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INVALID_URL");
    expect(body.error.message).toMatch(/scheme/i);
  });

  it("rejects malformed JSON and empty bodies", async () => {
    const malformed = await analyzeUrlPost(
      jsonRequest("/api/analyze/url", "{not-json"),
    );
    expect(malformed.status).toBe(400);
    expect((await readJson<ApiFailure>(malformed)).error.code).toBe("INVALID_JSON");

    const empty = await analyzeUrlPost(
      new Request("http://localhost/api/analyze/url", {
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(empty.status).toBe(400);
    expect((await readJson<ApiFailure>(empty)).error.code).toBe("EMPTY_BODY");
  });

  it("rejects unknown fields with schema validation", async () => {
    const response = await analyzeUrlPost(
      jsonRequest("/api/analyze/url", {
        url: "https://www.example.com/",
        state: "VERIFIED",
      }),
    );
    expect(response.status).toBe(400);
    const body = await readJson<ApiFailure>(response);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toBeDefined();
  });

  it("rejects oversized request bodies", async () => {
    const response = await analyzeUrlPost(
      jsonRequest("/api/analyze/url", {
        url: `https://example.com/${"a".repeat(17_000)}`,
      }),
    );
    expect(response.status).toBe(413);
    expect((await readJson<ApiFailure>(response)).error.code).toBe(
      "PAYLOAD_TOO_LARGE",
    );
  });

  it("enforces the configured analyze rate limit", async () => {
    process.env.THREATLENS_RATE_LIMIT_ANALYZE = "2";
    const request = () =>
      jsonRequest("/api/analyze/url", { url: "https://www.example.com/" });

    expect((await analyzeUrlPost(request())).status).toBe(201);
    expect((await analyzeUrlPost(request())).status).toBe(201);

    const limited = await analyzeUrlPost(request());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    const body = await readJson<ApiFailure>(limited);
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("returns no stack traces or internals for unexpected failures", async () => {
    const original = process.env.THREATLENS_MAX_BODY_BYTES;
    process.env.THREATLENS_MAX_BODY_BYTES = "not-a-number";
    try {
      const response = await analyzeUrlPost(
        jsonRequest("/api/analyze/url", { url: "https://www.example.com/" }),
      );
      expect(response.status).toBe(201);
      const text = await response.text();
      expect(text).not.toMatch(/at .*\.ts/);
    } finally {
      if (original === undefined) delete process.env.THREATLENS_MAX_BODY_BYTES;
      else process.env.THREATLENS_MAX_BODY_BYTES = original;
    }
  });
});

describe("indicator analysis API", () => {
  it("accepts a domain and rejects mismatched or invalid indicators", async () => {
    const ok = await analyzeIndicatorPost(
      jsonRequest("/api/analyze/indicator", { indicator: "example.com" }),
    );
    expect(ok.status).toBe(201);
    const record = (await readJson<ApiSuccess<AnalysisRecord>>(ok)).data;
    expect(record.indicatorType).toBe("domain");
    expect(record.provider?.status).toBe("not_configured");

    const mismatch = await analyzeIndicatorPost(
      jsonRequest("/api/analyze/indicator", {
        indicator: "example.com",
        indicatorType: "ipv4",
      }),
    );
    expect(mismatch.status).toBe(400);
    expect((await readJson<ApiFailure>(mismatch)).error.code).toBe(
      "INDICATOR_TYPE_MISMATCH",
    );

    const invalid = await analyzeIndicatorPost(
      jsonRequest("/api/analyze/indicator", { indicator: "999.1.1.1" }),
    );
    expect(invalid.status).toBe(400);
    expect((await readJson<ApiFailure>(invalid)).error.code).toBe(
      "INVALID_INDICATOR",
    );
  });
});

describe("remediation API", () => {
  it("returns recommendations and updates a checklist item", async () => {
    const record = await analyzeExample();

    const recommend = await recommendPost(
      jsonRequest("/api/remediation/recommend", { analysisId: record.id }),
    );
    expect(recommend.status).toBe(200);
    const recommended = await readJson<
      ApiSuccess<{ record: AnalysisRecord; checklist: AnalysisRecord["checklist"] }>
    >(recommend);
    expect(recommended.data.checklist.length).toBeGreaterThan(0);

    const itemId = recommended.data.checklist[0].id;
    const checklist = await checklistPost(
      jsonRequest("/api/remediation/checklist", {
        analysisId: record.id,
        itemId,
        status: "in_progress",
      }),
    );
    expect(checklist.status).toBe(200);
    const updated = (await readJson<ApiSuccess<AnalysisRecord>>(checklist)).data;
    expect(updated.state).toBe("REMEDIATION_PENDING");
    expect(updated.checklist.find((item) => item.id === itemId)?.status).toBe(
      "in_progress",
    );
  });

  it("requires explicit confirmation before a block action", async () => {
    const record = await analyzeExample();
    const response = await executePost(
      jsonRequest("/api/remediation/execute", { analysisId: record.id }),
    );
    expect(response.status).toBe(400);
    const body = await readJson<ApiFailure>(response);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(body)).toMatch(/confirmation/i);
  });

  it("returns Not Configured instead of claiming a block", async () => {
    const record = await analyzeExample();
    const response = await executePost(
      jsonRequest("/api/remediation/execute", {
        analysisId: record.id,
        confirm: true,
      }),
    );
    expect(response.status).toBe(409);
    const body = await readJson<
      ApiFailure & { error: { details: { record: AnalysisRecord; attempted: boolean } } }
    >(response);
    expect(body.error.code).toBe("NOT_CONFIGURED");
    expect(body.error.details.attempted).toBe(false);
    expect(body.error.details.record.state).toBe("NOT_CONFIGURED");
    expect(body.error.details.record.actions[0].status).toBe("not_configured");
    expect(body.error.details.record.verification).toBeNull();
  });

  it("rejects cross-origin state-changing requests", async () => {
    const record = await analyzeExample();
    const response = await executePost(
      jsonRequest(
        "/api/remediation/execute",
        { analysisId: record.id, confirm: true },
        { origin: "https://attacker.example" },
      ),
    );
    expect(response.status).toBe(403);
    expect((await readJson<ApiFailure>(response)).error.code).toBe(
      "ORIGIN_REJECTED",
    );
  });

  it("keeps verification pending/unconfigured without an integration", async () => {
    const record = await analyzeExample();
    const response = await verifyPost(
      jsonRequest("/api/remediation/verify", { analysisId: record.id }),
    );
    expect(response.status).toBe(200);
    const verified = (await readJson<ApiSuccess<AnalysisRecord>>(response)).data;
    expect(verified.state).not.toBe("VERIFIED");
    expect(verified.state).toBe("NOT_CONFIGURED");
    expect(verified.verification?.status).toBe("not_configured");
  });

  it("records a false-positive review request without overriding the score", async () => {
    const record = await analyzeExample();
    const scoreBefore = record.score;
    const response = await reviewPost(
      jsonRequest("/api/remediation/review", {
        analysisId: record.id,
        reason: "Internal test domain.",
      }),
    );
    expect(response.status).toBe(200);
    const reviewed = (await readJson<ApiSuccess<AnalysisRecord>>(response)).data;
    expect(reviewed.state).toBe("FALSE_POSITIVE_PENDING_REVIEW");
    expect(reviewed.score).toBe(scoreBefore);
    expect(reviewed.review?.reason).toBe("Internal test domain.");
  });

  it("returns NOT_FOUND for unknown analysis IDs", async () => {
    const response = await executePost(
      jsonRequest("/api/remediation/execute", {
        analysisId: "tl_missing",
        confirm: true,
      }),
    );
    expect(response.status).toBe(404);
    expect((await readJson<ApiFailure>(response)).error.code).toBe("NOT_FOUND");
  });
});

describe("report, history, and status APIs", () => {
  it("serves a stored report and validates the ID", async () => {
    const record = await analyzeExample();
    const found = await reportGet(new Request("http://localhost/api/reports/x"), {
      params: Promise.resolve({ id: record.id }),
    });
    expect(found.status).toBe(200);
    expect((await readJson<ApiSuccess<AnalysisRecord>>(found)).data.id).toBe(record.id);

    const invalid = await reportGet(new Request("http://localhost/api/reports/x"), {
      params: Promise.resolve({ id: "../secret" }),
    });
    expect(invalid.status).toBe(400);

    const missing = await reportGet(new Request("http://localhost/api/reports/x"), {
      params: Promise.resolve({ id: "tl_missing" }),
    });
    expect(missing.status).toBe(404);
  });

  it("lists server-session history with explicit storage scope", async () => {
    await analyzeExample();
    const response = await historyGet();
    expect(response.status).toBe(200);
    const body = await readJson<
      ApiSuccess<{
        records: Array<{ id: string }>;
        storage: { scope: string; persistence: string; count: number };
      }>
    >(response);
    expect(body.data.records.length).toBe(1);
    expect(body.data.storage.scope).toBe("server-session");
    expect(body.data.storage.persistence).toBe("in-memory");
    expect(body.data.storage.count).toBe(1);
  });

  it("reports configuration without exposing secrets or endpoints", async () => {
    process.env.THREAT_INTEL_PROVIDER = "generic";
    process.env.THREAT_INTEL_API_URL = "https://intel.example.com/lookup";
    process.env.THREAT_INTEL_ALLOWED_HOSTS = "intel.example.com";
    process.env.THREAT_INTEL_API_KEY = "provider-secret-value";
    process.env.BLOCK_INTEGRATION_URL = "https://gateway.example.com/actions";
    process.env.BLOCK_INTEGRATION_TOKEN = "integration-secret-value";
    process.env.BLOCK_INTEGRATION_ALLOWED_HOSTS = "gateway.example.com";

    const response = await statusGet();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("provider-secret-value");
    expect(text).not.toContain("integration-secret-value");
    expect(text).not.toContain("intel.example.com/lookup");
    expect(text).not.toContain("gateway.example.com/actions");

    const body = JSON.parse(text) as ApiSuccess<SystemStatus>;
    expect(body.data.provider.configured).toBe(true);
    expect(body.data.integration.configured).toBe(true);
    expect(body.data.behavior.fetchesSubmittedIndicators).toBe(false);
    expect(body.data.behavior.sendsUrlPathToProvider).toBe(false);
    expect(body.data.providerUnavailableMessage).toBe(PROVIDER_UNAVAILABLE_MESSAGE);
  });
});
