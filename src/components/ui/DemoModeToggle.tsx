"use client";

import { FlaskConical } from "lucide-react";
import { useDemoMode } from "@/lib/client/useAnalysisData";

export function DemoModeToggle({ compact = false }: { compact?: boolean }) {
  const [enabled, setEnabled] = useDemoMode();

  return (
    <div
      className={
        compact
          ? "flex items-center gap-3"
          : "panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-violet-400/25 bg-violet-400/[0.07]">
          <FlaskConical className="h-4 w-4 text-violet-300" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">DEMO DATA</p>
          <p className="mt-1 max-w-xl text-[0.75rem] leading-relaxed text-slate-500">
            Show six fictional example records using reserved example domains and
            documentation IP ranges. Demo records are never merged into your
            browser-local history.
          </p>
        </div>
      </div>
      <label className="relative inline-flex shrink-0 cursor-pointer items-center gap-2 self-start sm:self-auto">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span className="h-6 w-11 rounded-full border border-slate-600 bg-slate-800 transition-colors peer-checked:border-cyan-400/50 peer-checked:bg-cyan-500/30" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-slate-400 transition-transform peer-checked:translate-x-5 peer-checked:bg-cyan-300" />
        <span className="text-[0.72rem] font-semibold text-slate-400">
          {enabled ? "On" : "Off"}
        </span>
      </label>
    </div>
  );
}
