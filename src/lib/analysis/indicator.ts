import {
  CREDENTIAL_THEME_WORDS,
  DISCLAIMER,
  HIGH_ABUSE_TLDS,
} from "@/lib/analysis/constants";
import { scoreFindings, severityFromScore } from "@/lib/scoring";
import {
  countSubdomains,
  isBrandImpersonation,
  isIpv6Host,
} from "@/lib/validation/url";
import { parseIndicator, type ParsedIndicator } from "@/lib/validation/indicator";
import type { AnalysisResult, Finding, Severity } from "@/types";

interface FindingDraft {
  id: string;
  title: string;
  severity: Severity;
  category: Finding["category"];
  explanation: string;
  evidence: string;
  impact: string;
  confidence: Finding["confidence"];
  recommendation: string;
  scoreContribution: number;
}

const toFinding = (draft: FindingDraft): Finding => ({ ...draft });

export const INDICATOR_LIMITATIONS = [
  "This analyzer performs local syntax and pattern checks only. It does not resolve DNS, query WHOIS, determine geolocation or ASN ownership, or retrieve abuse reports.",
  "No network connection is made to the submitted IP address or domain. ThreatLens never contacts submitted indicators.",
  "If a threat intelligence provider is configured, its verdict is shown separately and is never treated as proof that an unconfigured check succeeded.",
  "A low score does not mean an indicator is safe. Private IP ranges are reported for context, not as malicious findings.",
  DISCLAIMER,
];

export function classifyIpv4(ip: string): {
  scope:
    | "public"
    | "private"
    | "loopback"
    | "link_local"
    | "documentation"
    | "reserved"
    | "multicast";
  label: string;
} {
  const [a, b] = ip.split(".").map(Number);
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
    return { scope: "private", label: "Private (RFC 1918) address" };
  }
  if (a === 127) return { scope: "loopback", label: "Loopback address" };
  if (a === 169 && b === 254) return { scope: "link_local", label: "Link-local address" };
  if (
    (a === 192 && b === 0) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0)
  ) {
    return { scope: "documentation", label: "Documentation/example range" };
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return { scope: "reserved", label: "Shared address space (RFC 6598)" };
  }
  if (a >= 224 && a <= 239) return { scope: "multicast", label: "Multicast address" };
  if (a >= 240) return { scope: "reserved", label: "Reserved address space" };
  if (a === 0) return { scope: "reserved", label: "Reserved address space" };
  return { scope: "public", label: "Publicly routable IPv4 address" };
}

function analyzePrivateIp(ip: string): AnalysisResult {
  const classification = classifyIpv4(ip);
  const findings: Finding[] = [];

  if (classification.scope !== "public") {
    findings.push(
      toFinding({
        id: "non-public-ip",
        title: "Address is not in the public IPv4 space",
        severity: "info",
        category: "host",
        explanation:
          "This address belongs to a private, loopback, reserved, or special-purpose range. That is a routing fact, not evidence of malicious activity. No lookup was performed.",
        evidence: classification.label,
        impact:
          "Addresses in these ranges are not reachable from the public internet and may refer to an internal network.",
        confidence: "high",
        recommendation:
          "No security action is implied by this finding. If the address was unexpected, confirm it with your network administrator.",
        scoreContribution: 0,
      }),
    );
  }

  return {
    indicatorType: "ipv4",
    input: ip,
    normalized: ip,
    host: ip,
    score: 0,
    severity: "low",
    findings,
    limitations: INDICATOR_LIMITATIONS,
    method: "local-heuristic",
    analyzedAt: new Date().toISOString(),
  };
}

function analyzeDomain(parsed: ParsedIndicator, now: Date): AnalysisResult {
  const host = parsed.host;
  const findings: Finding[] = [];
  const tld = host.split(".").pop() ?? "";
  const subdomains = countSubdomains(host);

  if (HIGH_ABUSE_TLDS.has(tld)) {
    findings.push(
      toFinding({
        id: "high-abuse-tld",
        title: "Domain uses a frequently abused TLD",
        severity: "medium",
        category: "host",
        explanation:
          "This top-level domain is inexpensive or free and appears frequently in phishing. Many legitimate sites use it, so this is a weak indicator only.",
        evidence: `Top-level domain: .${tld}`,
        impact: "Attackers can register and abandon domains cheaply.",
        confidence: "low",
        recommendation:
          "Confirm the domain owner through an independent, trusted channel.",
        scoreContribution: 8,
      }),
    );
  }

  if (host.split(".").some((label) => label.startsWith("xn--"))) {
    findings.push(
      toFinding({
        id: "punycode-domain",
        title: "Domain uses Punycode",
        severity: "medium",
        category: "obfuscation",
        explanation:
          "Punycode represents internationalized characters. It is legitimate for many sites, but can also be used to imitate a trusted name visually.",
        evidence: "Punycode label (xn--) detected",
        impact: "The decoded name may look similar to an established brand.",
        confidence: "medium",
        recommendation:
          "Verify the domain through an official source rather than relying on its visual appearance.",
        scoreContribution: 14,
      }),
    );
  }

  const brand = isBrandImpersonation(host);
  if (brand) {
    findings.push(
      toFinding({
        id: "brand-like-domain",
        title: `Domain references the brand “${brand.brand}”`,
        severity: "medium",
        category: "impersonation",
        explanation:
          "A brand name appears in the hostname on a registrable domain that is not in the brand's known domain list. Fan sites and news sites can trigger this, so it is not conclusive.",
        evidence: `Registrable domain: ${brand.registrableDomain}`,
        impact: "A user might trust the domain because of the brand-like name.",
        confidence: "low",
        recommendation:
          "Visit the organization's official site directly and verify the domain through a trusted source.",
        scoreContribution: 18,
      }),
    );
  }

  const hyphenCount = (host.match(/-/g) ?? []).length;
  if (hyphenCount >= 4) {
    findings.push(
      toFinding({
        id: "hyphen-heavy-domain",
        title: "Domain contains many hyphens",
        severity: "medium",
        category: "structure",
        explanation:
          "Hyphens are common in legitimate domains and also used to combine brand names with words such as 'secure' or 'login'.",
        evidence: `${hyphenCount} hyphen(s) in domain`,
        impact: "The domain may resemble an official service at a glance.",
        confidence: "low",
        recommendation: "Confirm the registrable domain and its owner independently.",
        scoreContribution: 8,
      }),
    );
  }

  if (!brand) {
    const word = CREDENTIAL_THEME_WORDS.find((entry) => host.includes(entry));
    if (word) {
      findings.push(
        toFinding({
          id: "credential-theme-domain",
          title: "Domain contains account or login language",
          severity: "low",
          category: "context",
          explanation:
            "Words such as 'login' or 'verify' appear in many legitimate domains, but are also used to create a false sense of trust.",
          evidence: `Domain contains “${word}”`,
          impact: "Users may assume the domain is an official authentication service.",
          confidence: "low",
          recommendation:
            "Open the service from a saved bookmark or type its official address directly.",
          scoreContribution: 7,
        }),
      );
    }
  }

  if (subdomains > 3) {
    findings.push(
      toFinding({
        id: "excessive-subdomains",
        title: "Unusually deep subdomain chain",
        severity: "medium",
        category: "structure",
        explanation:
          "Many subdomain levels can push the registrable domain out of view and make the host harder to verify.",
        evidence: `${subdomains} subdomain level(s)`,
        impact: "The meaningful domain may be hidden in some interfaces.",
        confidence: "medium",
        recommendation:
          "Read the hostname from right to left and verify the registrable domain.",
        scoreContribution: subdomains > 5 ? 16 : 10,
      }),
    );
  }

  if (host.length > 45) {
    findings.push(
      toFinding({
        id: "long-domain",
        title: "Domain is unusually long",
        severity: "low",
        category: "structure",
        explanation:
          "Long domains are harder to inspect and can hide brand-like fragments.",
        evidence: `Length: ${host.length} characters`,
        impact: "The important part of the domain may be truncated by interfaces.",
        confidence: "low",
        recommendation: "Inspect the full name in a tool that does not truncate it.",
        scoreContribution: 5,
      }),
    );
  }

  const score = scoreFindings(findings);

  return {
    indicatorType: "domain",
    input: parsed.raw,
    normalized: parsed.normalized,
    host,
    score,
    severity: severityFromScore(score),
    findings,
    limitations: INDICATOR_LIMITATIONS,
    method: "local-heuristic",
    analyzedAt: now.toISOString(),
  };
}

/**
 * Analyze an IP address or domain locally. Never resolves or contacts the
 * submitted indicator.
 */
export function analyzeIndicator(
  input: string,
  now: Date = new Date(),
): AnalysisResult {
  const parsed = parseIndicator(input);
  if (parsed.type === "ipv4") {
    return { ...analyzePrivateIp(parsed.normalized), analyzedAt: now.toISOString() };
  }
  return analyzeDomain(parsed, now);
}

export function isPrivateOrReservedIpv4(ip: string): boolean {
  return classifyIpv4(ip).scope !== "public";
}

export function isIpv6Indicator(value: string): boolean {
  return isIpv6Host(value);
}
