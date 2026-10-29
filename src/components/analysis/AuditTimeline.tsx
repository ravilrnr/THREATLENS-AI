import { formatUtc, humanizeToken } from "@/lib/format";
import type { AuditEvent } from "@/types";

const RESULT_DOT: Record<AuditEvent["result"], string> = {
  success: "bg-emerald-400",
  failure: "bg-rose-400",
  info: "bg-cyan-400",
};

const RESULT_TEXT: Record<AuditEvent["result"], string> = {
  success: "text-emerald-300",
  failure: "text-rose-300",
  info: "text-cyan-300",
};

export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return <p className="text-[0.8rem] text-slate-500">No audit events recorded.</p>;
  }

  return (
    <ol className="relative max-h-[540px] space-y-0 overflow-y-auto pr-1">
      {events.map((event, index) => (
        <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
          <div className="relative flex w-4 shrink-0 justify-center">
            {index !== events.length - 1 ? (
              <span className="absolute top-3 h-full w-px bg-[#173450]" />
            ) : null}
            <span
              className={`relative mt-1.5 h-2 w-2 rounded-full ring-4 ring-[#06101f] ${RESULT_DOT[event.result]}`}
            />
          </div>
          <div className="min-w-0 flex-1 rounded-lg border border-[#173450] bg-[#06101f]/45 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.74rem] font-semibold text-slate-200">
                {humanizeToken(event.type)}
              </p>
              <span className={`mono text-[0.6rem] uppercase tracking-[0.1em] ${RESULT_TEXT[event.result]}`}>
                {event.result}
              </span>
            </div>
            <p className="mt-1 break-words text-[0.74rem] leading-relaxed text-slate-400">
              {event.message}
            </p>
            <p className="mono mt-1.5 text-[0.6rem] text-slate-600">
              {formatUtc(event.at)}
            </p>
            {event.metadata ? (
              <details className="mt-1.5">
                <summary className="text-[0.62rem] text-slate-600">Event metadata</summary>
                <pre className="mono mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-[#030a14] p-2 text-[0.62rem] text-slate-500">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
