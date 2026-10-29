"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  FileText,
  FlaskConical,
  Globe2,
  History,
  LayoutDashboard,
  Link2,
  Lock,
  Radar,
  ScanLine,
  ShieldCheck,
  ShieldQuestion,
  WifiOff,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { DemoModeToggle } from "@/components/ui/DemoModeToggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { RecordTable } from "@/components/history/RecordTable";
import { useAnalysisData } from "@/lib/client/useAnalysisData";

const WORKFLOW = [
  {
    title: "Detect",
    icon: ScanLine,
    text: "Validated input plus deterministic local rules. No hidden reputation blending.",
  },
  {
    title: "Explain",
    icon: Activity,
    text: "Every finding shows evidence, impact, confidence, and its exact score contribution.",
  },
  {
    title: "Correct",
    icon: ShieldCheck,
    text: "A remediation checklist with manual guidance and optional controlled integration actions.",
  },
  {
    title: "Verify",
    icon: BadgeCheck,
    text: "VERIFIED requires a configured integration to report the block — never a clean rescan alone.",
  },
  {
    title: "Report",
    icon: FileText,
    text: "Export a JSON report containing the findings, state, checklist, actions, evidence, and audit trail.",
  },
] as const;

const QUICK_ACTIONS = [
  {
    href: "/analyzer",
    title: "Analyze a URL",
    description: "Break down a suspicious link without visiting it.",
    icon: Link2,
  },
  {
    href: "/indicators",
    title: "Check an IP or domain",
    description: "Local syntax and pattern analysis, no fabricated lookups.",
    icon: Globe2,
  },
  {
    href: "/remediation",
    title: "Work a remediation",
    description: "Checklist, controlled actions, and evidence-based verification.",
    icon: ShieldCheck,
  },
  {
    href: "/reports",
    title: "Open reports",
    description: "Review and export browser-local analysis records.",
    icon: FileText,
  },
] as const;

export default function OverviewPage() {
  const { userRecords, demoRecords, demoMode, storageNote, storageAvailable } =
    useAnalysisData();

  const highRisk = userRecords.filter(
    (record) => record.severity === "high" || record.severity === "critical",
  ).length;
  const verified = userRecords.filter((record) => record.state === "VERIFIED").length;
  const awaitingVerification = userRecords.filter(
    (record) =>
      record.state === "VERIFICATION_PENDING" ||
      record.verification?.status === "pending",
  ).length;
  const failedVerification = userRecords.filter(
    (record) =>
      record.state === "VERIFICATION_FAILED" ||
      record.verification?.status === "failed",
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="DETECT → EXPLAIN → CORRECT → VERIFY → REPORT"
        title="Security overview"
        description="A local-first workspace for explaining indicator risk, guiding remediation, and keeping verification claims tied to real evidence."
        icon={LayoutDashboard}
        actions={
          <Link href="/analyzer" className="btn btn-primary">
            <ScanLine className="h-4 w-4" aria-hidden="true" />
            Start an analysis
          </Link>
        }
      />

      {demoMode ? (
        <InlineAlert tone="demo" title="DEMO DATA is visible" className="mb-5">
          {demoRecords.length} fictional records are shown in History and Reports.
          They use reserved example domains and documentation IP ranges, are
          clearly labelled, and are never saved into your browser-local history.
        </InlineAlert>
      ) : null}

      {!storageAvailable && storageNote ? (
        <InlineAlert tone="warning" title="Browser storage unavailable" className="mb-5">
          {storageNote}
        </InlineAlert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Your analyses"
          value={userRecords.length}
          detail="Records saved in this browser only"
          icon={History}
          tone="cyan"
        />
        <StatCard
          label="High or critical"
          value={highRisk}
          detail="Heuristic risk band, not confirmed malware"
          icon={CircleAlert}
          tone="rose"
        />
        <StatCard
          label="Verified"
          value={verified}
          detail="Block confirmed by a configured integration"
          icon={BadgeCheck}
          tone="emerald"
        />
        <StatCard
          label="Awaiting verification"
          value={awaitingVerification}
          detail={
            failedVerification > 0
              ? `${failedVerification} verification failure(s) recorded`
              : "No failed verification recorded"
          }
          icon={Radar}
          tone="amber"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <SectionCard
          title="The workflow"
          description="Each stage is explicit. Later stages never claim evidence that was not recorded."
        >
          <div className="grid gap-2.5 sm:grid-cols-5">
            {WORKFLOW.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="relative rounded-xl border border-[#173450] bg-[#06101f]/55 p-3.5"
                >
                  <span className="mono text-[0.58rem] uppercase tracking-[0.16em] text-cyan-300/70">
                    0{index + 1}
                  </span>
                  <Icon className="mt-2 h-4 w-4 text-cyan-300" aria-hidden="true" />
                  <p className="mt-2 text-[0.8rem] font-semibold text-white">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[0.68rem] leading-relaxed text-slate-500">
                    {step.text}
                  </p>
                  {index < WORKFLOW.length - 1 ? (
                    <ArrowRight
                      className="absolute -right-2.5 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-slate-700 sm:block"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Scope and safeguards"
          description="What the workspace will and will not do."
        >
          <ul className="space-y-2.5">
            {[
              {
                icon: WifiOff,
                text: "Submitted URLs and indicators are never visited, fetched, or resolved by the analyzer.",
                tone: "text-emerald-300",
              },
              {
                icon: FlaskConical,
                text: "Demo mode is fictional, clearly labelled, and kept out of your user history.",
                tone: "text-violet-300",
              },
              {
                icon: Lock,
                text: "Provider and integration credentials stay in server-side environment variables.",
                tone: "text-cyan-300",
              },
              {
                icon: ShieldQuestion,
                text: "No geolocation, WHOIS, DNS, or reputation result is invented when a provider is unavailable.",
                tone: "text-amber-300",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.text} className="flex gap-2.5">
                  <Icon
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.tone}`}
                    aria-hidden="true"
                  />
                  <span className="text-[0.76rem] leading-relaxed text-slate-400">
                    {item.text}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 border-t border-[#173450] pt-4">
            <DemoModeToggle compact />
          </div>
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="panel panel-interactive group flex items-start gap-3 p-4"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06]">
                <Icon className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[0.82rem] font-semibold text-white">{action.title}</p>
                <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-500">
                  {action.description}
                </p>
              </div>
              <ArrowRight
                className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-300"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>

      <div className="mt-5">
        <SectionCard
          title="Recent analyses"
          description="Your browser-local records, newest first. Demo data is excluded from these counts."
          actions={
            <Link href="/history" className="btn btn-secondary text-[0.75rem]">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              View history
            </Link>
          }
        >
          <RecordTable
            records={userRecords.slice(0, 5)}
            empty={
              <EmptyState
                icon={ScanLine}
                title="No analyses on this device yet"
                description="Run a URL, IP, or domain analysis. The resulting snapshot will be saved in this browser and can be exported as a report."
                action={
                  <>
                    <Link href="/analyzer" className="btn btn-primary">
                      <Link2 className="h-4 w-4" aria-hidden="true" />
                      Analyze a URL
                    </Link>
                    <Link href="/indicators" className="btn btn-secondary">
                      <Globe2 className="h-4 w-4" aria-hidden="true" />
                      Check an indicator
                    </Link>
                  </>
                }
              />
            }
          />
        </SectionCard>
      </div>

      <div className="mt-5 panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.8rem] font-semibold text-white">
            Optional live threat intelligence
          </p>
          <p className="mt-1 max-w-3xl text-[0.74rem] leading-relaxed text-slate-500">
            Live threat intelligence is optional and depends on server-side
            configuration. When no provider is configured, only local analysis is
            available. When one is configured, its result is displayed separately
            and never alters the local score.
          </p>
        </div>
        <Link href="/settings" className="btn btn-secondary shrink-0">
          View configuration
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
