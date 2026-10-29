"use client";

import { Check, Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DownloadResult } from "@/lib/client/download";

export function ExportButton({
  onExport,
  label = "Export JSON",
  className = "btn btn-secondary",
}: {
  onExport: () => DownloadResult;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const run = () => {
    const result = onExport();
    setState(result.ok ? "done" : "failed");
    setMessage(result.message ?? null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setState("idle");
      setMessage(null);
    }, 4000);
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={className} onClick={run}>
        {state === "done" ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : state === "failed" ? (
          <X className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
        {state === "done" ? "Downloaded" : state === "failed" ? "Export failed" : label}
      </button>
      {message ? (
        <span
          className={`max-w-[240px] text-[0.68rem] leading-snug ${
            state === "failed" ? "text-rose-300" : "text-emerald-300"
          }`}
          role="status"
        >
          {message}
        </span>
      ) : null}
    </span>
  );
}
