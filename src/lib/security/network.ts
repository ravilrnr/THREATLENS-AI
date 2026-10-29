import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export type HostResolver = (host: string) => Promise<string[]>;

export class OutboundTargetError extends Error {
  readonly code = "UNSAFE_OUTBOUND_TARGET";
  constructor(message: string) {
    super(message);
    this.name = "OutboundTargetError";
  }
}

const defaultResolver: HostResolver = async (host) => {
  const results = await lookup(host, { all: true, verbatim: true });
  return results.map((entry) => entry.address);
};

/** Conservative private / loopback / reserved IPv4 detection. */
export function isPrivateIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const parts = address.split(".").map(Number);
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

/** Conservative private / loopback / reserved IPv6 detection. */
export function isPrivateIpv6(address: string): boolean {
  if (isIP(address) !== 6) return false;
  const value = address.toLowerCase();

  if (value === "::" || value === "::1") return true;

  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);

  if (/^f[cd][0-9a-f]{0,2}:/.test(value)) return true; // unique local fc00::/7
  if (/^fe[89ab][0-9a-f]?:/.test(value)) return true; // link-local fe80::/10
  if (/^ff[0-9a-f]{0,2}:/.test(value)) return true; // multicast
  if (value.startsWith("2001:db8:")) return true; // documentation
  if (value.startsWith("64:ff9b::")) return true; // NAT64 prefix
  if (value.startsWith("2001:0:")) return true; // Teredo
  return false;
}

export function isPrivateAddress(address: string): boolean {
  return isPrivateIpv4(address) || isPrivateIpv6(address);
}

export interface SafeUrlOptions {
  allowedHosts: string[];
  resolveHost?: HostResolver;
  label?: string;
}

/**
 * Validate an operator-configured outbound endpoint before contacting it.
 * This protects against misconfiguration that would send requests to internal
 * services or cloud metadata endpoints. HTTPS and an explicit host allowlist
 * are both required.
 */
export async function assertSafeOutboundUrl(
  rawUrl: string,
  options: SafeUrlOptions,
): Promise<URL> {
  const label = options.label ?? "Outbound endpoint";
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new OutboundTargetError(`${label} is not a valid URL.`);
  }

  if (url.protocol !== "https:") {
    throw new OutboundTargetError(`${label} must use HTTPS.`);
  }
  if (url.username || url.password) {
    throw new OutboundTargetError(`${label} must not contain embedded credentials.`);
  }
  if (url.port && url.port !== "443") {
    throw new OutboundTargetError(`${label} must use port 443.`);
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || isIP(hostname)) {
    throw new OutboundTargetError(`${label} must use a DNS hostname, not an IP address.`);
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new OutboundTargetError(`${label} must not target a local or internal hostname.`);
  }

  const allowed = options.allowedHosts.map((host) =>
    host.trim().toLowerCase().replace(/\.$/, ""),
  );
  if (allowed.length === 0 || !allowed.includes(hostname)) {
    throw new OutboundTargetError(
      `${label} host is not in the configured allowlist.`,
    );
  }

  const resolveHost = options.resolveHost ?? defaultResolver;
  let addresses: string[];
  try {
    addresses = await resolveHost(hostname);
  } catch {
    throw new OutboundTargetError(`${label} hostname could not be resolved.`);
  }
  if (addresses.length === 0) {
    throw new OutboundTargetError(`${label} hostname resolved to no addresses.`);
  }
  if (addresses.some((address) => isPrivateAddress(address))) {
    throw new OutboundTargetError(
      `${label} resolves to a private or reserved address and was blocked.`,
    );
  }

  return url;
}
