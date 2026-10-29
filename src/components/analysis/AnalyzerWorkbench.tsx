"use client";

import Link from "next/link";
import {
  ArrowRight,
  FileText,
  FlaskConical,
  Globe2,
  Link2,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { useRef, useState } from "react";
import { AnalysisResultView } from "@/components/analysis/AnalysisResultView";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { apiRequest } from "@/lib/client/api";
import { addToLocalHistory } from "@/lib/persistence/localHistory";
import type { AnalysisRecord } from "@/types";

export interface AnalyzerExample {
  label: string;
  value: string;
}

export function AnalyzerWorkbench({
  mode,
  endpoint,
  fieldName,
  fieldLabel,
  placeholder,
  helpText,
  maxLength,
  examples,
  scopeNotes,
}: {
  mode: "url" | "indicator";
  endpoint: string;
  fieldName: "url" | "indicator";
  fieldLabel: string;
  placeholder: string;
  helpText: string;
  maxLength: number;
  examples: AnalyzerExample[];
  scopeNotes: string[];
}) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<AnalysisRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageNote, setStorageNote] = useState<string | null>(null);
  const [savedToHistory, setSavedToHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isUrl = mode === "url";
  const ModeIcon = isUrl ? Link2 : Globe2;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError(
        isUrl ? "Enter a URL to analyze." : "Enter an IPv4 address or domain name.",
      );
      inputRef.current?.focus();
      return;
    }
    if (trimmed.length > maxLength) {
      setError(`Input must be ${maxLength} characters or fewer.`);
      return;
    }

    setBusy(true);
    setError(null);
    setStorageNote(null);
    setSavedToHistory(false);
    setResult(null);

    const response = await apiRequest<AnalysisRecord>(endpoint, {
      method: "POST",
      body: JSON.stringify({ [fieldName]: trimmed }),
    });

    if (!response.ok) {
      setError(response.message);
      setBusy(false);
      return;
    }

    setResult(response.data);
    const stored = addToLocalHistory(response.data);
    setSavedToHistory(stored.ok);
    if (!stored.ok || stored.message) {
      setStorageNote(
        stored.message ??
          "This analysis is shown for this session but was not saved to browser history.",
      );
    }
    setBusy(false);
  }

  function applyExample(example: AnalyzerExample) {
    setValue(example.value);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-5">
      <section className="panel overflow-hidden">
        <div className="scan-grid border-b border-[#173450] px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-cyan-400/25 bg-cyan-400/[0.06] text-cyan-200">
              <ModeIcon className="h-3 w-3" aria-hidden="true" />
              {isUrl ? "URL analysis" : "Indicator analysis"}
            </span>
            <span className="chip border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-200">
              <WifiOff className="h-3 w-3" aria-hidden="true" />
              No auto-fetch
            </span>
            <span className="chip text-slate-400">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Deterministic local rules
            </span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-5">
          <label htmlFor={`${mode}-input`} className="field-label">
            {fieldLabel}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={inputRef}
              id={`${mode}-input`}
              name={fieldName}
              type="text"
              inputMode={isUrl ? "url" : "text"}
              autoComplete="off"
              spellCheck={false}
              maxLength={maxLength}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
              placeholder={placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${mode}-help`}
              className="input-field mono flex-1 text-[0.82rem]"
              disabled={busy}
            />
            <button type="submit" className="btn btn-primary sm:w-auto" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
              {busy ? "Analyzing…" : "Analyze locally"}
            </button>
          </div>
          <div
            id={`${mode}-help`}
            className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.72rem] text-slate-500"
          >
            <span>{helpText}</span>
            <span className="mono tabular text-slate-600">
              {value.length}/{maxLength}
            </span>
          </div>

          {error ? (
            <InlineAlert tone="danger" title="Analysis could not run" className="mt-4">
              {error}
            </InlineAlert>
          ) : null}

          <div className="mt-4 rounded-xl border border-[#173450] bg-[#030a14]/50 p-3.5">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
              <p className="text-[0.72rem] font-semibold text-slate-300">
                Example inputs (safe to use)
              </p>
            </div>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-slate-600">
              These examples use reserved example domains or documentation IP
              ranges. Selecting one only fills the form; nothing is submitted
              automatically.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example.value}
                  type="button"
                  className="chip border-slate-500/25 bg-slate-500/[0.05] text-slate-300 transition-colors hover:border-cyan-400/35 hover:text-cyan-200"
                  onClick={() => applyExample(example)}
                  disabled={busy}
                  title={example.value}
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-4 space-y-1.5">
            {scopeNotes.map((note) => (
              <li
                key={note}
                className="flex gap-2 text-[0.72rem] leading-relaxed text-slate-500"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                {note}
              </li>
            ))}
          </ul>
        </form>
      </section>

      {storageNote ? (
        <InlineAlert tone="warning" title="Browser history notice">
          {storageNote}
        </InlineAlert>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="eyebrow">Analysis complete</p>
              <p className="mt-1 text-sm text-slate-300">
                {savedToHistory
                  ? "This record was saved to browser-local history on this device."
                  : "This analysis is shown for this session only. It was not saved to browser-local history."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/remediation?id=${encodeURIComponent(result.id)}`} className="btn btn-primary">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Open remediation
              </Link>
              <Link href={`/reports/${encodeURIComponent(result.id)}`} className="btn btn-secondary">
                <FileText className="h-4 w-4" aria-hidden="true" />
                View report
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setResult(null);
                  setValue("");
                  setStorageNote(null);
                  setSavedToHistory(false);
                  inputRef.current?.focus();
                }}
              >
                New analysis
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <AnalysisResultView record={result} />
        </div>
      ) : null}
    </div>
  );
}
