import { downloadJson, type DownloadResult } from "@/lib/client/download";
import { safeFilename } from "@/lib/format";
import { VERIFICATION_LIMITATIONS } from "@/lib/verification";
import type { AnalysisRecord } from "@/types";

export interface ReportExportPayload {
  reportVersion: 1;
  generatedAt: string;
  demoData: boolean;
  notice: string;
  assurance: {
    analysisMethod: string;
    scoreMeaning: string;
    verifiedMeaning: string;
    limitations: string[];
  };
  record: AnalysisRecord;
}

export function buildReportExport(record: AnalysisRecord): ReportExportPayload {
  return {
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    demoData: record.demo === true,
    notice:
      record.demo === true
        ? "DEMO DATA. This record is fictional and illustrative only. It is not live threat intelligence and does not describe a real indicator, provider result, or remediation action."
        : "Generated from the browser-local ThreatLens AI analysis history. This is local heuristic output, not live threat intelligence or proof of malicious activity.",
    assurance: {
      analysisMethod:
        "Deterministic local heuristics. The reported score is the bounded sum of the explicit finding contributions in this record.",
      scoreMeaning:
        "0–24 Low, 25–49 Medium, 50–74 High, 75–100 Critical. The band describes heuristic risk, not a malware verdict or a guarantee of safety.",
      verifiedMeaning:
        "VERIFIED is only recorded when a configured remediation integration reports the indicator as blocked. A clean rescan or a completed checklist is not independent verification.",
      limitations: [
        ...VERIFICATION_LIMITATIONS,
        "ThreatLens AI never visits, fetches, or follows redirects from submitted indicators.",
        "No geolocation, WHOIS, DNS, or live reputation data is invented by this application.",
      ],
    },
    record,
  };
}

export function exportReportJson(record: AnalysisRecord): DownloadResult {
  const payload = buildReportExport(record);
  const stamp = new Date().toISOString().slice(0, 10);
  const prefix = record.demo ? "threatlens-demo-report" : "threatlens-report";
  return downloadJson(
    `${prefix}-${safeFilename(record.id) || "record"}-${stamp}.json`,
    payload,
  );
}
