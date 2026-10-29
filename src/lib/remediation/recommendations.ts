import type {
  AnalysisResult,
  ChecklistItem,
  Finding,
  ProviderVerdict,
} from "@/types";

export interface RecommendationContext {
  integrationConfigured: boolean;
  providerVerdict?: ProviderVerdict | null;
  providerVerified?: boolean;
}

const MANUAL_BLOCK_INSTRUCTIONS =
  "Use an authorized tool: add the indicator to a browser/endpoint block list, a DNS filtering policy, or a security gateway rule. Confirm the rule with the tool's own logs. ThreatLens does not apply this change for you.";

const EVIDENCE_INSTRUCTIONS =
  "Keep the original message headers, the full URL, timestamps, and the sender address. Do not forward live malicious links to other people.";

function hasFinding(findings: Finding[], ids: string[]): boolean {
  return findings.some((finding) => ids.includes(finding.id));
}

/**
 * Build a remediation checklist appropriate to the analyzer output. Items are
 * recommendations only until a user records a status or a configured
 * integration performs an action.
 */
export function generateChecklist(
  result: AnalysisResult,
  context: RecommendationContext,
): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const credentialThemed =
    hasFinding(result.findings, [
      "credential-theme-host",
      "credential-theme-domain",
      "brand-like-hostname",
      "brand-like-domain",
      "userinfo-component",
      "punycode-host",
      "punycode-domain",
    ]) || result.score >= 25;

  items.push({
    id: "do-not-open",
    title: "Do not open the link or enter credentials",
    description:
      "Until the indicator is verified through an independent channel, avoid visiting it or submitting passwords, MFA codes, or payment details.",
    category: "contain",
    status: "recommended",
    requiresIntegration: false,
  });

  items.push({
    id: "preserve-evidence",
    title: "Preserve the original message and indicators",
    description: EVIDENCE_INSTRUCTIONS,
    category: "contain",
    status: "recommended",
    requiresIntegration: false,
  });

  items.push({
    id: "verify-through-channel",
    title: "Verify the request through a separate channel",
    description:
      "Contact the organization using a phone number or website you already trust. Do not use contact details from the suspicious message.",
    category: "report",
    status: "recommended",
    requiresIntegration: false,
  });

  items.push({
    id: "report-message",
    title: "Report the message to the email or messaging provider",
    description:
      "Use the platform's built-in 'report phishing' action. For email, also report it to your organization's security team if applicable.",
    category: "report",
    status: "recommended",
    requiresIntegration: false,
  });

  if (credentialThemed) {
    items.push({
      id: "credential-response",
      title: "Respond as if credentials may be compromised",
      description:
        "Open the legitimate service directly, change the affected password, enable MFA, revoke active sessions, and notify the provider. Do this even if you are unsure whether the page was real.",
      category: "credential",
      status: "recommended",
      requiresIntegration: false,
    });
  }

  if (
    hasFinding(result.findings, [
      "executable-download",
      "double-extension",
      "archive-download",
    ])
  ) {
    items.push({
      id: "isolate-file",
      title: "Isolate and scan any downloaded file",
      description:
        "If the file was already downloaded, do not open it. Preserve it as evidence and submit it to an authorized malware scanning service or your security team.",
      category: "contain",
      status: "recommended",
      requiresIntegration: false,
    });
  }

  items.push({
    id: "manual-block",
    title: "Block the indicator through an authorized tool",
    description: MANUAL_BLOCK_INSTRUCTIONS,
    category: "technical",
    status: "recommended",
    requiresIntegration: false,
  });

  if (context.integrationConfigured) {
    items.push({
      id: "integration-block",
      title: "Apply the block through the configured integration",
      description:
        "A remediation integration is configured server-side. Use the controlled action panel, which requires explicit confirmation and records the integration's actual response.",
      category: "technical",
      status: "recommended",
      requiresIntegration: true,
    });
  }

  if (result.score >= 25) {
    items.push({
      id: "request-review",
      title: "Request a false-positive review if this is expected",
      description:
        "If you believe the indicator is legitimate, request a review. The detection is not automatically overridden; a reviewer must assess it.",
      category: "review",
      status: "recommended",
      requiresIntegration: false,
    });
  }

  items.push({
    id: "verify-remediation",
    title: "Run Verify Again after remediation",
    description:
      "Verification re-runs local analysis and asks any configured integration for the actual block status. A clean rescan alone does not prove a block exists.",
    category: "technical",
    status: "recommended",
    requiresIntegration: false,
  });

  return items;
}

/** Deduplicated, prioritized guidance shown alongside findings. */
export function deriveNextActions(items: ChecklistItem[]): string[] {
  const priority = ["do-not-open", "credential-response", "report-message", "manual-block", "verify-remediation"];
  return [...items]
    .sort((a, b) => {
      const ai = priority.indexOf(a.id);
      const bi = priority.indexOf(b.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .slice(0, 5)
    .map((item) => item.title);
}
