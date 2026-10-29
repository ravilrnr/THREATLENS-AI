import { z } from "zod";
import {
  assertSafeOutboundUrl,
  OutboundTargetError,
  type HostResolver,
} from "@/lib/security/network";
import type { IndicatorType } from "@/types";

export interface IntegrationConfig {
  id: "webhook";
  name: string;
  endpoint: string;
  token: string;
  allowedHosts: string[];
  timeoutMs: number;
}

export interface IntegrationConfigState {
  configured: boolean;
  config: IntegrationConfig | null;
  reason?: string;
}

export interface IndicatorRef {
  indicator: string;
  indicatorType: IndicatorType;
}

export interface BlockStatusResult {
  blocked: boolean;
  message: string;
  checkedAt: string;
}

export interface BlockActionResult {
  ok: boolean;
  message: string;
  reference?: string;
}

export class IntegrationError extends Error {
  readonly code = "INTEGRATION_ERROR";
  readonly timedOut: boolean;
  constructor(message: string, timedOut = false) {
    super(message);
    this.name = "IntegrationError";
    this.timedOut = timedOut;
  }
}

const blockResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string().max(300).optional(),
  reference: z.string().max(200).optional(),
});

const statusResponseSchema = z.object({
  blocked: z.boolean(),
  message: z.string().max(300).optional(),
  checkedAt: z.string().max(64).optional(),
});

export function readIntegrationConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): IntegrationConfigState {
  const endpointRaw = env.BLOCK_INTEGRATION_URL?.trim();
  const token = env.BLOCK_INTEGRATION_TOKEN?.trim();
  const allowedHosts = (env.BLOCK_INTEGRATION_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (!endpointRaw && !token && allowedHosts.length === 0) {
    return { configured: false, config: null };
  }
  if (!endpointRaw) {
    return { configured: false, config: null, reason: "BLOCK_INTEGRATION_URL is missing." };
  }
  if (!token) {
    return {
      configured: false,
      config: null,
      reason: "BLOCK_INTEGRATION_TOKEN is missing. A least-privilege token is required.",
    };
  }
  if (allowedHosts.length === 0) {
    return {
      configured: false,
      config: null,
      reason: "BLOCK_INTEGRATION_ALLOWED_HOSTS must list the integration hostname.",
    };
  }

  let endpoint: URL;
  try {
    endpoint = new URL(endpointRaw);
  } catch {
    return {
      configured: false,
      config: null,
      reason: "BLOCK_INTEGRATION_URL is not a valid URL.",
    };
  }
  if (endpoint.protocol !== "https:") {
    return {
      configured: false,
      config: null,
      reason: "BLOCK_INTEGRATION_URL must use HTTPS.",
    };
  }
  if (!allowedHosts.includes(endpoint.hostname.toLowerCase())) {
    return {
      configured: false,
      config: null,
      reason: "The integration hostname is not in BLOCK_INTEGRATION_ALLOWED_HOSTS.",
    };
  }

  return {
    configured: true,
    config: {
      id: "webhook",
      name: (env.BLOCK_INTEGRATION_NAME?.trim() || "Generic Webhook Integration").slice(0, 80),
      endpoint: endpoint.toString(),
      token,
      allowedHosts,
      timeoutMs: 6000,
    },
  };
}

export interface RemediationIntegration {
  id: string;
  name: string;
  blockIndicator(ref: IndicatorRef): Promise<BlockActionResult>;
  getBlockStatus(ref: IndicatorRef): Promise<BlockStatusResult>;
}

export interface IntegrationDeps {
  fetchImpl?: typeof fetch;
  resolveHost?: HostResolver;
}

const MAX_BYTES = 50_000;

async function postAction(
  config: IntegrationConfig,
  body: Record<string, unknown>,
  deps: IntegrationDeps,
): Promise<unknown> {
  const fetchImpl = deps.fetchImpl ?? fetch;

  try {
    await assertSafeOutboundUrl(config.endpoint, {
      allowedHosts: config.allowedHosts,
      resolveHost: deps.resolveHost,
      label: "Remediation integration endpoint",
    });
  } catch (error) {
    throw new IntegrationError(
      error instanceof OutboundTargetError
        ? error.message
        : "Remediation integration failed the network safety check.",
    );
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
        authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    throw new IntegrationError(
      timedOut
        ? "The remediation integration did not respond before the timeout."
        : "The remediation integration request failed.",
      timedOut,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new IntegrationError(
      "The remediation integration rejected the configured credentials.",
    );
  }
  if (response.status === 429) {
    throw new IntegrationError(
      "The remediation integration rate-limited the request.",
    );
  }
  if (!response.ok) {
    throw new IntegrationError(
      `The remediation integration returned HTTP ${response.status}.`,
    );
  }

  const text = await response.text();
  if (text.length > MAX_BYTES) {
    throw new IntegrationError("The remediation integration response was too large.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new IntegrationError("The remediation integration returned invalid JSON.");
  }
}

export function createWebhookIntegration(
  config: IntegrationConfig,
  deps: IntegrationDeps = {},
): RemediationIntegration {
  return {
    id: config.id,
    name: config.name,
    async blockIndicator(ref: IndicatorRef): Promise<BlockActionResult> {
      const json = await postAction(
        config,
        {
          action: "block",
          indicator: ref.indicator,
          indicatorType: ref.indicatorType,
        },
        deps,
      );
      const parsed = blockResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new IntegrationError(
          "The integration block response did not match the documented contract.",
        );
      }
      return {
        ok: parsed.data.ok,
        message:
          parsed.data.message ??
          (parsed.data.ok
            ? "The integration reported the block as applied."
            : "The integration reported that the block was not applied."),
        reference: parsed.data.reference,
      };
    },
    async getBlockStatus(ref: IndicatorRef): Promise<BlockStatusResult> {
      const json = await postAction(
        config,
        {
          action: "status",
          indicator: ref.indicator,
          indicatorType: ref.indicatorType,
        },
        deps,
      );
      const parsed = statusResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new IntegrationError(
          "The integration status response did not match the documented contract.",
        );
      }
      let checkedAt = new Date().toISOString();
      if (parsed.data.checkedAt) {
        const parsedTime = Date.parse(parsed.data.checkedAt);
        if (Number.isFinite(parsedTime)) checkedAt = new Date(parsedTime).toISOString();
      }
      return {
        blocked: parsed.data.blocked,
        message:
          parsed.data.message ??
          (parsed.data.blocked
            ? "The integration reports the indicator as blocked."
            : "The integration reports the indicator as not blocked."),
        checkedAt,
      };
    },
  };
}

export function getConfiguredIntegration(
  env: NodeJS.ProcessEnv = process.env,
  deps: IntegrationDeps = {},
): { state: IntegrationConfigState; integration: RemediationIntegration | null } {
  const state = readIntegrationConfig(env);
  if (!state.configured || !state.config) {
    return { state, integration: null };
  }
  return {
    state,
    integration: createWebhookIntegration(state.config, deps),
  };
}
