import { afterEach, beforeEach, vi } from "vitest";
import { resetRateLimits } from "@/lib/security/rateLimit";
import { resetServerStore } from "@/lib/persistence/serverStore";

const MANAGED_ENV = [
  "THREAT_INTEL_PROVIDER",
  "THREAT_INTEL_API_URL",
  "THREAT_INTEL_API_KEY",
  "THREAT_INTEL_ALLOWED_HOSTS",
  "THREAT_INTEL_NAME",
  "BLOCK_INTEGRATION_NAME",
  "BLOCK_INTEGRATION_URL",
  "BLOCK_INTEGRATION_TOKEN",
  "BLOCK_INTEGRATION_ALLOWED_HOSTS",
  "THREATLENS_MAX_BODY_BYTES",
  "THREATLENS_RATE_LIMIT_ANALYZE",
  "THREATLENS_RATE_LIMIT_REMEDIATION",
  "THREATLENS_RATE_LIMIT_VERIFY",
  "THREATLENS_ALLOWED_ORIGIN",
];

const originalEnv = { ...process.env };

beforeEach(() => {
  resetRateLimits();
  resetServerStore();
  for (const key of MANAGED_ENV) {
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of MANAGED_ENV) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
  vi.unstubAllGlobals();
  resetRateLimits();
  resetServerStore();
});
