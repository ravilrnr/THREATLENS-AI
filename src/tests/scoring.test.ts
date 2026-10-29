import { describe, expect, it } from "vitest";
import {
  clampScore,
  MAX_SCORE,
  scoreFindings,
  SEVERITY_BANDS,
  severityFromScore,
  severityLabel,
  verificationScoreSummary,
} from "@/lib/scoring";
import type { Finding } from "@/types";

function finding(scoreContribution: number): Finding {
  return {
    id: `finding-${scoreContribution}`,
    title: "Test finding",
    severity: "low",
    category: "structure",
    explanation: "Test explanation.",
    evidence: "Test evidence.",
    impact: "Test impact.",
    confidence: "low",
    recommendation: "Test recommendation.",
    scoreContribution,
  };
}

describe("score clamping and severity bands", () => {
  it("clamps scores into the documented 0-100 range", () => {
    expect(clampScore(-50)).toBe(0);
    expect(clampScore(0)).toBe(0);
    expect(clampScore(24.4)).toBe(24);
    expect(clampScore(24.6)).toBe(25);
    expect(clampScore(100)).toBe(100);
    expect(clampScore(175)).toBe(MAX_SCORE);
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("maps exact band boundaries as documented", () => {
    expect(severityFromScore(0)).toBe("low");
    expect(severityFromScore(24)).toBe("low");
    expect(severityFromScore(25)).toBe("medium");
    expect(severityFromScore(49)).toBe("medium");
    expect(severityFromScore(50)).toBe("high");
    expect(severityFromScore(74)).toBe("high");
    expect(severityFromScore(75)).toBe("critical");
    expect(severityFromScore(100)).toBe("critical");
  });

  it("covers the full 0-100 range without gaps", () => {
    for (let score = 0; score <= 100; score += 1) {
      const band = SEVERITY_BANDS.find(
        (entry) => score >= entry.min && score <= entry.max,
      );
      expect(band, `score ${score} must fall in a band`).toBeDefined();
      expect(severityFromScore(score)).toBe(band?.band);
    }
  });

  it("sums explicit contributions then clamps", () => {
    expect(scoreFindings([])).toBe(0);
    expect(scoreFindings([finding(10), finding(15)])).toBe(25);
    expect(scoreFindings([finding(80), finding(80)])).toBe(100);
    expect(scoreFindings([finding(0), finding(0)])).toBe(0);
  });

  it("formats labels and verification summaries", () => {
    expect(severityLabel("critical")).toBe("Critical");
    expect(verificationScoreSummary(0)).toBe("0/100 (Low)");
    expect(verificationScoreSummary(50)).toBe("50/100 (High)");
    expect(verificationScoreSummary(1000)).toBe("100/100 (Critical)");
  });
});
