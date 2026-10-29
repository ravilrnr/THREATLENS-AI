import type { LucideIcon } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3.5">
        {Icon ? (
          <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/[0.07]">
            <Icon className="h-5 w-5 text-cyan-300" aria-hidden="true" />
          </span>
        ) : null}
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-[1.7rem]">
            {title}
          </h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400">
            {description}
          </p>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
