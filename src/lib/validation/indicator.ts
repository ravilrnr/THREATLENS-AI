import {
  getRegistrableDomain,
  MAX_HOST_LENGTH,
} from "@/lib/validation/url";

export type IndicatorKind = "ipv4" | "domain";

export interface ParsedIndicator {
  type: IndicatorKind;
  raw: string;
  normalized: string;
  host: string;
  registrableDomain: string;
}

export class IndicatorValidationError extends Error {
  readonly code = "INVALID_INDICATOR";
  constructor(message: string) {
    super(message);
    this.name = "IndicatorValidationError";
  }
}

const IPV4_CANDIDATE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export function isValidIpv4(value: string): boolean {
  if (!IPV4_CANDIDATE.test(value)) return false;
  return value.split(".").every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    if (part.length > 1 && part.startsWith("0")) return false;
    return Number(part) >= 0 && Number(part) <= 255;
  });
}

function validateAsciiDomain(domain: string): boolean {
  if (domain.length < 4 || domain.length > MAX_HOST_LENGTH) return false;
  if (!/^[a-z0-9.-]+$/.test(domain)) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (labels.some((label) => label.length === 0 || label.length > 63)) return false;
  if (labels.some((label) => label.startsWith("-") || label.endsWith("-"))) {
    return false;
  }
  const tld = labels.at(-1) ?? "";
  if (tld.length < 2) return false;
  if (/^\d+$/.test(tld)) return false;
  // Allow punycode TLDs (xn--...) and alphabetic TLDs.
  return /^[a-z]{2,63}$/.test(tld) || /^xn--[a-z0-9-]+$/.test(tld);
}

/**
 * Validate an IP address or domain name without any lookup. URLs, IPv6, and
 * hostnames with paths or ports are rejected with a clear message.
 */
export function parseIndicator(input: string): ParsedIndicator {
  if (typeof input !== "string") {
    throw new IndicatorValidationError("The indicator must be provided as text.");
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new IndicatorValidationError("Enter an IP address or domain name.");
  }
  if (trimmed.length > MAX_HOST_LENGTH + 8) {
    throw new IndicatorValidationError("The indicator is too long.");
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed) || /\s/.test(trimmed)) {
    throw new IndicatorValidationError(
      "The indicator must not contain spaces or control characters.",
    );
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    throw new IndicatorValidationError(
      "That is a URL. Use the URL Analyzer instead of the IP & Domain Analyzer.",
    );
  }
  if (trimmed.includes("...") || trimmed.startsWith(".") || trimmed.endsWith("..")) {
    throw new IndicatorValidationError("The domain name is malformed.");
  }

  const withoutTrailingDot = trimmed.replace(/\.$/, "");
  if (withoutTrailingDot.includes(":")) {
    throw new IndicatorValidationError(
      "IPv6 addresses and ports are not supported by this analyzer. Provide an IPv4 address or a domain name without a port.",
    );
  }
  if (/[/?#@\\]/.test(withoutTrailingDot)) {
    throw new IndicatorValidationError(
      "Provide only a hostname or IP address, without a path, port, or credentials.",
    );
  }

  if (IPV4_CANDIDATE.test(withoutTrailingDot)) {
    if (!isValidIpv4(withoutTrailingDot)) {
      throw new IndicatorValidationError(
        "That IPv4 address is invalid. Each octet must be between 0 and 255.",
      );
    }
    return {
      type: "ipv4",
      raw: input,
      normalized: withoutTrailingDot,
      host: withoutTrailingDot,
      registrableDomain: withoutTrailingDot,
    };
  }

  const lower = withoutTrailingDot.toLowerCase();
  let asciiDomain: string;
  if (/[^\x00-\x7f]/.test(lower)) {
    try {
      asciiDomain = new URL(`http://${lower}`).hostname;
    } catch {
      throw new IndicatorValidationError("The internationalized domain is malformed.");
    }
  } else {
    asciiDomain = lower;
  }

  if (!validateAsciiDomain(asciiDomain)) {
    throw new IndicatorValidationError(
      "That does not look like a valid domain. Use a public domain such as example.com (no scheme or path).",
    );
  }
  if (asciiDomain === "localhost" || asciiDomain.endsWith(".localhost")) {
    throw new IndicatorValidationError("localhost is not a public domain.");
  }

  return {
    type: "domain",
    raw: input,
    normalized: asciiDomain,
    host: asciiDomain,
    registrableDomain: getRegistrableDomain(asciiDomain),
  };
}

export function detectIndicatorType(input: string): IndicatorKind | null {
  try {
    return parseIndicator(input).type;
  } catch {
    return null;
  }
}

export { IPV4_CANDIDATE };
