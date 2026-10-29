import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "cyan",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: "cyan" | "rose" | "emerald" | "amber" | "slate";
}) {
  const tones = {
    cyan: "border-cyan-400/20 bg-cyan-400/[0.055] text-cyan-300",
    rose: "border-rose-400/20 bg-rose-400/[0.055] text-rose-300",
    emerald: "border-emerald-400/20 bg-emerald-400/[0.055] text-emerald-300",
    amber: "border-amber-400/20 bg-amber-400/[0.055] text-amber-300",
    slate: "border-slate-500/20 bg-slate-500/[0.055] text-slate-300",
  } as const;

  return (
    <div className="panel panel-interactive p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </p>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${tones[tone]}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="tabular mt-2.5 text-[1.65rem] font-bold leading-none text-white">
        {value}
      </p>
      <p className="mt-2 text-[0.72rem] leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}
