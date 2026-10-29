import type { Metadata } from "next";
import { Globe2 } from "lucide-react";
import { AnalyzerWorkbench } from "@/components/analysis/AnalyzerWorkbench";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "IP & Domain Analyzer",
  description:
    "Analyze an IPv4 address or domain with local syntax and pattern checks. No DNS, WHOIS, geolocation, or reputation lookup is fabricated.",
};

export default function IndicatorAnalyzerPage() {
  return (
    <>
      <PageHeader
        eyebrow="Detect → Explain"
        title="IP & Domain Analyzer"
        description="Validate and examine an IPv4 address or domain name using local syntax and pattern checks. No DNS, WHOIS, geolocation, or live reputation data is invented."
        icon={Globe2}
      />
      <AnalyzerWorkbench
        mode="indicator"
        endpoint="/api/analyze/indicator"
        fieldName="indicator"
        fieldLabel="IPv4 address or domain name"
        placeholder="198.51.100.10 or example.com"
        helpText="Provide a hostname only — no scheme, path, port, or credentials."
        maxLength={320}
        examples={[
          { label: "Documentation IPv4", value: "198.51.100.10" },
          {
            label: "Brand-like domain example",
            value: "secure-login.paypal-verify.example.xyz",
          },
          { label: "Plain example domain", value: "example.com" },
        ]}
        scopeNotes={[
          "This analyzer performs local syntax and pattern checks only. It does not resolve DNS, query WHOIS, determine geolocation or ASN ownership, or retrieve abuse reports.",
          "Private and documentation IP ranges are reported for context, not as malicious findings.",
          "If a threat intelligence provider is configured, its verdict is displayed separately and never blended into the local score.",
          "A low score does not mean an indicator is safe.",
        ]}
      />
    </>
  );
}
