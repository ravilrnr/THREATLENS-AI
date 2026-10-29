import {
  ARCHIVE_EXTENSIONS,
  CREDENTIAL_THEME_WORDS,
  EXECUTABLE_EXTENSIONS,
  HIGH_ABUSE_TLDS,
  PROVIDER_UNAVAILABLE_MESSAGE,
} from "@/lib/analysis/constants";
import { scoreFindings, severityFromScore } from "@/lib/scoring";
import {
  countSubdomains,
  getRegistrableDomain,
  isBrandImpersonation,
  isIpv4,
  isKnownShortener,
  parseUrl,
  URL_LIMITATIONS,
} from "@/lib/validation/url";
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

function toFinding(draft: FindingDraft): Finding {
  return { ...draft };
}

function truncate(value: string, max = 160): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function hasExecutableExtension(pathname: string): {
  extension: string | null;
  doubleExtension: boolean;
} {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments.at(-1) ?? "";
  const parts = last.toLowerCase().split(".");
  if (parts.length < 2) return { extension: null, doubleExtension: false };
  const extension = parts.at(-1) ?? "";
  const known =
    EXECUTABLE_EXTENSIONS.has(extension) || ARCHIVE_EXTENSIONS.has(extension);
  const doubleExtension = known && parts.length >= 3;
  return { extension: known ? extension : null, doubleExtension };
}

/**
 * Analyze a URL using deterministic local rules only. This function performs
 * no DNS lookups, HTTP requests, redirects, or reputation queries.
 */
export function analyzeUrl(input: string, now: Date = new Date()): AnalysisResult {
  const parsed = parseUrl(input);
  const { url, host } = parsed;
  const findings: Finding[] = [];
  const lowerHost = host.toLowerCase();

  // --- Transport -----------------------------------------------------------
  if (url.protocol === "http:") {
    findings.push(
      toFinding({
        id: "insecure-transport",
        title: "Connection uses HTTP instead of HTTPS",
        severity: "low",
        category: "transport",
        explanation:
          "HTTP sends requests and any entered information without transport encryption. This alone does not make a site malicious; many old or internal sites still use HTTP.",
        evidence: "Scheme is http://",
        impact:
          "On untrusted networks, an observer could read or modify unencrypted traffic.",
        confidence: "high",
        recommendation:
          "Do not enter credentials or payment details. If this is a login page, open the organization's site directly over HTTPS instead.",
        scoreContribution: 8,
      }),
    );
  }

  // --- Host ----------------------------------------------------------------
  if (parsed.isIpHost) {
    findings.push(
      toFinding({
        id: "ip-literal-host",
        title: "Host is a raw IP address",
        severity: "medium",
        category: "host",
        explanation:
          "Legitimate public services usually use domain names. A raw IP address can bypass domain-based reputation and make the destination harder for a person to verify.",
        evidence: parsed.isIpv6Host ? "IPv6 literal host" : `IP address host: ${host}`,
        impact:
          "Users cannot easily confirm who operates the address, and some security controls are domain-based.",
        confidence: "medium",
        recommendation:
          "Treat the link as untrusted until the address is confirmed through an independent, authorized channel.",
        scoreContribution: 18,
      }),
    );
  }

  if (url.username || url.password) {
    findings.push(
      toFinding({
        id: "userinfo-component",
        title: "Credentials are embedded in the URL",
        severity: "high",
        category: "obfuscation",
        explanation:
          "Text before the @ symbol is a user-information component. Browsers may display a trusted-looking name there while the actual host is different.",
        evidence: `userinfo present before @; actual host is ${host}`,
        impact:
          "A crafted link can make a malicious destination appear to belong to another organization.",
        confidence: "high",
        recommendation:
          "Do not open the link. Verify the true host after the @ symbol, and report the message if it was unsolicited.",
        scoreContribution: 22,
      }),
    );
  }

  const xnLabel = host.split(".").find((label) => label.startsWith("xn--"));
  if (xnLabel) {
    findings.push(
      toFinding({
        id: "punycode-host",
        title: "Hostname uses Punycode (internationalized domain)",
        severity: "medium",
        category: "obfuscation",
        explanation:
          "Punycode encodes non-Latin characters. It is legitimate for many international sites, but attackers also use visually similar characters to imitate a trusted domain.",
        evidence: `Punycode label detected: ${truncate(xnLabel, 60)}`,
        impact:
          "The address may visually resemble a different, trusted brand when displayed in decoded form.",
        confidence: "medium",
        recommendation:
          "Confirm the domain through an independent source before visiting. Do not rely on the visual appearance of the address.",
        scoreContribution: 14,
      }),
    );
  } else if (parsed.hasNonAsciiInput) {
    findings.push(
      toFinding({
        id: "non-ascii-characters",
        title: "URL contains non-ASCII characters",
        severity: "low",
        category: "obfuscation",
        explanation:
          "International characters are common and often legitimate, but mixed-script text can be used for visual deception.",
        evidence: "Non-ASCII characters present in the submitted URL",
        impact:
          "Displayed text may differ from the hostname that is actually contacted.",
        confidence: "low",
        recommendation:
          "Double-check the hostname carefully and verify the site through a trusted source.",
        scoreContribution: 4,
      }),
    );
  }

  const subdomains = countSubdomains(host);
  if (subdomains > 3) {
    findings.push(
      toFinding({
        id: "excessive-subdomains",
        title: "Unusually deep subdomain chain",
        severity: "medium",
        category: "structure",
        explanation:
          "Long chains of subdomains can push the real registrable domain out of view in narrow address bars and messaging previews.",
        evidence: `${subdomains} subdomain level(s); registrable domain is ${getRegistrableDomain(host)}`,
        impact:
          "A user may mistake an attacker-controlled subdomain for the trusted registrable domain.",
        confidence: "medium",
        recommendation:
          "Read the address from right to left and confirm the registrable domain before interacting.",
        scoreContribution: subdomains > 5 ? 16 : 10,
      }),
    );
  }

  if (lowerHost.length > 45) {
    findings.push(
      toFinding({
        id: "long-hostname",
        title: "Hostname is unusually long",
        severity: "low",
        category: "structure",
        explanation:
          "Very long hostnames are harder to inspect and are sometimes used to hide the meaningful part of an address.",
        evidence: `Hostname length: ${lowerHost.length} characters`,
        impact: "The important part of the domain may be truncated in some interfaces.",
        confidence: "low",
        recommendation:
          "Inspect the full hostname in a tool that does not truncate it, and confirm the registrable domain.",
        scoreContribution: 5,
      }),
    );
  }

  if (!parsed.isIpHost) {
    const hyphenCount = (lowerHost.match(/-/g) ?? []).length;
    const labelWithManyHyphens = host
      .split(".")
      .some((label) => (label.match(/-/g) ?? []).length >= 3);
    if (hyphenCount >= 4 || labelWithManyHyphens) {
      findings.push(
        toFinding({
          id: "hyphen-heavy-host",
          title: "Hostname uses many hyphens",
          severity: "medium",
          category: "structure",
          explanation:
            "Hyphen-heavy hostnames are common in legitimate businesses, but they are also used to combine brand names with tempting words such as 'secure-login'.",
          evidence: `${hyphenCount} hyphen(s) in hostname`,
          impact: "The address may look like an official service at a glance.",
          confidence: "low",
          recommendation:
            "Confirm the registrable domain and the organization that owns it before signing in or paying.",
          scoreContribution: 8,
        }),
      );
    }

    const digitCount = (lowerHost.match(/\d/g) ?? []).length;
    if (digitCount >= 8) {
      findings.push(
        toFinding({
          id: "digit-heavy-host",
          title: "Hostname contains many digits",
          severity: "low",
          category: "structure",
          explanation:
            "Digit-heavy hostnames are used by both legitimate infrastructure and automatically generated phishing domains.",
          evidence: `${digitCount} digits in hostname`,
          impact: "Automatically generated domains are harder to recognize or remember.",
          confidence: "low",
          recommendation: "Verify ownership through a trusted channel rather than trusting the pattern.",
          scoreContribution: 5,
        }),
      );
    }

    const ipLikeLabel = host
      .split(".")
      .slice(0, -2)
      .find((label) => isIpv4(label));
    if (ipLikeLabel) {
      findings.push(
        toFinding({
          id: "ip-like-subdomain",
          title: "An IP-like value appears as a subdomain",
          severity: "medium",
          category: "obfuscation",
          explanation:
            "Placing an IP-looking value in a subdomain can make an address look like a direct connection when the real host belongs to a domain.",
          evidence: `Subdomain resembles an IP address: ${truncate(ipLikeLabel, 40)}`,
          impact: "The displayed address may mislead a user about where the request is going.",
          confidence: "medium",
          recommendation:
            "Ignore the subdomain and verify the registrable domain at the end of the hostname.",
          scoreContribution: 8,
        }),
      );
    }
  }

  // --- URL structure -------------------------------------------------------
  const urlLength = parsed.normalized.length;
  if (urlLength > 120) {
    findings.push(
      toFinding({
        id: "long-url",
        title: "URL is unusually long",
        severity: "low",
        category: "structure",
        explanation:
          "Long URLs are common in search results and tracking links. Length is only a weak signal, but attackers also hide destinations among many parameters.",
        evidence: `URL length: ${urlLength} characters`,
        impact: "Key parts of the address may be hidden or truncated in messages.",
        confidence: "low",
        recommendation:
          "If the link arrived unexpectedly, inspect it in a safe environment rather than opening it.",
        scoreContribution: urlLength > 200 ? 12 : 6,
      }),
    );
  }

  const encodedCount = (parsed.normalized.match(/%[0-9a-f]{2}/gi) ?? []).length;
  const encodedProtocol =
    /%68%74%74%70|%3a%2f%2f|%2f%2f/i.test(parsed.normalized) &&
    encodedCount >= 4;

  if (encodedCount >= 3) {
    findings.push(
      toFinding({
        id: "heavy-percent-encoding",
        title: "URL contains heavy percent-encoding",
        severity: "medium",
        category: "obfuscation",
        explanation:
          "Percent-encoding is standard, but dense encoding can hide characters, schemes, or paths from a casual reader.",
        evidence: `${encodedCount} percent-encoded sequences`,
        impact: "Filtering and human review may miss the decoded destination.",
        confidence: "medium",
        recommendation:
          "Decode the URL with an authorized analysis tool before deciding whether to interact with it.",
        scoreContribution: encodedProtocol ? 0 : 8,
      }),
    );
  }

  if (encodedProtocol) {
    findings.push(
      toFinding({
        id: "encoded-protocol",
        title: "URL contains an encoded scheme or path separator",
        severity: "high",
        category: "obfuscation",
        explanation:
          "Encoding an HTTP scheme or path separator can conceal the real destination or a nested URL from simple inspection.",
        evidence: "Encoded scheme or // sequence detected",
        impact: "A reviewer may misread where the link actually leads.",
        confidence: "medium",
        recommendation:
          "Do not open the link. Decode it with an authorized tool and report it if it arrived unsolicited.",
        scoreContribution: 14,
      }),
    );
  }

  if (/%00|%0d|%0a/i.test(parsed.normalized)) {
    findings.push(
      toFinding({
        id: "control-byte-encoding",
        title: "Encoded control characters detected",
        severity: "high",
        category: "obfuscation",
        explanation:
          "Null, carriage-return, or line-feed bytes in a URL have no legitimate use in ordinary links and may target parsers that handle them inconsistently.",
        evidence: "Encoded control byte (for example %00, %0d, or %0a)",
        impact: "Different systems may interpret the address differently.",
        confidence: "high",
        recommendation:
          "Do not open the link. Preserve it as evidence and report it to the relevant platform.",
        scoreContribution: 14,
      }),
    );
  }

  const port = url.port;
  if (port && port !== "80" && port !== "443") {
    findings.push(
      toFinding({
        id: "non-standard-port",
        title: "Non-standard TCP port specified",
        severity: "low",
        category: "transport",
        explanation:
          "A non-standard port is not malicious by itself. It is included because phishing pages on unusual ports can bypass some simple URL filters.",
        evidence: `Port ${port}`,
        impact: "Some monitoring controls assume standard web ports.",
        confidence: "low",
        recommendation: "Confirm that the port is expected for the service before connecting.",
        scoreContribution: 5,
      }),
    );
  }

  const tld = lowerHost.split(".").pop() ?? "";
  if (HIGH_ABUSE_TLDS.has(tld)) {
    findings.push(
      toFinding({
        id: "high-abuse-tld",
        title: "Domain uses a frequently abused TLD",
        severity: "medium",
        category: "host",
        explanation:
          "Some top-level domains are inexpensive or free and are frequently used in phishing campaigns. Many legitimate sites use them too, so this is a weak indicator.",
        evidence: `Top-level domain: .${tld}`,
        impact: "Low-cost domains can be registered and discarded quickly by attackers.",
        confidence: "low",
        recommendation:
          "Check the registrable domain and verify the organization independently before sharing information.",
        scoreContribution: 8,
      }),
    );
  }

  if (isKnownShortener(host)) {
    findings.push(
      toFinding({
        id: "url-shortener",
        title: "Link uses a URL shortener",
        severity: "low",
        category: "host",
        explanation:
          "Shorteners hide the final destination. The shortener itself is usually a legitimate service, so this is not evidence of malice.",
        evidence: `Known shortener domain: ${getRegistrableDomain(host)}`,
        impact: "The user cannot see where the link leads before clicking.",
        confidence: "high",
        recommendation:
          "Expand the link with an authorized tool, or contact the sender through a separate channel before opening it.",
        scoreContribution: 6,
      }),
    );
  }

  const brandMatch = isBrandImpersonation(host);
  if (brandMatch && !parsed.isIpHost) {
    findings.push(
      toFinding({
        id: "brand-like-hostname",
        title: `Hostname references the brand “${brandMatch.brand}” on an unrelated domain`,
        severity: "medium",
        category: "impersonation",
        explanation:
          "A brand name appears in the hostname, but the registrable domain is not one of the brand's known domains. This can be legitimate (for example a news article or fan site), so it is not proof of impersonation.",
        evidence: `Registrable domain: ${brandMatch.registrableDomain}`,
        impact:
          "Users may assume the page belongs to the brand and enter credentials or payment details.",
        confidence: "low",
        recommendation:
          "Navigate to the brand's official website directly instead of using this link. Confirm the domain with the organization.",
        scoreContribution: 18,
      }),
    );
  }

  const credentialWord = brandMatch ? null : CREDENTIAL_THEME_WORDS.find((word) => lowerHost.includes(word));
  if (credentialWord) {
    findings.push(
      toFinding({
        id: "credential-theme-host",
        title: "Hostname contains account or login language",
        severity: "low",
        category: "context",
        explanation:
          "Words such as 'login', 'verify', or 'secure' are normal in real services, but they are also used to make a deceptive hostname feel trustworthy.",
        evidence: `Hostname contains “${credentialWord}”`,
        impact: "A user may over-trust the page and enter sensitive information.",
        confidence: "low",
        recommendation:
          "Open the service from a saved bookmark or by typing its official address instead of following this link.",
        scoreContribution: 7,
      }),
    );
  }

  const extensionInfo = hasExecutableExtension(url.pathname);
  const pathSegments = url.pathname.toLowerCase().split("/").filter(Boolean);
  const lastSegment = pathSegments.at(-1) ?? "";
  if (extensionInfo.doubleExtension) {
    findings.push(
      toFinding({
        id: "double-extension",
        title: "Download path uses a double file extension",
        severity: "high",
        category: "context",
        explanation:
          "A double extension such as invoice.pdf.exe is a common way to disguise an executable as a document. The extension alone does not prove the file is malicious.",
        evidence: `Filename pattern: ${truncate(lastSegment, 80)}`,
        impact: "A user could mistake an executable for a harmless document.",
        confidence: "medium",
        recommendation:
          "Do not download or open the file. If it is needed, isolate it and scan it with an authorized security tool.",
        scoreContribution: 16,
      }),
    );
  } else if (extensionInfo.extension) {
    const isArchive = ARCHIVE_EXTENSIONS.has(extensionInfo.extension);
    findings.push(
      toFinding({
        id: isArchive ? "archive-download" : "executable-download",
        title: isArchive
          ? "Link points to a downloadable archive"
          : "Link points to a potentially executable file",
        severity: isArchive ? "low" : "medium",
        category: "context",
        explanation: isArchive
          ? "Archives are commonly used for legitimate downloads, but they can also contain unwanted executables."
          : "The path ends in a file type that can run code or install software. Many legitimate sites distribute such files, so this is contextual rather than a verdict.",
        evidence: `File extension: .${extensionInfo.extension}`,
        impact: isArchive
          ? "The archive contents are unknown until inspected in an isolated environment."
          : "Running an untrusted executable can compromise the device.",
        confidence: "low",
        recommendation:
          "Do not run the file. Isolate it, preserve evidence, and scan it with an authorized tool.",
        scoreContribution: isArchive ? 8 : 14,
      }),
    );
  }

  const suspiciousParams = new Set([
    "url",
    "redirect",
    "redirect_uri",
    "next",
    "continue",
    "dest",
    "destination",
    "target",
    "return",
    "returnurl",
  ]);
  for (const [key, value] of url.searchParams) {
    if (!suspiciousParams.has(key.toLowerCase())) continue;
    const trimmed = value.trim();
    if (/^(https?:)?\/\//i.test(trimmed) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed)) {
      let target = trimmed;
      try {
        target = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`).host;
      } catch {
        /* keep the original truncated value */
      }
      findings.push(
        toFinding({
          id: "redirect-parameter",
          title: "URL contains an external redirect parameter",
          severity: "medium",
          category: "structure",
          explanation:
            "A query parameter appears to control where the user is sent next. If the site does not validate it, the link can forward users to an unrelated destination.",
          evidence: `Parameter “${key}” points to ${truncate(target, 60)}`,
          impact: "A trusted domain could be used as a stepping stone to an untrusted page.",
          confidence: "medium",
          recommendation:
            "Avoid following the link. Confirm the final destination through an independent source.",
          scoreContribution: 8,
        }),
      );
      break;
    }
  }

  for (const [key, value] of url.searchParams) {
    if (/^\s*(javascript|data|vbscript):/i.test(value)) {
      findings.push(
        toFinding({
          id: "dangerous-embedded-scheme",
          title: "Query parameter contains a dangerous embedded scheme",
          severity: "high",
          category: "obfuscation",
          explanation:
            "A parameter carries a javascript:, data:, or vbscript: value. These schemes can execute content in some contexts and are not ordinary web destinations.",
          evidence: `Parameter “${truncate(key, 40)}” contains an embedded script or data scheme`,
          impact: "If a vulnerable page reflects the value, script could run in the user's browser.",
          confidence: "medium",
          recommendation:
            "Do not open the link. Report it to the site owner and the platform where it was received.",
          scoreContribution: 14,
        }),
      );
      break;
    }
  }

  if ([...url.searchParams.keys()].length > 15) {
    findings.push(
      toFinding({
        id: "many-query-parameters",
        title: "URL contains an unusually high number of parameters",
        severity: "low",
        category: "structure",
        explanation:
          "Long parameter lists occur in legitimate analytics and tracking links. They can also hide a malicious destination or unusual payload.",
        evidence: `${[...url.searchParams.keys()].length} query parameters`,
        impact: "The meaningful part of the link is difficult to inspect manually.",
        confidence: "low",
        recommendation: "Prefer navigating to the site directly instead of following the parameter-heavy link.",
        scoreContribution: 4,
      }),
    );
  }

  const score = scoreFindings(findings);

  return {
    indicatorType: "url",
    input,
    normalized: parsed.normalized,
    host,
    score,
    severity: severityFromScore(score),
    findings,
    limitations: URL_LIMITATIONS,
    method: "local-heuristic",
    analyzedAt: now.toISOString(),
  };
}

export function providerUnavailableMessage(): string {
  return PROVIDER_UNAVAILABLE_MESSAGE;
}
