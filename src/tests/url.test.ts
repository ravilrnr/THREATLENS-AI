import { describe, expect, it, vi } from "vitest";
import { analyzeUrl } from "@/lib/analysis/url";
import {
  countSubdomains,
  getRegistrableDomain,
  isBrandImpersonation,
  isIpv4,
  parseUrl,
  UrlValidationError,
} from "@/lib/validation/url";
import { MAX_URL_LENGTH } from "@/lib/validation/url";

function expectInvalidUrl(input: string, fragment?: string): void {
  try {
    parseUrl(input);
  } catch (error) {
    expect(error).toBeInstanceOf(UrlValidationError);
    const validationError = error as UrlValidationError;
    expect(validationError.code).toBe("INVALID_URL");
    if (fragment) {
      expect(validationError.message.toLowerCase()).toContain(fragment.toLowerCase());
    }
    return;
  }
  throw new Error(`Expected parseUrl to reject: ${JSON.stringify(input)}`);
}

describe("URL validation", () => {
  it("normalizes a valid HTTPS URL", () => {
    const parsed = parseUrl("  https://Example.COM/Path?b=2&a=1  ");
    expect(parsed.host).toBe("example.com");
    expect(parsed.registrableDomain).toBe("example.com");
    expect(parsed.normalized).toBe("https://example.com/Path?b=2&a=1");
    expect(parsed.isIpHost).toBe(false);
  });

  it("rejects empty input and missing schemes", () => {
    expectInvalidUrl("", "enter a url");
    expectInvalidUrl("example.com/login", "include the scheme");
  });

  it("rejects dangerous schemes", () => {
    expectInvalidUrl("javascript:alert(1)", "only http");
    expectInvalidUrl("file:///etc/passwd", "only http");
    expectInvalidUrl("data:text/html,<script>alert(1)</script>", "only http");
  });

  it("rejects whitespace and control characters", () => {
    expectInvalidUrl("https://exa mple.com/", "spaces");
    expectInvalidUrl("https://example.com/\u0000", "control characters");
  });

  it("rejects malformed hostnames", () => {
    expectInvalidUrl("https://-bad.example.com/", "hyphen");
    expectInvalidUrl("https://bad-.example.com/", "hyphen");
    expectInvalidUrl("https://localhost/", "public domain");
    expectInvalidUrl("https://exa_mple.com/", "unsupported characters");
  });

  it("rejects URLs longer than the documented maximum", () => {
    const oversized = `https://example.com/${"a".repeat(MAX_URL_LENGTH)}`;
    expectInvalidUrl(oversized, "characters or fewer");
  });

  it("accepts IPv4 literal hosts and identifies them", () => {
    const parsed = parseUrl("http://192.0.2.10:8080/admin");
    expect(parsed.isIpHost).toBe(true);
    expect(parsed.host).toBe("192.0.2.10");
    expect(isIpv4("192.0.2.10")).toBe(true);
    expect(isIpv4("999.0.2.10")).toBe(false);
  });

  it("does not treat private/reserved IP literals as public", () => {
    expect(parseUrl("http://10.0.0.5/").isIpHost).toBe(true);
    expect(parseUrl("http://127.0.0.1/").isIpHost).toBe(true);
  });

  it("computes registrable domains and subdomain depth", () => {
    expect(getRegistrableDomain("login.secure.example.co.uk")).toBe("example.co.uk");
    expect(getRegistrableDomain("example.com")).toBe("example.com");
    expect(countSubdomains("a.b.c.example.com")).toBe(3);
    expect(countSubdomains("example.com")).toBe(0);
  });

  it("detects brand-like hostnames without flagging official domains", () => {
    expect(isBrandImpersonation("www.paypal.com")).toBeNull();
    expect(isBrandImpersonation("paypal.com")).toBeNull();
    const match = isBrandImpersonation("paypal-secure-login.xyz");
    expect(match?.brand).toBe("paypal");
    expect(match?.registrableDomain).toBe("paypal-secure-login.xyz");
  });
});

describe("local URL analysis", () => {
  const fixed = new Date("2026-01-02T03:04:05.000Z");

  it("gives a clearly benign URL a low score with no findings", () => {
    const result = analyzeUrl("https://www.example.com/", fixed);
    expect(result.score).toBe(0);
    expect(result.severity).toBe("low");
    expect(result.findings).toHaveLength(0);
    expect(result.method).toBe("local-heuristic");
    expect(result.analyzedAt).toBe(fixed.toISOString());
    expect(result.limitations.join(" ")).toContain("never visits");
  });

  it("uses finding contributions as the exact score", () => {
    const result = analyzeUrl(
      "http://paypal-secure-login.xyz/verify/account/update",
      fixed,
    );
    const sum = result.findings.reduce(
      (total, finding) => total + finding.scoreContribution,
      0,
    );
    expect(result.score).toBe(Math.min(100, sum));
    expect(result.score).toBeGreaterThan(0);
    expect(result.findings.map((finding) => finding.id)).toContain("brand-like-hostname");
    expect(result.findings.map((finding) => finding.id)).toContain("high-abuse-tld");
  });

  it("produces a higher score for a suspicious URL than a benign one", () => {
    const benign = analyzeUrl("https://www.example.com/", fixed);
    const suspicious = analyzeUrl(
      "http://user@192.0.2.10:8080/downloads/invoice.pdf.exe",
      fixed,
    );
    expect(suspicious.score).toBeGreaterThan(benign.score);
    expect(["high", "critical"]).toContain(suspicious.severity);
    expect(suspicious.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "ip-literal-host",
        "userinfo-component",
        "double-extension",
        "non-standard-port",
      ]),
    );
  });

  it("keeps the score deterministic across repeated runs", () => {
    const input = "https://accounts-verify.example.top/login?next=%2Fhome";
    const first = analyzeUrl(input, fixed);
    const second = analyzeUrl(input, fixed);
    expect(second.score).toBe(first.score);
    expect(second.findings).toEqual(first.findings);
  });

  it("never performs a network request while analyzing", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    analyzeUrl("https://example.com/login", fixed);
    analyzeUrl("https://paypal-secure-login.xyz/", fixed);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps provider reputation separate from the local score", () => {
    const result = analyzeUrl("https://www.example.com/", fixed);
    expect("provider" in result).toBe(false);
    expect(Object.keys(result)).not.toContain("providerSummary");
  });
});
