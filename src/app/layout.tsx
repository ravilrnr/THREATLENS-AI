import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: {
    default: "ThreatLens AI — Threat Analysis Workspace",
    template: "%s · ThreatLens AI",
  },
  description:
    "A local-first threat analysis and phishing triage workspace with explainable heuristics, remediation guidance, and evidence-based verification.",
  applicationName: "ThreatLens AI",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
