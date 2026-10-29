import { z } from "zod";
import { PROVIDER_UNAVAILABLE_MESSAGE } from "@/lib/analysis/constants";
import {
  assertSafeOutboundUrl,
  OutboundTargetError,
  type HostResolver,
} from "@/lib/security/network";
import type {
  IndicatorType,
  ProviderSummary,
  ProviderVerdict,
} from "@/types";

export interface ProviderConfig {
  id: "generic";
  name: string;
  endpoint: string;
  apiKey?: string;
  allowedHosts: string[];
  timeoutMs: number;
}

export interface ProviderConfigState {
  configured: boolean;
  config: ProviderConfig | null;
  /** Safe, non-secret explanation when configuration is incomplete. */
  reason?: string;
}

const providerResponseSchema = z.object({
  verdict: z.enum(["malicious", "suspicious", "clean", "unknown"]),
  score: z.number().min(0).max(100).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  reference: z.string().max(500).optional(),
  checkedAt: z.string().max(64).optional(),
  message: z.string().max(300).optional(),
});

export type ProviderResponse = z.infer<typeof providerResponseSchema>;

function parseAllowedHosts(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Read provider configuration from server-side environment variables only.
 * Never import this module into a client component.
 */
export function readProviderConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ProviderConfigState {
  const provider = env.THREAT_INTEL_PROVIDER?.trim();
  const endpointRaw = env.THREAT_INTEL_API_URL?.trim();
  const allowedHosts = parseAllowedHosts(env.THREAT_INTEL_ALLOWED_HOSTS);

  if (!provider && !endpointRaw) {
    return { configured: false, config: null };
  }
  if (provider !== "generic") {
    return {
      configured: false,
      config: null,
      reason: "THREAT_INTEL_PROVIDER must be set to \"generic\" for the built-in adapter.",
    };
  }
  if (!endpointRaw) {
    return {
      configured: false,
      config: null,
      reason: "THREAT_INTEL_API_URL is missing.",
    };
  }
  if (allowedHosts.length === 0) {
    return {
      configured: false,
      config: null,
      reason: "THREAT_INTEL_ALLOWED_HOSTS must list the provider hostname.",
    };
  }

  let endpoint: URL;
  try {
    endpoint = new URL(endpointRaw);
  } catch {
    return {
      configured: false,
      config: null,
      reason: "THREAT_INTEL_API_URL is not a valid URL.",
    };
  }
  if (endpoint.protocol !== "https:") {
    return {
      configured: false,
      config: null,
      reason: "THREAT_INTEL_API_URL must use HTTPS.",
    };
  }
  if (!allowedHosts.includes(endpoint.hostname.toLowerCase())) {
    return {
      configured: false,
      config: null,
      reason: "The provider hostname is not present in THREAT_INTEL_ALLOWED_HOSTS.",
    };
  }

  return {
    configured: true,
    config: {
      id: "generic",
      name: (env.THREAT_INTEL_NAME?.trim() || "Generic Threat Intelligence").slice(0, 80),
      endpoint: endpoint.toString(),
      apiKey: env.THREAT_INTEL_API_KEY?.trim() || undefined,
      allowedHosts,
      timeoutMs: 6000,
    },
  };
}

export function providerUnavailableSummary(now: Date = new Date()): ProviderSummary {
  return {
    status: "not_configured",
    providerName: null,
    retrievedAt: now.toISOString(),
    message: PROVIDER_UNAVAILABLE_MESSAGE,
  };
}

export function providerConfigurationErrorSummary(
  reason: string,
  now: Date = new Date(),
): ProviderSummary {
  return {
    status: "error",
    providerName: null,
    retrievedAt: now.toISOString(),
    message: `Threat intelligence provider is misconfigured: ${reason}`,
  };
}

export interface ProviderLookupDeps {
  fetchImpl?: typeof fetch;
  resolveHost?: HostResolver;
  now?: () => Date;
}

const MAX_PROVIDER_BYTES = 100_000;

/**
 * Query the configured provider with a bounded request. The submitted
 * indicator is sent as a POST body; ThreatLens never fetches the indicator
 * itself and never follows redirects.
 */
export async function lookupThreatIntel(
  config: ProviderConfig,
  input: {
    indicator: string;
    indicatorType: IndicatorType;
    scope: "hostname" | "indicator";
  },
  deps: ProviderLookupDeps = {},
): Promise<ProviderSummary> {
  const now = deps.now ? deps.now() : new Date();
  const fetchImpl = deps.fetchImpl ?? fetch;

  // Validate the operator endpoint immediately before every request (DNS
  // rebinding protection and allowlist enforcement).
  try {
    await assertSafeOutboundUrl(config.endpoint, {
      allowedHosts: config.allowedHosts,
      resolveHost: deps.resolveHost,
      label: "Threat intelligence endpoint",
    });
  } catch (error) {
    const message =
      error instanceof OutboundTargetError
        ? error.message
        : "Threat intelligence endpoint failed the network safety check.";
    return {
      status: "error",
      providerName: config.name,
      retrievedAt: now.toISOString(),
      message,
      queryScope: input.scope,
    };
  }

  let response: Response;
  try {
    response = await fetchImpl(config.endpoint, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(config.timeoutMs),
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        indicator: input.indicator,
        type: input.indicatorType,
        scope: input.scope,
      }),
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      status: isTimeout ? "timeout" : "error",
      providerName: config.name,
      retrievedAt: now.toISOString(),
      message: isTimeout
        ? "The threat intelligence provider did not respond before the timeout."
        : "The threat intelligence provider request failed.",
      queryScope: input.scope,
    };
  }

  if (response.status === 429) {
    return {
      status: "rate_limited",
      providerName: config.name,
      retrievedAt: now.toISOString(),
      message: "The threat intelligence provider rate-limited this request.",
      queryScope: input.scope,
    };
  }
  if (!response.ok) {
    return {
      status: "error",
      providerName: config.name,
      retrievedAt: now.toISOString(),
      message: `The threat intelligence provider returned HTTP ${response.status}.`,
      queryScope: input.scope,
    };
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    return {
      status: "error",
      providerName: config.name,
      retrievedAt: now.toISOString(),
      message: "The provider response could not be read.",
      queryScope: input.scope,
    };
  }
  if (text.length > MAX_PROVIDER_BYTES) {
    return {
      status: "invalid_response",
      providerName: config.name,
      retrievedAt: now.toISOString(),
      message: "The provider response exceeded the allowed size.",
      queryScope: input.scope,
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      status: "invalid_response",
      providerName: config.name,
      retrievedAt: now.toISOString(),
      message: "The provider returned invalid JSON.",
      queryScope: input.scope,
    };
  }

  const parsed = providerResponseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      status: "invalid_response",
      providerName: config.name,
      retrievedAt: now.toISOString(),
      message: "The provider response did not match the documented contract.",
      queryScope: input.scope,
    };
  }

  let checkedAt: string | undefined;
  if (parsed.data.checkedAt) {
    const timestamp = Date.parse(parsed.data.checkedAt);
    if (Number.isFinite(timestamp)) checkedAt = new Date(timestamp).toISOString();
  }

  return {
    status: "ok",
    providerName: config.name,
    verdict: parsed.data.verdict as ProviderVerdict,
    score: parsed.data.score,
    tags: parsed.data.tags,
    reference: parsed.data.reference,
    checkedAt,
    retrievedAt: now.toISOString(),
    message: parsed.data.message,
    queryScope: input.scope,
  };
}
