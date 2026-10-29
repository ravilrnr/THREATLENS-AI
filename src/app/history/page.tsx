"use client";

import Link from "next/link";
import {
  FlaskConical,
  History,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecordTable } from "@/components/history/RecordTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DemoModeToggle } from "@/components/ui/DemoModeToggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportButton } from "@/components/ui/ExportButton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { SectionCard } from "@/components/ui/SectionCard";
import { useAnalysisData } from "@/lib/client/useAnalysisData";
import {
  clearLocalHistory,
  deleteFromLocalHistory,
  exportHistoryJson,
} from "@/lib/persistence/localHistory";
import type { AnalysisRecord, RiskBand } from "@/types";

const SEVERITY_OPTIONS: Array<{ value: "all" | RiskBand; label: string }> = [
  { value: "all", label: "All risk bands" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function HistoryPage() {
  const { userRecords, demoRecords, demoMode, storageNote, storageAvailable } =
    useAnalysisData();
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<"all" | RiskBand>("all");
  const [deleteTarget, setDeleteTarget] = useState<AnalysisRecord | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  const filter = (records: AnalysisRecord[]) => {
    const needle = search.trim().toLowerCase();
    return [...records]
      .filter((record) => {
        if (severity !== "all" && record.severity !== severity) return false;
        if (!needle) return true;
        return (
          record.input.toLowerCase().includes(needle) ||
          record.normalized.toLowerCase().includes(needle) ||
          record.id.toLowerCase().includes(needle) ||
          record.state.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  };

  const filteredUser = filter(userRecords);
  const filteredDemo = filter(demoRecords);

  return (
    <>
      <PageHeader
        eyebrow="Browser-local evidence"
        title="Analysis History"
        description="Every analysis is saved in this browser only. Demo data is kept separate and clearly labelled. Server-session records expire after 24 hours."
        icon={History}
        actions={
          <>
            <ExportButton
              label="Export my history"
              onExport={exportHistoryJson}
              className="btn btn-secondary"
            />
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setClearOpen(true)}
              disabled={userRecords.length === 0}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear history
            </button>
          </>
        }
      />

      {!storageAvailable && storageNote ? (
        <InlineAlert tone="warning" title="Browser storage unavailable" className="mb-4">
          {storageNote}
        </InlineAlert>
      ) : null}

      <div className="panel mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search indicator, ID, or state…"
            aria-label="Search analysis history"
            className="input-field pl-9"
          />
        </div>
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value as "all" | RiskBand)}
          aria-label="Filter by risk band"
          className="input-field sm:w-48"
        >
          {SEVERITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <SectionCard
        title={`Your browser-local history (${filteredUser.length})`}
        description="These records belong to this device and this browser profile. They are not shared with the server store, except when an analysis is re-opened for remediation in the current server session."
        actions={
          <Link href="/analyzer" className="btn btn-secondary text-[0.75rem]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            New analysis
          </Link>
        }
      >
        <RecordTable
          records={filteredUser}
          onDelete={(record) => setDeleteTarget(record)}
          empty={
            <EmptyState
              icon={userRecords.length === 0 ? ShieldCheck : Search}
              title={
                userRecords.length === 0
                  ? "No saved analyses yet"
                  : "No records match these filters"
              }
              description={
                userRecords.length === 0
                  ? "Run an analysis to create a browser-local snapshot. Nothing is written to a remote database."
                  : "Adjust the search text or risk band to see more records."
              }
              action={
                userRecords.length === 0 ? (
                  <Link href="/analyzer" className="btn btn-primary">
                    Analyze a URL
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
          }
        />
      </SectionCard>

      <div className="mt-5">
        <DemoModeToggle />
      </div>

      {demoMode ? (
        <div className="mt-5">
          <SectionCard
            title={`DEMO DATA (${filteredDemo.length})`}
            description="Fictional illustrative records using reserved example domains and documentation IP ranges. They are read-only, never merged into your history, and never exported as real findings."
            actions={
              <span className="chip border-violet-400/30 bg-violet-400/10 text-violet-200">
                <FlaskConical className="h-3 w-3" aria-hidden="true" />
                Fictional
              </span>
            }
          >
            <RecordTable
              records={filteredDemo}
              empty={
                <EmptyState
                  icon={Search}
                  title="No demo records match these filters"
                  description="Clear the filters to view the full illustrative dataset."
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
              }
            />
          </SectionCard>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this local record?"
        description={
          deleteTarget
            ? `This removes ${deleteTarget.normalized} from this browser profile. It does not remove any server-session copy, and no integration or blocking action is undone.`
            : ""
        }
        confirmLabel="Delete record"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteFromLocalHistory(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      <ConfirmDialog
        open={clearOpen}
        title="Clear all browser-local history?"
        description="This permanently removes every user analysis snapshot from this browser profile. Demo records and server-session records are unaffected. Exported files are not deleted."
        confirmLabel="Clear everything"
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          clearLocalHistory();
          setClearOpen(false);
        }}
      />
    </>
  );
}
