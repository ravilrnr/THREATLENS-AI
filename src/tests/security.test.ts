import { describe, expect, it, vi } from "vitest";
import { PROVIDER_UNAVAILABLE_MESSAGE } from "@/lib/analysis/constants";
import {
  lookupThreatIntel,
  providerUnavailableSummary,
  readProviderConfig,
  type ProviderConfig,
} from "@/lib/providers/generic";
import {
  createWebhookIntegration,
  IntegrationError,
  readIntegrationConfig,
  type IntegrationConfig,
} from "@/lib/remediation/integration";
import {
  assertSafeOutboundUrl,
  isPrivateAddress,
  isPrivateIpv4,
  isPrivateIpv6,
  OutboundTargetError,
} from "@/lib/security/network";

const NOW = new Date("2026-03-04T05:06:07.000Z");

function providerConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "generic",
    name: "Test Provider",
    endpoint: "https://intel.example.com/lookup",
    apiKey: "provider-secret",
    allowedHosts: ["intel.example.com"],
    timeoutMs: 1000,
    ...overrides,
  };
}

function integrationConfig(
  overrides: Partial<IntegrationConfig> = {},
): IntegrationConfig {
  return {
    id: "webhook",
    name: "Test Gateway",
    endpoint: "https://gateway.example.com/actions",
    token: "integration-secret",
    allowedHosts: ["gateway.example.com"],
    timeoutMs: 1000,
    ...overrides,
  };
}

const publicResolver = async (): Promise<string[]> => ["93.184.216.34"];

describe("network safety guard", () => {
  it("classifies private and reserved addresses", () => {
    expect(isPrivateIpv4("10.1.2.3")).toBe(true);
    expect(isPrivateIpv4("172.16.0.1")).toBe(true);
    expect(isPrivateIpv4("172.32.0.1")).toBe(false);
    expect(isPrivateIpv4("192.168.1.1")).toBe(true);
    expect(isPrivateIpv4("127.0.0.1")).toBe(true);
    expect(isPrivateIpv4("169.254.169.254")).toBe(true);
    expect(isPrivateIpv4("93.184.216.34")).toBe(false);
    expect(isPrivateIpv6("::1")).toBe(true);
    expect(isPrivateIpv6("fe80::1")).toBe(true);
    expect(isPrivateIpv6("2001:db8::1")).toBe(true);
    expect(isPrivateIpv6("2606:4700::1111")).toBe(false);
    expect(isPrivateAddress("192.168.0.1")).toBe(true);
    expect(isPrivateAddress("not-an-address")).toBe(false);
  });

  it("accepts an allowlisted HTTPS hostname resolving to a public address", async () => {
    const url = await assertSafeOutboundUrl("https://intel.example.com/lookup", {
      allowedHosts: ["intel.example.com"],
      resolveHost: publicResolver,
    });
    expect(url.hostname).toBe("intel.example.com");
  });

  it("rejects HTTP, IP literals, local names, and non-allowlisted hosts", async () => {
    const resolveHost = publicResolver;
    const reject = async (url: string, allowedHosts = ["intel.example.com"]) => {
      await expect(
        assertSafeOutboundUrl(url, { allowedHosts, resolveHost }),
      ).rejects.toBeInstanceOf(OutboundTargetError);
    };

    await reject("http://intel.example.com/lookup");
    await reject("https://93.184.216.34/lookup");
    await reject("https://localhost/lookup", ["localhost"]);
    await reject("https://intel.example.com:8443/lookup");
    await reject("https://intel.example.com/lookup", ["other.example.com"]);
    await reject("https://user:pass@intel.example.com/lookup");
  });

  it("blocks a hostname that resolves to a private address", async () => {
    await expect(
      assertSafeOutboundUrl("https://intel.example.com/lookup", {
        allowedHosts: ["intel.example.com"],
        resolveHost: async () => ["10.0.0.5"],
      }),
    ).rejects.toThrow(/private or reserved/);
  });

  it("blocks a hostname that resolves to no addresses", async () => {
    await expect(
      assertSafeOutboundUrl("https://intel.example.com/lookup", {
        allowedHosts: ["intel.example.com"],
        resolveHost: async () => [],
      }),
    ).rejects.toThrow(/no addresses/);
  });
});

describe("provider configuration", () => {
  it("reports unconfigured with a safe summary and exact message", () => {
    const state = readProviderConfig({});
    expect(state.configured).toBe(false);
    expect(state.config).toBeNull();
    expect(providerUnavailableSummary(NOW).message).toBe(
      "Live threat intelligence is unavailable. Only local analysis is available.",
    );
    expect(PROVIDER_UNAVAILABLE_MESSAGE).toBe(
      "Live threat intelligence is unavailable. Only local analysis is available.",
    );
  });

  it("requires the generic adapter, HTTPS, and an explicit hostname allowlist", () => {
    expect(
      readProviderConfig({
        THREAT_INTEL_PROVIDER: "other",
        THREAT_INTEL_API_URL: "https://intel.example.com/lookup",
      }).reason,
    ).toMatch(/generic/);

    expect(
      readProviderConfig({
        THREAT_INTEL_PROVIDER: "generic",
        THREAT_INTEL_API_URL: "http://intel.example.com/lookup",
        THREAT_INTEL_ALLOWED_HOSTS: "intel.example.com",
      }).reason,
    ).toMatch(/HTTPS/);

    expect(
      readProviderConfig({
        THREAT_INTEL_PROVIDER: "generic",
        THREAT_INTEL_API_URL: "https://intel.example.com/lookup",
      }).reason,
    ).toMatch(/ALLOWED_HOSTS/);

    expect(
      readProviderConfig({
        THREAT_INTEL_PROVIDER: "generic",
        THREAT_INTEL_API_URL: "https://intel.example.com/lookup",
        THREAT_INTEL_ALLOWED_HOSTS: "other.example.com",
      }).reason,
    ).toMatch(/not present/);
  });

  it("accepts a complete configuration without exposing secrets in the state", () => {
    const state = readProviderConfig({
      THREAT_INTEL_PROVIDER: "generic",
      THREAT_INTEL_API_URL: "https://intel.example.com/lookup",
      THREAT_INTEL_ALLOWED_HOSTS: "intel.example.com",
      THREAT_INTEL_API_KEY: "provider-secret",
      THREAT_INTEL_NAME: "Test Provider",
    });
    expect(state.configured).toBe(true);
    expect(state.config?.name).toBe("Test Provider");
    expect(state.config?.apiKey).toBe("provider-secret");
  });
});

describe("provider lookup", () => {
  it("sends a bounded POST and maps a valid response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          verdict: "malicious",
          score: 91,
          tags: ["phishing"],
          reference: "case-1",
          checkedAt: "2026-03-01T00:00:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await lookupThreatIntel(
      providerConfig(),
      { indicator: "paypal-secure-login.xyz", indicatorType: "url", scope: "hostname" },
      { fetchImpl, resolveHost: publicResolver, now: () => NOW },
    );

    expect(result.status).toBe("ok");
    expect(result.verdict).toBe("malicious");
    expect(result.score).toBe(91);
    expect(result.queryScope).toBe("hostname");
    expect(result.retrievedAt).toBe(NOW.toISOString());
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [, init] = fetchImpl.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(init?.redirect).toBe("error");
    expect((init?.headers as Record<string, string>).authorization).toBe(
      "Bearer provider-secret",
    );
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      indicator: "paypal-secure-login.xyz",
      type: "url",
      scope: "hostname",
    });
  });

  it("never calls fetch when the endpoint resolves to a private address", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await lookupThreatIntel(
      providerConfig(),
      { indicator: "example.com", indicatorType: "domain", scope: "indicator" },
      {
        fetchImpl,
        resolveHost: async () => ["127.0.0.1"],
        now: () => NOW,
      },
    );
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/private or reserved/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps rate limiting, HTTP errors, and invalid JSON", async () => {
    const rateLimited = await lookupThreatIntel(
      providerConfig(),
      { indicator: "example.com", indicatorType: "domain", scope: "indicator" },
      {
        fetchImpl: vi.fn<typeof fetch>(async () => new Response("", { status: 429 })),
        resolveHost: publicResolver,
        now: () => NOW,
      },
    );
    expect(rateLimited.status).toBe("rate_limited");

    const serverError = await lookupThreatIntel(
      providerConfig(),
      { indicator: "example.com", indicatorType: "domain", scope: "indicator" },
      {
        fetchImpl: vi.fn<typeof fetch>(async () => new Response("", { status: 503 })),
        resolveHost: publicResolver,
        now: () => NOW,
      },
    );
    expect(serverError.status).toBe("error");
    expect(serverError.message).toContain("HTTP 503");

    const invalidJson = await lookupThreatIntel(
      providerConfig(),
      { indicator: "example.com", indicatorType: "domain", scope: "indicator" },
      {
        fetchImpl: vi.fn<typeof fetch>(async () => new Response("not-json")),
        resolveHost: publicResolver,
        now: () => NOW,
      },
    );
    expect(invalidJson.status).toBe("invalid_response");
  });

  it("rejects a response that does not match the documented contract", async () => {
    const result = await lookupThreatIntel(
      providerConfig(),
      { indicator: "example.com", indicatorType: "domain", scope: "indicator" },
      {
        fetchImpl: vi.fn<typeof fetch>(async () =>
          new Response(JSON.stringify({ verdict: "owned", score: 500 })),
        ),
        resolveHost: publicResolver,
        now: () => NOW,
      },
    );
    expect(result.status).toBe("invalid_response");
    expect(result.message).toMatch(/documented contract/);
  });

  it("rejects an oversized provider response", async () => {
    const result = await lookupThreatIntel(
      providerConfig(),
      { indicator: "example.com", indicatorType: "domain", scope: "indicator" },
      {
        fetchImpl: vi.fn<typeof fetch>(async () =>
          new Response("x".repeat(100_001)),
        ),
        resolveHost: publicResolver,
        now: () => NOW,
      },
    );
    expect(result.status).toBe("invalid_response");
    expect(result.message).toMatch(/size/);
  });

  it("maps a timeout without claiming a verdict", async () => {
    const timeoutError = new Error("The operation timed out");
    timeoutError.name = "TimeoutError";
    const result = await lookupThreatIntel(
      providerConfig(),
      { indicator: "example.com", indicatorType: "domain", scope: "indicator" },
      {
        fetchImpl: vi.fn<typeof fetch>(async () => {
          throw timeoutError;
        }),
        resolveHost: publicResolver,
        now: () => NOW,
      },
    );
    expect(result.status).toBe("timeout");
    expect(result.verdict).toBeUndefined();
  });

  it("never queries the submitted indicator itself", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ verdict: "unknown" })),
    );
    await lookupThreatIntel(
      providerConfig(),
      {
        indicator: "example.com",
        indicatorType: "url",
        scope: "hostname",
      },
      { fetchImpl, resolveHost: publicResolver, now: () => NOW },
    );
    for (const [url] of fetchImpl.mock.calls) {
      expect(String(url)).toBe("https://intel.example.com/lookup");
    }
  });
});

describe("remediation integration configuration", () => {
  it("is not configured by default", () => {
    const state = readIntegrationConfig({});
    expect(state.configured).toBe(false);
    expect(state.config).toBeNull();
  });

  it("requires URL, token, allowlist, and HTTPS", () => {
    expect(
      readIntegrationConfig({
        BLOCK_INTEGRATION_URL: "https://gateway.example.com/actions",
      }).reason,
    ).toMatch(/TOKEN/);

    expect(
      readIntegrationConfig({
        BLOCK_INTEGRATION_URL: "https://gateway.example.com/actions",
        BLOCK_INTEGRATION_TOKEN: "token",
      }).reason,
    ).toMatch(/ALLOWED_HOSTS/);

    expect(
      readIntegrationConfig({
        BLOCK_INTEGRATION_URL: "http://gateway.example.com/actions",
        BLOCK_INTEGRATION_TOKEN: "token",
        BLOCK_INTEGRATION_ALLOWED_HOSTS: "gateway.example.com",
      }).reason,
    ).toMatch(/HTTPS/);

    expect(
      readIntegrationConfig({
        BLOCK_INTEGRATION_URL: "https://gateway.example.com/actions",
        BLOCK_INTEGRATION_TOKEN: "token",
        BLOCK_INTEGRATION_ALLOWED_HOSTS: "other.example.com",
      }).reason,
    ).toMatch(/not in/);
  });

  it("accepts a complete configuration", () => {
    const state = readIntegrationConfig({
      BLOCK_INTEGRATION_URL: "https://gateway.example.com/actions",
      BLOCK_INTEGRATION_TOKEN: "integration-secret",
      BLOCK_INTEGRATION_ALLOWED_HOSTS: "gateway.example.com",
      BLOCK_INTEGRATION_NAME: "Test Gateway",
    });
    expect(state.configured).toBe(true);
    expect(state.config?.name).toBe("Test Gateway");
  });
});

describe("webhook integration adapter", () => {
  it("posts a confirmed block request and maps the response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ ok: true, message: "Blocked.", reference: "ref-1" })),
    );
    const integration = createWebhookIntegration(integrationConfig(), {
      fetchImpl,
      resolveHost: publicResolver,
    });

    const result = await integration.blockIndicator({
      indicator: "example.com",
      indicatorType: "domain",
    });

    expect(result).toEqual({
      ok: true,
      message: "Blocked.",
      reference: "ref-1",
    });
    const [, init] = fetchImpl.mock.calls[0];
    expect((init?.headers as Record<string, string>).authorization).toBe(
      "Bearer integration-secret",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      action: "block",
      indicator: "example.com",
      indicatorType: "domain",
    });
  });

  it("maps a block refusal without claiming success", async () => {
    const integration = createWebhookIntegration(integrationConfig(), {
      fetchImpl: vi.fn<typeof fetch>(async () =>
        new Response(JSON.stringify({ ok: false, message: "Policy denied." })),
      ),
      resolveHost: publicResolver,
    });
    const result = await integration.blockIndicator({
      indicator: "example.com",
      indicatorType: "domain",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Policy denied.");
  });

  it("reads a block status response", async () => {
    const integration = createWebhookIntegration(integrationConfig(), {
      fetchImpl: vi.fn<typeof fetch>(async () =>
        new Response(
          JSON.stringify({
            blocked: true,
            message: "Rule is active.",
            checkedAt: "2026-03-01T00:00:00.000Z",
          }),
        ),
      ),
      resolveHost: publicResolver,
    });
    const status = await integration.getBlockStatus({
      indicator: "example.com",
      indicatorType: "domain",
    });
    expect(status.blocked).toBe(true);
    expect(status.message).toBe("Rule is active.");
    expect(status.checkedAt).toBe("2026-03-01T00:00:00.000Z");
  });

  it("throws a typed error on rejected credentials", async () => {
    const integration = createWebhookIntegration(integrationConfig(), {
      fetchImpl: vi.fn<typeof fetch>(async () => new Response("", { status: 401 })),
      resolveHost: publicResolver,
    });
    await expect(
      integration.blockIndicator({ indicator: "example.com", indicatorType: "domain" }),
    ).rejects.toBeInstanceOf(IntegrationError);
    await expect(
      integration.blockIndicator({ indicator: "example.com", indicatorType: "domain" }),
    ).rejects.toThrow(/credentials/);
  });

  it("throws on a malformed status contract", async () => {
    const integration = createWebhookIntegration(integrationConfig(), {
      fetchImpl: vi.fn<typeof fetch>(async () =>
        new Response(JSON.stringify({ blocked: "yes" })),
      ),
      resolveHost: publicResolver,
    });
    await expect(
      integration.getBlockStatus({ indicator: "example.com", indicatorType: "domain" }),
    ).rejects.toThrow(/documented contract/);
  });

  it("refuses a private integration target before fetch", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const integration = createWebhookIntegration(integrationConfig(), {
      fetchImpl,
      resolveHost: async () => ["192.168.10.20"],
    });
    await expect(
      integration.blockIndicator({ indicator: "example.com", indicatorType: "domain" }),
    ).rejects.toThrow(/private or reserved/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
