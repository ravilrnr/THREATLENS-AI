import {
  CheckCircle2,
  CircleAlert,
  Info,
  TriangleAlert,
  XCircle,
} from "lucide-react";

export type AlertTone = "info" | "success" | "warning" | "danger" | "demo";

const TONES: Record<
  AlertTone,
  { wrapper: string; icon: typeof Info; iconClass: string }
> = {
  info: {
    wrapper: "border-cyan-400/25 bg-cyan-400/[0.05] text-cyan-50",
    icon: Info,
    iconClass: "text-cyan-300",
  },
  success: {
    wrapper: "border-emerald-400/25 bg-emerald-400/[0.05] text-emerald-50",
    icon: CheckCircle2,
    iconClass: "text-emerald-300",
  },
  warning: {
    wrapper: "border-amber-400/25 bg-amber-400/[0.05] text-amber-50",
    icon: TriangleAlert,
    iconClass: "text-amber-300",
  },
  danger: {
    wrapper: "border-rose-400/30 bg-rose-500/[0.06] text-rose-50",
    icon: XCircle,
    iconClass: "text-rose-300",
  },
  demo: {
    wrapper: "border-violet-400/25 bg-violet-400/[0.05] text-violet-50",
    icon: CircleAlert,
    iconClass: "text-violet-300",
  },
};

export function InlineAlert({
  tone = "info",
  title,
  children,
  className = "",
}: {
  tone?: AlertTone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const config = TONES[tone];
  const Icon = config.icon;
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${config.wrapper} ${className}`}
      role={tone === "danger" ? "alert" : undefined}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.iconClass}`} aria-hidden="true" />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? "mt-1 text-[0.84rem]" : "text-[0.84rem]"}>{children}</div>
      </div>
    </div>
  );
}
