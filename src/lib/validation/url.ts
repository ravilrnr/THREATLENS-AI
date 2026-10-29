import {
  BRANDS,
  CREDENTIAL_THEME_WORDS,
  DISCLAIMER,
  HIGH_ABUSE_TLDS,
  MULTI_PART_SUFFIXES,
  SHORTENER_DOMAINS,
} from "@/lib/analysis/constants";

export const MAX_URL_LENGTH = 2048;
export const MAX_HOST_LENGTH = 253;

export const URL_LIMITATIONS = [
  "Only lexical and structural properties of the URL are examined. Page content, certificates, hosting history, and live reputation are not checked.",
  "No network request is made to the submitted URL. ThreatLens never visits, fetches, or follows redirects from submitted indicators.",
  "A low score is not a guarantee of safety. A high score is not proof of malicious intent.",
  DISCLAIMER,
];

export interface ParsedUrl {
  raw: string;
  normalized: string;
  url: URL;
  host: string;
  registrableDomain: string;
  isIpHost: boolean;
  isIpv6Host: boolean;
  hasNonAsciiInput: boolean;
}

export class UrlValidationError extends Error {
  readonly code = "INVALID_URL";
  constructor(message: string) {
    super(message);
    this.name = "UrlValidationError";
  }
}

const IPV4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export function isIpv4(host: string): boolean {
  return IPV4_PATTERN.test(host);
}

export function isIpv6Host(host: string): boolean {
  return host.startsWith("[") && host.endsWith("]");
}

/** Total label count in the public suffix, e.g. "example.co.uk" -> 3. */
export function suffixLabelCount(host: string): number {
  const labels = host.split(".");
  if (labels.length < 3) return 1;
  const lastTwo = labels.slice(-2).join(".");
  return MULTI_PART_SUFFIXES.has(lastTwo) ? 2 : 1;
}

export function getRegistrableDomain(host: string): string {
  if (isIpv4(host) || isIpv6Host(host)) return host;
  const labels = host.split(".").filter(Boolean);
  const suffixCount = suffixLabelCount(host);
  return labels.slice(-(suffixCount + 1)).join(".");
}

export function countSubdomains(host: string): number {
  if (isIpv4(host) || isIpv6Host(host)) return 0;
  const labels = host.split(".").filter(Boolean);
  return Math.max(0, labels.length - (suffixLabelCount(host) + 1));
}

export function isBrandImpersonation(host: string): {
  brand: string;
  official: string[];
  registrableDomain: string;
} | null {
  const registrableDomain = getRegistrableDomain(host);
  const labels = host.split(".");
  for (const { brand, officialDomains } of BRANDS) {
    const official = officialDomains.some(
      (domain) =>
        registrableDomain === domain || host === domain || host.endsWith(`.${domain}`),
    );
    if (official) continue;
    const hasBrandToken = labels.some((label) => {
      const tokens = label.split(/[^a-z0-9]+/i).filter(Boolean);
      return tokens.some((token) => token.toLowerCase() === brand);
    });
    if (hasBrandToken) {
      return { brand, official: officialDomains, registrableDomain };
    }
  }
  return null;
}

export function hasCredentialThemeWord(host: string): string | null {
  const lower = host.toLowerCase();
  return CREDENTIAL_THEME_WORDS.find((word) => lower.includes(word)) ?? null;
}

export function isKnownShortener(host: string): boolean {
  return SHORTENER_DOMAINS.has(getRegistrableDomain(host));
}

export function isHighAbuseTld(host: string): boolean {
  const tld = host.split(".").pop()?.toLowerCase() ?? "";
  return HIGH_ABUSE_TLDS.has(tld);
}

/**
 * Validate and normalize a URL without performing any network activity.
 * Only HTTP(S) is accepted. Rejects control characters, whitespace, missing
 * schemes, and oversized input.
 */
export function parseUrl(input: string): ParsedUrl {
  if (typeof input !== "string") {
    throw new UrlValidationError("The URL must be provided as text.");
  }

  const raw = input;
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new UrlValidationError("Enter a URL to analyze.");
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new UrlValidationError(
      `URLs must be ${MAX_URL_LENGTH} characters or fewer.`,
    );
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new UrlValidationError(
      "The URL contains control characters, which are not allowed.",
    );
  }
  if (/\s/.test(trimmed)) {
    throw new UrlValidationError("The URL must not contain spaces.");
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    throw new UrlValidationError(
      "Include the scheme, for example https://example.com. Bare domains are not accepted here.",
    );
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new UrlValidationError(
      "That does not look like a valid URL. Check for missing characters or an invalid host.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlValidationError(
      "Only http:// and https:// URLs are supported. Schemes such as file:, javascript:, and data: are rejected.",
    );
  }

  const host = url.hostname.toLowerCase();
  if (!host) {
    throw new UrlValidationError("The URL must include a hostname.");
  }
  if (host.length > MAX_HOST_LENGTH) {
    throw new UrlValidationError("The hostname is too long.");
  }

  if (!isIpv4(host) && !isIpv6Host(host)) {
    const labels = host.split(".");
    if (labels.some((label) => label.length === 0 || label.length > 63)) {
      throw new UrlValidationError("The hostname contains an invalid label.");
    }
    if (labels.length < 2) {
      throw new UrlValidationError(
        "The hostname must contain a public domain such as example.com.",
      );
    }
    if (labels.some((label) => label.startsWith("-") || label.endsWith("-"))) {
      throw new UrlValidationError(
        "The hostname contains an invalid hyphen placement.",
      );
    }
    if (!/^[a-z0-9.-]+$/.test(host)) {
      throw new UrlValidationError("The hostname contains unsupported characters.");
    }
  }

  const normalized = url.toString();
  if (normalized.length > MAX_URL_LENGTH * 2) {
    throw new UrlValidationError("The normalized URL is too long to analyze.");
  }

  return {
    raw,
    normalized,
    url,
    host,
    registrableDomain: getRegistrableDomain(host),
    isIpHost: isIpv4(host) || isIpv6Host(host),
    isIpv6Host: isIpv6Host(host),
    hasNonAsciiInput: /[^\x00-\x7f]/.test(raw),
  };
}

export function hostFromUrl(input: string): string | null {
  try {
    return parseUrl(input).host;
  } catch {
    return null;
  }
}
