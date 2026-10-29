import { Ban, CircleCheck, CircleOff, Timer } from "lucide-react";
import { formatUtc } from "@/lib/format";
import type { ActionStatus, RemediationAction } from "@/types";

const STATUS_STYLE: Record<
  ActionStatus,
  { label: string; className: string; icon: typeof Ban }
> = {
  success: {
    label: "Integration reported success",
    className: "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-200",
    icon: CircleCheck,
  },
  failed: {
    label: "Action failed",
    className: "border-rose-400/30 bg-rose-500/[0.07] text-rose-200",
    icon: Ban,
  },
  not_configured: {
    label: "Not configured",
    className: "border-slate-500/30 bg-slate-500/[0.07] text-slate-300",
    icon: CircleOff,
  },
  timeout: {
    label: "Integration timed out",
    className: "border-amber-400/30 bg-amber-400/[0.07] text-amber-200",
    icon: Timer,
  },
};

export function ActionHistory({ actions }: { actions: RemediationAction[] }) {
  if (actions.length === 0) {
    return (
      <p className="text-[0.8rem] text-slate-500">
        No controlled action has been requested for this record. Recommendations
        alone do not block anything.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {actions.map((action) => {
        const style = STATUS_STYLE[action.status];
        const Icon = style.icon;
        return (
          <div
            key={action.id}
            className="rounded-xl border border-[#1b3a5c] bg-[#06101f]/50 p-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <p className="text-[0.8rem] font-semibold text-slate-200">
                  {action.integrationName}
                </p>
              </div>
              <span className={`chip ${style.className}`}>{style.label}</span>
            </div>
            <p className="mt-2 break-words text-[0.76rem] leading-relaxed text-slate-400">
              {action.message}
            </p>
            <p className="mono mt-2 text-[0.62rem] text-slate-600">
              Requested {formatUtc(action.requestedAt)} · completed{" "}
              {formatUtc(action.completedAt)} · explicit confirmation recorded
            </p>
          </div>
        );
      })}
    </div>
  );
}
