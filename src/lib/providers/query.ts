import type { AnalysisResult, ProviderSummary } from "@/types";
import {
  lookupThreatIntel,
  providerConfigurationErrorSummary,
  providerUnavailableSummary,
  readProviderConfig,
} from "@/lib/providers/generic";

/**
 * Query the optional provider for an analysis result. URLs are reduced to the
 * hostname before leaving the server, and this behaviour is documented in the
 * README and Settings page.
 */
export async function queryProviderForResult(
  result: AnalysisResult,
): Promise<ProviderSummary> {
  const state = readProviderConfig();
  if (!state.configured) {
    return state.reason
      ? providerConfigurationErrorSummary(state.reason)
      : providerUnavailableSummary();
  }
  if (!state.config) {
    return providerConfigurationErrorSummary("Provider configuration is incomplete.");
  }

  const scope = result.indicatorType === "url" ? "hostname" : "indicator";
  const indicator =
    result.indicatorType === "url" ? (result.host ?? "") : result.normalized;

  if (!indicator) {
    return providerConfigurationErrorSummary(
      "The analysis did not produce an indicator that can be queried.",
    );
  }

  return lookupThreatIntel(state.config, {
    indicator,
    indicatorType: result.indicatorType,
    scope,
  });
}
