import type { Finding, RiskBand } from "@/types";

export const SEVERITY_BANDS = [
  { band: "low", min: 0, max: 24, label: "Low" },
  { band: "medium", min: 25, max: 49, label: "Medium" },
  { band: "high", min: 50, max: 74, label: "High" },
  { band: "critical", min: 75, max: 100, label: "Critical" },
] as const satisfies ReadonlyArray<{
  band: RiskBand;
  min: number;
  max: number;
  label: string;
}>;

export const MAX_SCORE = 100;

/** Clamp any numeric score into the documented 0-100 range. */
export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(MAX_SCORE, Math.max(0, Math.round(score)));
}

/** Severity is derived only from the bounded score. */
export function severityFromScore(score: number): RiskBand {
  const safe = clampScore(score);
  const match = SEVERITY_BANDS.find(
    (entry) => safe >= entry.min && safe <= entry.max,
  );
  return match?.band ?? "low";
}

/**
 * Deterministic score: the sum of explicit finding contributions, clamped to
 * 0-100. There is no randomness, reputation blending, or hidden factor.
 */
export function scoreFindings(findings: ReadonlyArray<Finding>): number {
  return clampScore(
    findings.reduce((total, finding) => total + finding.scoreContribution, 0),
  );
}

export function severityLabel(band: RiskBand): string {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

export function verificationScoreSummary(score: number): string {
  const band = severityFromScore(score);
  return `${clampScore(score)}/100 (${severityLabel(band)})`;
}
