import { ChevronDown, Plus } from "lucide-react";
import { SeverityBadge } from "@/components/ui/badges";
import type { Finding } from "@/types";

const CONFIDENCE_LABEL = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
} as const;

export function FindingsList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return (
      <div className="rounded-xl border border-[#1b3a5c] bg-[#06101f]/70 px-4 py-6 text-center">
        <p className="text-sm font-medium text-slate-300">
          No scored findings were produced.
        </p>
        <p className="mt-1 text-[0.78rem] text-slate-500">
          That does not prove the indicator is safe. It only means the local
          rules did not match observable characteristics.
        </p>
      </div>
    );
  }

  const sorted = [...findings].sort(
    (a, b) => b.scoreContribution - a.scoreContribution,
  );

  return (
    <div className="space-y-2.5">
      {sorted.map((finding) => (
        <details
          key={finding.id}
          className="group rounded-xl border border-[#1b3a5c] bg-[#06101f]/55 open:border-cyan-400/25"
        >
          <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
            <SeverityBadge severity={finding.severity} />
            <span className="min-w-0 flex-1 text-[0.84rem] font-medium text-slate-200">
              {finding.title}
            </span>
            <span
              className={`mono shrink-0 rounded-md border px-1.5 py-0.5 text-[0.66rem] font-semibold ${
                finding.scoreContribution > 0
                  ? "border-amber-400/25 bg-amber-400/[0.07] text-amber-200"
                  : "border-slate-500/25 bg-slate-500/[0.07] text-slate-400"
              }`}
              title="Points this finding contributes to the local score"
            >
              <Plus className="mr-0.5 inline h-3 w-3" aria-hidden="true" />
              {finding.scoreContribution} pts
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="grid gap-4 border-t border-[#173450] px-4 py-4 text-[0.8rem] leading-relaxed sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-500">
                Observed evidence
              </p>
              <p className="mono mt-1 break-all rounded-lg border border-[#173450] bg-[#030a14]/80 px-3 py-2 text-[0.74rem] text-cyan-100/90">
                {finding.evidence}
              </p>
            </div>
            <div>
              <p className="mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-500">
                Why it matters
              </p>
              <p className="mt-1 text-slate-400">{finding.explanation}</p>
            </div>
            <div>
              <p className="mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-500">
                Potential impact
              </p>
              <p className="mt-1 text-slate-400">{finding.impact}</p>
            </div>
            <div>
              <p className="mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-500">
                Recommended action
              </p>
              <p className="mt-1 text-slate-300">{finding.recommendation}</p>
            </div>
            <div className="space-y-1.5">
              <p className="mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-500">
                Finding metadata
              </p>
              <p className="text-slate-400">
                {CONFIDENCE_LABEL[finding.confidence]} · category: {finding.category}
              </p>
              <p className="mono text-[0.66rem] text-slate-600">
                rule id: {finding.id} · score contribution: {finding.scoreContribution}
              </p>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
