"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect } from "react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-[#02060d]/80 backdrop-blur-sm"
        onClick={() => {
          if (!pending) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="panel-strong relative w-full max-w-md p-5"
      >
        <button
          type="button"
          className="btn btn-ghost absolute right-2 top-2 px-2"
          onClick={onCancel}
          disabled={pending}
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex items-start gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
              tone === "danger"
                ? "border-rose-400/30 bg-rose-500/[0.08]"
                : "border-cyan-400/30 bg-cyan-400/[0.08]"
            }`}
          >
            <AlertTriangle
              className={`h-4 w-4 ${
                tone === "danger" ? "text-rose-300" : "text-cyan-300"
              }`}
              aria-hidden="true"
            />
          </span>
          <div>
            <h2 id="confirm-title" className="text-sm font-semibold text-white">
              {title}
            </h2>
            <p
              id="confirm-description"
              className="mt-1.5 text-[0.8rem] leading-relaxed text-slate-400"
            >
              {description}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
            disabled={pending}
            autoFocus
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
