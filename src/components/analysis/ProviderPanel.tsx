import { PlugZap, ShieldQuestion } from "lucide-react";
import { ProviderBadge } from "@/components/ui/badges";
import { formatUtc } from "@/lib/format";
import type { ProviderSummary } from "@/types";

export function ProviderPanel({ provider }: { provider: ProviderSummary | null }) {
  if (!provider) {
    return (
      <div className="rounded-xl border border-[#1b3a5c] bg-[#06101f]/55 px-4 py-5">
        <div className="flex items-center gap-2 text-slate-300">
          <PlugZap className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <p className="text-sm font-semibold">No provider result recorded</p>
        </div>
        <p className="mt-2 text-[0.78rem] leading-relaxed text-slate-500">
          Live threat intelligence is unavailable. Only local analysis is available.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1b3a5c] bg-[#06101f]/55 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldQuestion className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-white">
            {provider.providerName ?? "Threat intelligence provider"}
          </p>
        </div>
        <ProviderBadge status={provider.status} verdict={provider.verdict} />
      </div>

      {provider.message ? (
        <p className="mt-2.5 text-[0.78rem] leading-relaxed text-slate-400">
          {provider.message}
        </p>
      ) : null}

      {provider.status === "ok" ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[0.74rem]">
          <div>
            <dt className="text-slate-500">Verdict</dt>
            <dd className="mt-0.5 font-medium text-slate-200">
              {provider.verdict ?? "unknown"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Provider score</dt>
            <dd className="tabular mt-0.5 font-medium text-slate-200">
              {typeof provider.score === "number" ? `${provider.score}/100` : "Not supplied"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Retrieved</dt>
            <dd className="mt-0.5 text-slate-300">{formatUtc(provider.retrievedAt)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Query scope</dt>
            <dd className="mt-0.5 text-slate-300">
              {provider.queryScope ?? "not recorded"}
            </dd>
          </div>
          {provider.tags?.length ? (
            <div className="col-span-2">
              <dt className="text-slate-500">Provider tags</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {provider.tags.map((tag) => (
                  <span key={tag} className="chip text-slate-300">
                    {tag}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
          {provider.reference ? (
            <div className="col-span-2">
              <dt className="text-slate-500">Reference</dt>
              <dd className="mono mt-1 break-all text-[0.7rem] text-slate-400">
                {provider.reference}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <p className="mt-3 border-t border-[#173450] pt-2.5 text-[0.7rem] leading-relaxed text-slate-600">
        Provider data is shown separately and is never blended into the local
        heuristic score. A provider result is not a guarantee of safety or a
        malware verdict from ThreatLens AI.
      </p>
    </div>
  );
}
