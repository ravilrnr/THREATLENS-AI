import { jsonSuccess } from "@/lib/api/response";
import { readProviderConfig } from "@/lib/providers/generic";
import { readIntegrationConfig } from "@/lib/remediation/integration";
import { getRateLimitLimits } from "@/lib/security/rateLimit";
import { serverStoreStats } from "@/lib/persistence/serverStore";
import { DISCLAIMER, PROVIDER_UNAVAILABLE_MESSAGE } from "@/lib/analysis/constants";

/**
 * Configuration status for the Settings page. Only safe booleans, names, and
 * reasons are returned. Endpoints, tokens, and API keys never leave the server.
 */
export async function GET(): Promise<Response> {
  const provider = readProviderConfig();
  const integration = readIntegrationConfig();

  return jsonSuccess({
    provider: {
      configured: provider.configured,
      name: provider.config?.name ?? null,
      reason: provider.reason ?? null,
    },
    integration: {
      configured: integration.configured,
      name: integration.config?.name ?? null,
      reason: integration.reason ?? null,
    },
    storage: {
      persistence: "in-memory",
      scope: "server-session",
      ...serverStoreStats(),
    },
    rateLimits: getRateLimitLimits(),
    behavior: {
      fetchesSubmittedIndicators: false,
      sendsUrlPathToProvider: false,
      providerQueryScope: "hostname-only for URL analyses",
      demoModeIsBrowserLocal: true,
    },
    providerUnavailableMessage: PROVIDER_UNAVAILABLE_MESSAGE,
    disclaimer: DISCLAIMER,
    externalLookupsDisclosure:
      "If a threat intelligence provider is configured, the hostname of a URL or the submitted IP/domain is sent to that provider over HTTPS. Page contents, paths, query strings, and credentials are never sent. The submitted indicator itself is never fetched.",
  });
}
