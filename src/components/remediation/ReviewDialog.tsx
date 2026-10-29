"use client";

import { Flag, X } from "lucide-react";
import { useEffect, useState } from "react";

export function ReviewDialog({
  open,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

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
        aria-label="Close review dialog"
        className="absolute inset-0 bg-[#02060d]/80 backdrop-blur-sm"
        onClick={() => {
          if (!pending) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className="panel-strong relative w-full max-w-lg p-5"
      >
        <button
          type="button"
          className="btn btn-ghost absolute right-2 top-2 px-2"
          onClick={onCancel}
          disabled={pending}
          aria-label="Close review dialog"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-violet-400/30 bg-violet-400/[0.08]">
            <Flag className="h-4 w-4 text-violet-300" aria-hidden="true" />
          </span>
          <div>
            <h2 id="review-title" className="text-sm font-semibold text-white">
              Request a false-positive review
            </h2>
            <p className="mt-1.5 text-[0.78rem] leading-relaxed text-slate-400">
              This records a review request and moves the case to
              FALSE_POSITIVE_PENDING_REVIEW. It does not override the detection
              or mark the indicator safe. A human reviewer must assess it.
            </p>
          </div>
        </div>

        <label htmlFor="review-reason" className="field-label mt-4">
          Reason (optional, max 500 characters)
        </label>
        <textarea
          id="review-reason"
          className="input-field min-h-[104px] resize-y text-[0.82rem]"
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder="For example: this domain is owned by our organization and used for an approved campaign."
          disabled={pending}
        />
        <p className="mt-1 text-right text-[0.68rem] text-slate-600">
          {reason.length}/500
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onConfirm(reason.trim())}
            disabled={pending}
          >
            {pending ? "Recording…" : "Record review request"}
          </button>
        </div>
      </div>
    </div>
  );
}
