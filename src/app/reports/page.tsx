"use client";

import Link from "next/link";
import {
  ArrowRight,
  FileText,
  FlaskConical,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DemoModeToggle } from "@/components/ui/DemoModeToggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportButton } from "@/components/ui/ExportButton";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  DemoBadge,
  SeverityBadge,
  StateBadge,
  VerificationBadge,
} from "@/components/ui/badges";
import { useAnalysisData } from "@/lib/client/useAnalysisData";
import { exportReportJson } from "@/lib/client/reportExport";
import { formatUtc, shortIndicator } from "@/lib/format";
import { exportHistoryJson } from "@/lib/persistence/localHistory";
import { STATE_LABELS } from "@/lib/remediation/stateMachine";
import type { AnalysisRecord, RiskBand } from "@/types";

const SEVERITIES: Array<{ value: "all" | RiskBand; label: string }> = [
  { value: "all", label: "All risk bands" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function ReportCard({ record }: { record: AnalysisRecord }) {
  return (
    <article className="panel panel-interactive flex flex-col p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={record.severity} />
        <span className="tabular text-[0.72rem] font-semibold text-slate-500">
          {record.score}/100
        </span>
        <StateBadge state={record.state} label={STATE_LABELS[record.state]} />
        {record.demo ? <DemoBadge /> : null}
      </div>

      <h3 className="mono mt-3 break-all text-[0.82rem] leading-relaxed text-slate-100">
        {shortIndicator(record.normalized, 120)}
      </h3>
      <p className="mt-1.5 text-[0.68rem] text-slate-600">
        {record.indicatorType === "url"
          ? "URL"
          : record.indicatorType === "ipv4"
            ? "IPv4 address"
            : "Domain"}{" "}
        · {record.findings.length} findings · {formatUtc(record.createdAt)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {record.verification ? (
          <VerificationBadge status={record.verification.status} />
        ) : (
          <span className="chip text-slate-500">Verification not run</span>
        )}
        {record.review ? (
          <span className="chip border-violet-400/25 bg-violet-400/[0.06] text-violet-200">
            Review requested
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#173450] pt-3">
        <Link
          href={`/reports/${encodeURIComponent(record.id)}`}
          className="btn btn-secondary text-[0.72rem]"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Open report
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <ExportButton
          onExport={() => exportReportJson(record)}
          label="Export"
          className="btn btn-ghost text-[0.72rem]"
        />
        {record.demo ? null : (
          <Link
            href={`/remediation?id=${encodeURIComponent(record.id)}`}
            className="btn btn-ghost ml-auto text-[0.72rem]"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Remediation
          </Link>
        )}
      </div>
    </article>
  );
}

export default function ReportsPage() {
  const { userRecords, demoRecords, demoMode } = useAnalysisData();
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<"all" | RiskBand>("all");

  const filter = (records: AnalysisRecord[]) => {
    const needle = search.trim().toLowerCase();
    return [...records]
      .filter((record) => {
        if (severity !== "all" && record.severity !== severity) return false;
        if (!needle) return true;
        return (
          record.input.toLowerCase().includes(needle) ||
          record.normalized.toLowerCase().includes(needle) ||
          record.id.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  };

  const filteredUser = filter(userRecords);
  const filteredDemo = filter(demoRecords);

  return (
    <>
      <PageHeader
        eyebrow="Report and export"
        title="Reports"
        description="Review the evidence recorded with each analysis and export the exact snapshot as JSON. Reports stay browser-local unless you choose to share them."
        icon={FileText}
        actions={
          <ExportButton
            label="Export my history"
            onExport={exportHistoryJson}
            className="btn btn-secondary"
          />
        }
      />

      <div className="panel mb-5 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reports by indicator or ID…"
            aria-label="Search reports"
            className="input-field pl-9"
          />
        </div>
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value as "all" | RiskBand)}
          aria-label="Filter reports by risk band"
          className="input-field sm:w-48"
        >
          {SEVERITIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <SectionCard
        title={`Your reports (${filteredUser.length})`}
        description="Each report contains the local findings, score construction, provider summary, remediation state, checklist, actions, verification evidence, and append-only audit trail."
      >
        {filteredUser.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={
              userRecords.length === 0
                ? "No reports on this device"
                : "No reports match these filters"
            }
            description={
              userRecords.length === 0
                ? "Run an analysis to create a report. The JSON export is generated from the exact record shown here."
                : "Adjust the search text or risk band to see more reports."
            }
            action={
              userRecords.length === 0 ? (
                <Link href="/analyzer" className="btn btn-primary">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Start an analysis
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearch("");
                    setSeverity("all");
                  }}
                >
                  Clear filters
                </button>
              )
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredUser.map((record) => (
              <ReportCard key={record.id} record={record} />
            ))}
          </div>
        )}
      </SectionCard>

      <div className="mt-5">
        <DemoModeToggle />
      </div>

      {demoMode ? (
        <div className="mt-5">
          <SectionCard
            title={`DEMO DATA (${filteredDemo.length})`}
            description="Illustrative reports only. They are not live threat intelligence and do not describe real indicators, provider responses, or remediation actions."
            actions={
              <span className="chip border-violet-400/30 bg-violet-400/10 text-violet-200">
                <FlaskConical className="h-3 w-3" aria-hidden="true" />
                Fictional reports
              </span>
            }
          >
            {filteredDemo.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No demo reports match these filters"
                description="Clear the filters to view all illustrative reports."
                action={
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSearch("");
                      setSeverity("all");
                    }}
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredDemo.map((record) => (
                  <ReportCard key={record.id} record={record} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}
    </>
  );
}
