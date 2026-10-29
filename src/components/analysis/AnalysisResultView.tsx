import {
  Activity,
  CircleAlert,
  FileWarning,
  Fingerprint,
  Info,
  Radar,
  ShieldAlert,
} from "lucide-react";
import { FindingsList } from "@/components/analysis/FindingsList";
import { ProviderPanel } from "@/components/analysis/ProviderPanel";
import { CopyButton } from "@/components/ui/CopyButton";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { SectionCard } from "@/components/ui/SectionCard";
import { SeverityBadge, StateBadge } from "@/components/ui/badges";
import { INDICATOR_LIMITATIONS } from "@/lib/analysis/indicator";
import { URL_LIMITATIONS } from "@/lib/validation/url";
import { formatUtc, shortIndicator } from "@/lib/format";
import { STATE_LABELS } from "@/lib/remediation/stateMachine";
import { severityLabel } from "@/lib/scoring";
import type { AnalysisRecord } from "@/types";

const TYPE_LABEL: Record<AnalysisRecord["indicatorType"], string> = {
  url: "URL",
  ipv4: "IPv4 address",
  domain: "Domain name",
};

const BAND_COPY = {
  low: {
    title: "Low heuristic risk",
    detail:
      "The local rules found few risk characteristics. This is not proof that the indicator is safe.",
    tone: "border-emerald-400/25 bg-emerald-400/[0.05] text-emerald-100",
    icon: Info,
  },
  medium: {
    title: "Medium heuristic risk",
    detail:
      "Several characteristics warrant caution. Verify the request through a separate, trusted channel before interacting with it.",
    tone: "border-amber-400/25 bg-amber-400/[0.05] text-amber-100",
    icon: CircleAlert,
  },
  high: {
    title: "High heuristic risk",
    detail:
      "Multiple strong risk characteristics were observed. Treat the indicator as untrusted until it is independently verified.",
    tone: "border-orange-400/30 bg-orange-400/[0.06] text-orange-100",
    icon: ShieldAlert,
  },
  critical: {
    title: "Critical heuristic risk",
    detail:
      "Strong impersonation, obfuscation, or credential-harvesting patterns were observed. Do not interact with the indicator. Follow the containment guidance and verify remediation with real evidence.",
    tone: "border-rose-400/35 bg-rose-500/[0.07] text-rose-100",
    icon: FileWarning,
  },
} as const;

export function AnalysisResultView({
  record,
  actions,
  showProvider = true,
}: {
  record: AnalysisRecord;
  actions?: React.ReactNode;
  showProvider?: boolean;
}) {
  const band = BAND_COPY[record.severity];
  const BandIcon = band.icon;
  const limitations =
    record.indicatorType === "url" ? URL_LIMITATIONS : INDICATOR_LIMITATIONS;
  const rawSum = record.findings.reduce(
    (total, finding) => total + finding.scoreContribution,
    0,
  );

  return (
    <div className="space-y-5">
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}

      <section className="panel overflow-hidden">
        <div className="scan-grid border-b border-[#173450] px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={record.severity} />
            <StateBadge state={record.state} label={STATE_LABELS[record.state]} />
            {record.demo ? (
              <span className="chip border-violet-400/30 bg-violet-400/10 text-violet-200">
                DEMO DATA
              </span>
            ) : null}
            <span className="chip text-slate-400">{TYPE_LABEL[record.indicatorType]}</span>
            <span className="chip text-slate-400">Local heuristic</span>
          </div>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex items-center gap-5">
            <ScoreRing score={record.score} severity={record.severity} />
            <div className="lg:hidden">
              <p className="text-sm font-semibold text-white">
                {severityLabel(record.severity)} risk
              </p>
              <p className="mt-1 text-[0.75rem] text-slate-500">
                Deterministic sum of the findings below.
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <p className="eyebrow">Analyzed indicator</p>
            <h3 className="mono mt-1.5 break-all text-[0.95rem] font-semibold leading-relaxed text-white">
              {record.input}
            </h3>
            {record.normalized !== record.input ? (
              <p className="mono mt-2 break-all text-[0.72rem] text-slate-500">
                Normalized: {record.normalized}
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 text-[0.74rem] sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-slate-500">Host</p>
                <p className="mono mt-0.5 break-all text-slate-300">
                  {record.host ?? "Not applicable"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Analyzed</p>
                <p className="mt-0.5 text-slate-300">{formatUtc(record.createdAt)}</p>
              </div>
              <div>
                <p className="text-slate-500">Findings</p>
                <p className="tabular mt-0.5 text-slate-300">
                  {record.findings.length} · {rawSum} raw points
                </p>
              </div>
              <div>
                <p className="text-slate-500">Provider verdict</p>
                <p className="mt-0.5 text-slate-300">
                  {record.provider?.verdict ?? "Not supplied"}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <CopyButton
                value={record.normalized}
                label="Copy indicator"
                className="btn btn-secondary text-[0.75rem]"
              />
              <CopyButton
                value={record.id}
                label="Copy record ID"
                className="btn btn-ghost text-[0.75rem]"
              />
              <span className="chip text-slate-500" title="Report identifier">
                <Fingerprint className="h-3 w-3" aria-hidden="true" />
                {shortIndicator(record.id, 28)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${band.tone}`}>
        <BandIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">{band.title}</p>
          <p className="mt-1 text-[0.8rem] leading-relaxed opacity-80">{band.detail}</p>
        </div>
      </div>

      <SectionCard
        title="Why this score"
        description={`The local score is the bounded sum of explicit finding contributions. Raw contributions total ${rawSum}; the recorded score is ${record.score}/100 after clamping.`}
        actions={
          <span className="chip border-cyan-400/25 bg-cyan-400/[0.06] text-cyan-200">
            <Activity className="h-3 w-3" aria-hidden="true" />
            Deterministic
          </span>
        }
      >
        <FindingsList findings={record.findings} />
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2">
        {showProvider ? (
          <SectionCard
            title="Threat intelligence provider"
            description="Optional server-side lookup, kept separate from the local score."
            actions={
              <span className="chip text-slate-500">
                <Radar className="h-3 w-3" aria-hidden="true" />
                Optional
              </span>
            }
          >
            <ProviderPanel provider={record.provider} />
          </SectionCard>
        ) : null}

        <SectionCard
          title="Limitations"
          description="What this analysis does not do. Read these before acting on the result."
        >
          <ul className="space-y-2.5">
            {limitations.map((item) => (
              <li key={item} className="flex gap-2.5 text-[0.78rem] leading-relaxed text-slate-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400/60" />
                {item}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
