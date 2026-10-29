export function SectionCard({
  title,
  description,
  actions,
  children,
  className = "",
  id,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`panel p-5 ${className}`} id={id}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-white">{title}</h3>
          {description ? (
            <p className="mt-1 max-w-2xl text-[0.78rem] leading-relaxed text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
