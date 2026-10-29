"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  Ban,
  BadgeCheck,
  ChevronDown,
  ClipboardList,
  Database,
  FileText,
  Flag,
  FlaskConical,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  ShieldQuestion,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ActionHistory } from "@/components/analysis/ActionHistory";
import { AuditTimeline } from "@/components/analysis/AuditTimeline";
import { ChecklistPanel } from "@/components/analysis/ChecklistPanel";
import { FindingsList } from "@/components/analysis/FindingsList";
import { VerificationPanel } from "@/components/analysis/VerificationPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReviewDialog } from "@/components/remediation/ReviewDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CopyButton } from "@/components/ui/CopyButton";
import { DemoModeToggle } from "@/components/ui/DemoModeToggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert, type AlertTone } from "@/components/ui/InlineAlert";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  DemoBadge,
  IntegrationBadge,
  SeverityBadge,
  StateBadge,
} from "@/components/ui/badges";
import { apiRequest, recordFromDetails } from "@/lib/client/api";
import { useAnalysisData } from "@/lib/client/useAnalysisData";
import { formatUtc, shortIndicator } from "@/lib/format";
import { INDICATOR_LIMITATIONS } from "@/lib/analysis/indicator";
import { URL_LIMITATIONS } from "@/lib/validation/url";
import {
  STATE_DESCRIPTIONS,
  STATE_LABELS,
} from "@/lib/remediation/stateMachine";
import { updateLocalHistory } from "@/lib/persistence/localHistory";
import type {
  AnalysisRecord,
  ChecklistStatus,
  SystemStatus,
} from "@/types";

type SessionState = "idle" | "loading" | "available" | "unavailable" | "demo";
type Operation = "checklist" | "block" | "verify" | "review" | null;

interface Notice {
  tone: AlertTone;
  title: string;
  text: string;
}

function verificationNotice(record: AnalysisRecord): Notice {
  const verification = record.verification;
  if (!verification) {
    return {
      tone: "warning",
      title: "Verification returned no result",
      text: "No verification evidence was recorded. Do not assume the indicator is blocked.",
    };
  }
  if (verification.status === "verified") {
    return {
      tone: "success",
      title: "Verification succeeded",
      text: verification.explanation,
    };
  }
  if (verification.status === "failed") {
    return {
      tone: "danger",
      title: "Verification failed",
      text: verification.explanation,
    };
  }
  if (verification.status === "pending") {
    return {
      tone: "warning",
      title: "Verification is pending",
      text: verification.explanation,
    };
  }
  return {
    tone: "warning",
    title: "Verification is not configured",
    text: verification.explanation,
  };
}

export function RemediationWorkspace() {
  const { userRecords, demoRecords, records, demoMode, storageNote, storageAvailable } =
    useAnalysisData();
  const searchParams = useSearchParams();
  const [manualId, setManualId] = useState<string | null>(null);
  const [serverRecord, setServerRecord] = useState<AnalysisRecord | null>(null);
  const [localOverride, setLocalOverride] = useState<AnalysisRecord | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [operation, setOperation] = useState<Operation>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const recordsRef = useRef(records);
  recordsRef.current = records;

  const searchId = searchParams.get("id") ?? "";
  const selectedId = manualId ?? (searchId || userRecords[0]?.id || "");

  useEffect(() => {
    let cancelled = false;
    apiRequest<SystemStatus>("/api/status").then((response) => {
      if (cancelled) return;
      if (response.ok) {
        setStatus(response.data);
        setStatusError(null);
      } else {
        setStatusError(response.message);
      }
      setStatusLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const candidate = recordsRef.current.find((entry) => entry.id === selectedId);
    if (candidate?.demo) {
      setServerRecord(null);
      setSessionState("demo");
      setSessionMessage(null);
      return;
    }

    let cancelled = false;
    setSessionState("loading");
    setSessionMessage(null);
    apiRequest<AnalysisRecord>(`/api/reports/${encodeURIComponent(selectedId)}`).then(
      (response) => {
        if (cancelled) return;
        if (response.ok) {
          setServerRecord(response.data);
          setSessionState("available");
        } else {
          setServerRecord(null);
          setSessionState("unavailable");
          setSessionMessage(response.message);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const baseRecord = records.find((entry) => entry.id === selectedId) ?? null;
  const record =
    serverRecord?.id === selectedId
      ? serverRecord
      : localOverride?.id === selectedId
        ? localOverride
        : baseRecord;

  const selectOptions =
    serverRecord && !records.some((entry) => entry.id === serverRecord.id)
      ? [...records, serverRecord]
      : records;

  const isDemo = record?.demo === true || sessionState === "demo";
  const integrationConfigured = status?.integration.configured === true;
  const actionsAvailable =
    Boolean(record) && !isDemo && sessionState === "available";
  const busy = operation !== null;

  function applyRecord(next: AnalysisRecord) {
    setServerRecord(next);
    setLocalOverride(next);
    if (!next.demo) {
      const stored = updateLocalHistory(next);
      if (!stored.ok && stored.message) {
        setNotice({ tone: "warning", title: "Local history not updated", text: stored.message });
      }
    }
  }

  async function refreshServer() {
    if (!selectedId || isDemo) return;
    setSessionState("loading");
    setNotice(null);
    const response = await apiRequest<AnalysisRecord>(
      `/api/reports/${encodeURIComponent(selectedId)}`,
    );
    if (response.ok) {
      setServerRecord(response.data);
      setSessionState("available");
      setSessionMessage(null);
      setNotice({
        tone: "info",
        title: "Record refreshed",
        text: "Loaded the latest server-session copy of this analysis.",
      });
    } else {
      setSessionRecordUnavailable(response.message);
    }
  }

  function setSessionRecordUnavailable(message: string) {
    setServerRecord(null);
    setSessionState("unavailable");
    setSessionMessage(message);
  }

  async function updateChecklist(itemId: string, itemStatus: ChecklistStatus) {
    if (!record) return;
    setOperation("checklist");
    setPendingItemId(itemId);
    setNotice(null);
    const response = await apiRequest<AnalysisRecord>("/api/remediation/checklist", {
      method: "POST",
      body: JSON.stringify({ analysisId: record.id, itemId, status: itemStatus }),
    });
    if (response.ok) {
      applyRecord(response.data);
      setNotice({
        tone: "success",
        title: "Checklist updated",
        text: "The server recorded this user-reported status and appended an audit event. It is not independent verification.",
      });
    } else {
      const partial = recordFromDetails<AnalysisRecord>(response.details);
      if (partial) applyRecord(partial);
      setNotice({
        tone: response.code === "NOT_FOUND" ? "warning" : "danger",
        title: "Checklist update failed",
        text: response.message,
      });
      if (response.code === "NOT_FOUND") setSessionRecordUnavailable(response.message);
    }
    setPendingItemId(null);
    setOperation(null);
  }

  async function runBlock() {
    if (!record) return;
    setBlockOpen(false);
    setOperation("block");
    setNotice(null);
    const response = await apiRequest<AnalysisRecord>("/api/remediation/execute", {
      method: "POST",
      body: JSON.stringify({ analysisId: record.id, confirm: true }),
    });
    if (response.ok) {
      applyRecord(response.data);
      setNotice({
        tone: "success",
        title: "Integration action recorded",
        text: `${response.data.actions.at(-1)?.message ?? "The integration reported success."} Run Verify Again to check the block status with evidence.`,
      });
    } else {
      const partial = recordFromDetails<AnalysisRecord>(response.details);
      if (partial) applyRecord(partial);
      setNotice({
        tone: response.code === "NOT_CONFIGURED" ? "warning" : "danger",
        title:
          response.code === "NOT_CONFIGURED"
            ? "Block action — Not Configured"
            : "Block action failed or was not confirmed",
        text: response.message,
      });
      if (response.code === "NOT_FOUND") setSessionRecordUnavailable(response.message);
    }
    setOperation(null);
  }

  async function runVerification() {
    if (!record) return;
    setOperation("verify");
    setNotice(null);
    const response = await apiRequest<AnalysisRecord>("/api/remediation/verify", {
      method: "POST",
      body: JSON.stringify({ analysisId: record.id }),
    });
    if (response.ok) {
      applyRecord(response.data);
      setNotice(verificationNotice(response.data));
    } else {
      const partial = recordFromDetails<AnalysisRecord>(response.details);
      if (partial) applyRecord(partial);
      setNotice({
        tone: response.code === "NOT_FOUND" ? "warning" : "danger",
        title: "Verification could not complete",
        text: response.message,
      });
      if (response.code === "NOT_FOUND") setSessionRecordUnavailable(response.message);
    }
    setOperation(null);
  }

  async function runReview(reason: string) {
    if (!record) return;
    setReviewOpen(false);
    setOperation("review");
    setNotice(null);
    const response = await apiRequest<AnalysisRecord>("/api/remediation/review", {
      method: "POST",
      body: JSON.stringify({
        analysisId: record.id,
        ...(reason ? { reason } : {}),
      }),
    });
    if (response.ok) {
      applyRecord(response.data);
      setNotice({
        tone: "info",
        title: "False-positive review recorded",
        text: "The detection was not overridden automatically. The case is now pending human review.",
      });
    } else {
      setNotice({
        tone: response.code === "NOT_FOUND" ? "warning" : "danger",
        title: "Review request failed",
        text: response.message,
      });
      if (response.code === "NOT_FOUND") setSessionRecordUnavailable(response.message);
    }
    setOperation(null);
  }

  const limitations = record
    ? record.indicatorType === "url"
      ? URL_LIMITATIONS
      : INDICATOR_LIMITATIONS
    : [];

  return (
    <>
      <PageHeader
        eyebrow="CORRECT → VERIFY"
        title="Threat Remediation"
        description="Work a recorded analysis through a validated lifecycle. Checklist changes are user-reported; VERIFIED is written only by the server when a configured integration confirms the block."
        icon={ShieldCheck}
        actions={
          record ? (
            <Link
              href={`/reports/${encodeURIComponent(record.id)}`}
              className="btn btn-secondary"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              View report
            </Link>
          ) : null
        }
      />

      {!storageAvailable && storageNote ? (
        <InlineAlert tone="warning" title="Browser storage unavailable" className="mb-4">
          {storageNote}
        </InlineAlert>
      ) : null}

      <section className="panel mb-5 p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div>
            <label htmlFor="case-select" className="field-label">
              Select an analysis
            </label>
            <select
              id="case-select"
              className="input-field"
              value={selectedId}
              onChange={(event) => {
                setManualId(event.target.value);
                setServerRecord(null);
                setLocalOverride(null);
                setNotice(null);
              }}
            >
              <option value="" disabled>
                {selectOptions.length === 0
                  ? "No analyses in this browser yet"
                  : "Choose a recorded analysis"}
              </option>
              {userRecords.length > 0 ? (
                <optgroup label="Your browser-local history">
                  {userRecords.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.severity.toUpperCase()} · {shortIndicator(entry.normalized, 70)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {demoMode && demoRecords.length > 0 ? (
                <optgroup label="DEMO DATA — read-only">
                  {demoRecords.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      DEMO · {entry.severity.toUpperCase()} ·{" "}
                      {shortIndicator(entry.normalized, 58)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {serverRecord && !records.some((entry) => entry.id === serverRecord.id) ? (
                <optgroup label="Server session">
                  <option value={serverRecord.id}>
                    SERVER · {shortIndicator(serverRecord.normalized, 58)}
                  </option>
                </optgroup>
              ) : null}
            </select>
            <p className="mt-2 text-[0.7rem] leading-relaxed text-slate-500">
              Remediation actions require the record to be loaded in the current
              server session. Server-session records expire after 24 hours or when
              the process restarts.
            </p>
          </div>

          <div className="rounded-xl border border-[#1b3a5c] bg-[#06101f]/55 px-3.5 py-3">
            <p className="text-[0.66rem] uppercase tracking-[0.12em] text-slate-500">
              Block integration
            </p>
            <div className="mt-2 flex items-center gap-2">
              {statusLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden="true" />
              ) : (
                <IntegrationBadge configured={integrationConfigured} />
              )}
            </div>
            <p className="mt-1.5 max-w-[240px] text-[0.68rem] leading-relaxed text-slate-500">
              {status?.integration.name ??
                (statusError
                  ? "Configuration status unavailable."
                  : "No remediation integration is configured. No blocking action will be attempted.")}
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={refreshServer}
            disabled={!selectedId || isDemo || sessionState === "loading"}
          >
            <RefreshCw
              className={`h-4 w-4 ${sessionState === "loading" ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh session
          </button>
        </div>
      </section>

      {notice ? (
        <InlineAlert tone={notice.tone} title={notice.title} className="mb-4">
          {notice.text}
        </InlineAlert>
      ) : null}

      {isDemo ? (
        <InlineAlert tone="demo" title="DEMO DATA — read-only remediation view" className="mb-4">
          This fictional record illustrates pending, failed, and not-configured
          remediation states. No action can be taken, and no verification claim is
          real.
        </InlineAlert>
      ) : null}

      {!record ? (
        sessionState === "loading" ? (
          <div className="panel flex items-center justify-center gap-3 p-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Checking the current server session…
          </div>
        ) : (
          <div className="space-y-5">
            <EmptyState
              icon={ShieldQuestion}
              title={selectedId ? "Analysis not available in this session" : "No analysis selected"}
              description={
                sessionMessage ??
                "Run a URL, IP, or domain analysis first. Remediation actions are only available for a record held by the current server session."
              }
              action={
                <>
                  <Link href="/analyzer" className="btn btn-primary">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Analyze a URL
                  </Link>
                  <Link href="/indicators" className="btn btn-secondary">
                    Check an IP or domain
                  </Link>
                  <Link href="/history" className="btn btn-ghost">
                    Open history
                  </Link>
                </>
              }
            />
            <DemoModeToggle />
          </div>
        )
      ) : (
        <div className="space-y-5">
          {sessionState === "unavailable" && !isDemo ? (
            <InlineAlert tone="warning" title="Not in the current server session">
              {sessionMessage ??
                "This snapshot is available in browser history, but the server no longer has the record. Re-run the analysis to enable controlled actions and verification."}{" "}
              <Link href="/analyzer" className="font-semibold text-cyan-200 underline">
                Re-run an analysis
              </Link>
            </InlineAlert>
          ) : null}

          <section className="panel overflow-hidden">
            <div className="scan-grid flex flex-wrap items-center gap-2 border-b border-[#173450] px-5 py-3.5">
              <SeverityBadge severity={record.severity} />
              <StateBadge state={record.state} label={STATE_LABELS[record.state]} />
              {record.demo ? <DemoBadge /> : null}
              <span className="chip text-slate-400">
                {record.indicatorType === "url"
                  ? "URL"
                  : record.indicatorType === "ipv4"
                    ? "IPv4"
                    : "Domain"}
              </span>
              <span className="ml-auto mono text-[0.65rem] text-slate-600">
                {record.id}
              </span>
            </div>
            <div className="grid gap-5 p-5 lg:grid-cols-[auto_1fr] lg:items-center">
              <ScoreRing score={record.score} severity={record.severity} size={112} />
              <div className="min-w-0">
                <p className="mono break-all text-[0.88rem] font-semibold leading-relaxed text-white">
                  {record.normalized}
                </p>
                <p className="mt-2 text-[0.78rem] leading-relaxed text-slate-400">
                  {STATE_DESCRIPTIONS[record.state]}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="chip text-slate-400">
                    Created {formatUtc(record.createdAt)}
                  </span>
                  <span className="chip text-slate-400">
                    {record.findings.length} findings
                  </span>
                  <CopyButton value={record.normalized} label="Copy indicator" className="btn btn-ghost text-[0.72rem]" />
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-3">
            <section className="panel p-5">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-rose-300" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-white">Controlled block action</h3>
              </div>
              <p className="mt-2 text-[0.76rem] leading-relaxed text-slate-400">
                Sends the normalized indicator to the configured remediation
                integration. An explicit confirmation is required. The action
                records the integration&apos;s actual response, including failures
                and timeouts.
              </p>
              <div className="mt-3 rounded-lg border border-[#173450] bg-[#030a14]/55 p-3">
                <p className="text-[0.66rem] uppercase tracking-[0.12em] text-slate-500">
                  Integration
                </p>
                <p className="mt-1 text-[0.8rem] font-medium text-slate-200">
                  {status?.integration.name ?? "Not Configured"}
                </p>
                {status?.integration.reason ? (
                  <p className="mt-1 text-[0.68rem] leading-relaxed text-amber-200/80">
                    {status.integration.reason}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="btn btn-danger mt-3 w-full"
                disabled={!actionsAvailable || !integrationConfigured || busy}
                onClick={() => setBlockOpen(true)}
                title={
                  !integrationConfigured
                    ? "No block integration is configured."
                    : !actionsAvailable
                      ? "Actions require the record to be loaded in the current server session."
                      : undefined
                }
              >
                {operation === "block" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Ban className="h-4 w-4" aria-hidden="true" />
                )}
                {integrationConfigured
                  ? "Block indicator via integration"
                  : "Block action — Not Configured"}
              </button>
              <p className="mt-2 text-[0.66rem] leading-relaxed text-slate-600">
                No blocking success is claimed from this button alone. Run Verify
                Again to confirm the block status.
              </p>
            </section>

            <section className="panel p-5">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-violet-300" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-white">False-positive review</h3>
              </div>
              <p className="mt-2 text-[0.76rem] leading-relaxed text-slate-400">
                Request a human review when you believe the detection is
                legitimate. The local detection is retained, and no automatic
                override occurs.
              </p>
              {record.review ? (
                <div className="mt-3 rounded-lg border border-violet-400/20 bg-violet-400/[0.05] p-3">
                  <p className="text-[0.74rem] font-medium text-violet-100">
                    Review requested {formatUtc(record.review.requestedAt)}
                  </p>
                  {record.review.reason ? (
                    <p className="mt-1 text-[0.7rem] leading-relaxed text-violet-100/70">
                      {record.review.reason}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                className="btn btn-secondary mt-3 w-full"
                disabled={!actionsAvailable || busy}
                onClick={() => setReviewOpen(true)}
              >
                {operation === "review" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Flag className="h-4 w-4" aria-hidden="true" />
                )}
                {record.review ? "Update review request" : "Request review"}
              </button>
            </section>

            <section className="panel p-5">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-white">Verify Again</h3>
              </div>
              <p className="mt-2 text-[0.76rem] leading-relaxed text-slate-400">
                Re-runs the local analysis, performs any configured provider check,
                and asks the configured integration whether the indicator is
                blocked. A clean rescan alone never results in VERIFIED.
              </p>
              <div className="mt-3 rounded-lg border border-[#173450] bg-[#030a14]/55 p-3">
                <p className="text-[0.66rem] uppercase tracking-[0.12em] text-slate-500">
                  Current verification
                </p>
                <p className="mt-1 text-[0.8rem] font-medium text-slate-200">
                  {record.verification
                    ? record.verification.status.replace("_", " ")
                    : "Not run"}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary mt-3 w-full"
                disabled={!actionsAvailable || busy}
                onClick={runVerification}
              >
                {operation === "verify" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                )}
                {operation === "verify" ? "Checking evidence…" : "Verify Again"}
              </button>
              <p className="mt-2 text-[0.66rem] leading-relaxed text-slate-600">
                The server enforces the lifecycle transitions. A client cannot
                set VERIFIED directly.
              </p>
            </section>
          </div>

          <SectionCard
            title="Remediation checklist"
            description="Update the status as you complete manual or authorized actions. These statuses are user-reported and are not independent block evidence."
            actions={
              <span className="chip text-slate-500">
                <ClipboardList className="h-3 w-3" aria-hidden="true" />
                {record.checklist.filter((item) => item.status === "completed").length}/
                {record.checklist.length} complete
              </span>
            }
          >
            <ChecklistPanel
              items={record.checklist}
              onUpdate={updateChecklist}
              pendingItemId={pendingItemId}
              disabled={!actionsAvailable || busy}
            />
          </SectionCard>

          <SectionCard
            title="Verification evidence"
            description="Each check records what actually happened. Missing dependencies remain visible instead of being treated as success."
            actions={
              <span className="chip border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-200">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Evidence-based
              </span>
            }
          >
            <VerificationPanel verification={record.verification} />
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard
              title="Recorded actions"
              description="Every controlled action attempt, including not-configured, failed, and timed-out outcomes."
            >
              <ActionHistory actions={record.actions} />
            </SectionCard>

            <SectionCard
              title="Audit trail"
              description="Append-only server events for this analysis. State transitions are validated before they are applied."
            >
              <AuditTimeline events={record.audit} />
            </SectionCard>
          </div>

          <details className="panel p-5">
            <summary className="flex items-center gap-2 text-sm font-semibold text-white">
              <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Detection context and limitations
              <span className="ml-auto chip text-slate-500">
                <Layers className="h-3 w-3" aria-hidden="true" />
                {record.findings.length} findings
              </span>
            </summary>
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip text-slate-400">
                  <Activity className="h-3 w-3" aria-hidden="true" />
                  Score {record.score}/100
                </span>
                <span className="chip text-slate-400">
                  <Database className="h-3 w-3" aria-hidden="true" />
                  {record.method}
                </span>
                {record.provider ? (
                  <span className="chip text-slate-400">
                    Provider: {record.provider.status}
                  </span>
                ) : null}
              </div>
              <FindingsList findings={record.findings} />
              <div>
                <p className="text-[0.76rem] font-semibold text-slate-300">Limitations</p>
                <ul className="mt-2 space-y-1.5">
                  {limitations.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-[0.72rem] leading-relaxed text-slate-500"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>

          <div className="panel flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-[0.72rem] text-slate-500">
              <TriangleAlert className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
              No remediation claim is made without recorded evidence.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/reports/${encodeURIComponent(record.id)}`}
                className="btn btn-secondary text-[0.74rem]"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                Full report
              </Link>
              <Link href="/history" className="btn btn-ghost text-[0.74rem]">
                <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                Switch analysis
              </Link>
              <Link href="/analyzer" className="btn btn-ghost text-[0.74rem]">
                <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                New analysis
              </Link>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={blockOpen}
        title="Confirm controlled block action"
        description={
          record
            ? `This will ask the configured integration “${
                status?.integration.name ?? "Unknown integration"
              }” to block ${record.normalized}. ThreatLens records the actual response and does not claim success unless the integration reports it. This is a security-changing action.`
            : ""
        }
        confirmLabel="Confirm block action"
        tone="danger"
        pending={operation === "block"}
        onCancel={() => setBlockOpen(false)}
        onConfirm={runBlock}
      />

      <ReviewDialog
        key={reviewOpen ? "review-open" : "review-closed"}
        open={reviewOpen}
        pending={operation === "review"}
        onCancel={() => setReviewOpen(false)}
        onConfirm={runReview}
      />
    </>
  );
}
