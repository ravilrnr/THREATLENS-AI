import type { Metadata } from "next";
import { Link2 } from "lucide-react";
import { AnalyzerWorkbench } from "@/components/analysis/AnalyzerWorkbench";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "URL Analyzer",
  description:
    "Analyze a URL with deterministic local heuristics. ThreatLens never visits or fetches the submitted URL.",
};

export default function UrlAnalyzerPage() {
  return (
    <>
      <PageHeader
        eyebrow="Detect → Explain"
        title="URL Analyzer"
        description="Break a suspicious URL into explicit, explainable risk findings. Analysis is local, deterministic, and never contacts the submitted URL or follows redirects."
        icon={Link2}
      />
      <AnalyzerWorkbench
        mode="url"
        endpoint="/api/analyze/url"
        fieldName="url"
        fieldLabel="Suspicious URL"
        placeholder="https://example.com/login/verify"
        helpText="Include the scheme (http:// or https://). Up to 2,048 characters."
        maxLength={2048}
        examples={[
          {
            label: "Benign example",
            value: "https://www.example.com/security-awareness",
          },
          {
            label: "Credential-themed example",
            value: "http://user:pass@paypal.com.verify-account.example.net/login?redirect=http://example.org/report",
          },
          {
            label: "Obfuscated example",
            value: "http://paypal.com@198.51.100.10:8080/secure/login/verify?url=http%3A%2F%2Fevil.example&next=javascript:alert(1)",
          },
        ]}
        scopeNotes={[
          "Only lexical and structural URL properties are examined. Page content, TLS certificates, hosting history, and live reputation are not checked.",
          "Every finding lists the exact evidence observed and the points it contributes to the 0–100 score.",
          "No network request is made to the submitted URL. ThreatLens AI never visits, fetches, or follows redirects from submitted indicators.",
          "A low score is not a guarantee of safety. A high score is not proof of malicious intent.",
        ]}
      />
    </>
  );
}
