import {
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  Info,
  MinusCircle,
  XCircle,
} from "lucide-react";
import { VerificationBadge } from "@/components/ui/badges";
import { formatUtc } from "@/lib/format";
import { VERIFICATION_LIMITATIONS } from "@/lib/verification";
import type { VerificationCheck, VerificationResult } from "@/types";

const CHECK_ICON: Record<
  VerificationCheck["status"],
  { icon: typeof Info; className: string }
> = {
  pass: { icon: CheckCircle2, className: "text-emerald-300" },
  fail: { icon: XCircle, className: "text-rose-300" },
  not_configured: { icon: MinusCircle, className: "text-slate-500" },
  error: { icon: CircleAlert, className: "text-amber-300" },
  info: { icon: CircleHelp, className: "text-sky-300" },
};

export function VerificationPanel({
  verification,
  actions,
}: {
  verification: VerificationResult | null;
  actions?: React.ReactNode;
}) {
  if (!verification) {
    return (
      <div className="rounded-xl border border-[#1b3a5c] bg-[#06101f]/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">Verification has not run</p>
          {actions}
        </div>
        <p className="mt-2 text-[0.78rem] leading-relaxed text-slate-500">
          A clean local rescan is not proof of remediation. Run verification after
          remediation; it will only record VERIFIED when a configured integration
          reports the indicator as blocked.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#1b3a5c] bg-[#06101f]/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge status={verification.status} />
            <span className="mono text-[0.66rem] text-slate-600">
              {formatUtc(verification.checkedAt)}
            </span>
          </div>
          {actions}
        </div>
        <p className="mt-3 text-[0.8rem] leading-relaxed text-slate-300">
          {verification.explanation}
        </p>
        {verification.freshAnalysis ? (
          <p className="mt-2 text-[0.72rem] text-slate-500">
            Fresh local rescan: {verification.freshAnalysis.score}/100 (
            {verification.freshAnalysis.severity}) at{" "}
            {formatUtc(verification.freshAnalysis.at)}.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        {verification.checks.map((check) => {
          const config = CHECK_ICON[check.status];
          const Icon = config.icon;
          return (
            <div
              key={check.id}
              className="flex items-start gap-3 rounded-lg border border-[#173450] bg-[#030a14]/50 px-3.5 py-3"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.className}`} aria-hidden="true" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[0.8rem] font-medium text-slate-200">
                    {check.label}
                  </p>
                  <span className="mono text-[0.6rem] uppercase tracking-[0.1em] text-slate-600">
                    {check.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-1 break-words text-[0.74rem] leading-relaxed text-slate-400">
                  {check.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <details className="rounded-lg border border-[#173450] bg-[#06101f]/40 px-3.5 py-2.5">
        <summary className="text-[0.72rem] font-medium text-slate-500">
          Verification limitations
        </summary>
        <ul className="mt-2 space-y-1.5">
          {VERIFICATION_LIMITATIONS.map((item) => (
            <li key={item} className="text-[0.72rem] leading-relaxed text-slate-500">
              {item}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
