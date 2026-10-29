"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Database,
  FileText,
  FlaskConical,
  Loader2,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportDocument } from "@/components/reports/ReportDocument";
import { DemoModeToggle } from "@/components/ui/DemoModeToggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportButton } from "@/components/ui/ExportButton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { apiRequest } from "@/lib/client/api";
import { exportReportJson } from "@/lib/client/reportExport";
import { useAnalysisData } from "@/lib/client/useAnalysisData";
import { addToLocalHistory } from "@/lib/persistence/localHistory";
import type { AnalysisRecord } from "@/types";

export function ReportDetail({ id }: { id: string }) {
  const { userRecords, demoRecords, demoMode } = useAnalysisData();
  const [serverRecord, setServerRecord] = useState<AnalysisRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    tone: "danger" | "success" | "warning" | "info";
    text: string;
  } | null>(null);

  const localRecord =
    userRecords.find((record) => record.id === id) ??
    demoRecords.find((record) => record.id === id) ??
    null;
  const record = localRecord ?? (serverRecord?.id === id ? serverRecord : null);
  const savedLocally = userRecords.some((entry) => entry.id === id);

  async function loadFromServer() {
    setLoading(true);
    setMessage(null);
    const response = await apiRequest<AnalysisRecord>(
      `/api/reports/${encodeURIComponent(id)}`,
    );
    if (!response.ok) {
      setMessage({ tone: "danger", text: response.message });
    } else {
      setServerRecord(response.data);
      setMessage({
        tone: "info",
        text: `Loaded from the current server session. Server records expire after 24 hours or when the process restarts.`,
      });
    }
    setLoading(false);
  }

  function saveLocally() {
    if (!record || record.demo) return;
    const stored = addToLocalHistory(record);
    setMessage({
      tone: stored.ok ? "success" : "warning",
      text:
        stored.message ??
        (stored.ok
          ? "Saved to browser-local history on this device."
          : "The browser could not save this record."),
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Report / evidence snapshot"
        title={record ? "Analysis report" : "Report not found"}
        description={
          record
            ? "A complete snapshot of the recorded analysis. The JSON export is generated from this exact record, including its audit trail and verification evidence."
            : "This report is not in browser-local history. It may still exist in the current server session, or it may have expired."
        }
        icon={FileText}
        actions={
          <>
            <Link href="/reports" className="btn btn-secondary">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              All reports
            </Link>
            {record ? (
              <ExportButton
                onExport={() => exportReportJson(record)}
                label="Export JSON"
                className="btn btn-primary"
              />
            ) : null}
          </>
        }
      />

      {message ? (
        <InlineAlert tone={message.tone} className="mb-4">
          {message.text}
        </InlineAlert>
      ) : null}

      {record ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {record.demo ? (
              <span className="chip border-violet-400/30 bg-violet-400/10 text-violet-200">
                <FlaskConical className="h-3 w-3" aria-hidden="true" />
                DEMO DATA — fictional
              </span>
            ) : null}
            {!savedLocally && !record.demo ? (
              <button type="button" className="btn btn-secondary text-[0.74rem]" onClick={saveLocally}>
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                Save to browser history
              </button>
            ) : null}
            {!savedLocally && !record.demo ? (
              <span className="text-[0.7rem] text-slate-500">
                This record came from the server session.
              </span>
            ) : null}
          </div>
          <ReportDocument record={record} />
        </>
      ) : (
        <div className="space-y-5">
          <EmptyState
            icon={FileText}
            title="Report unavailable in this browser"
            description="Browser-local history does not contain this ID. You can try loading it from the current server session. Server-session records expire after 24 hours or when the app process restarts. No action is performed automatically."
            action={
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={loadFromServer}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Database className="h-4 w-4" aria-hidden="true" />
                  )}
                  {loading ? "Checking server session…" : "Load from server session"}
                </button>
                <Link href="/analyzer" className="btn btn-secondary">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Re-run an analysis
                </Link>
              </>
            }
          />
          {demoMode ? null : <DemoModeToggle />}
        </div>
      )}
    </>
  );
}
