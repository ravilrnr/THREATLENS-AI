"use client";

import { Check, CircleDashed, Loader2, Minus, X } from "lucide-react";
import { ChecklistBadge } from "@/components/ui/badges";
import { formatUtc } from "@/lib/format";
import type { ChecklistItem, ChecklistStatus } from "@/types";

const CATEGORY_LABEL: Record<ChecklistItem["category"], string> = {
  contain: "Contain",
  report: "Report",
  credential: "Credentials",
  technical: "Technical",
  review: "Review",
};

const STATUS_OPTIONS: Array<{
  status: ChecklistStatus;
  label: string;
  icon: typeof Check;
}> = [
  { status: "in_progress", label: "Start", icon: Loader2 },
  { status: "completed", label: "Complete", icon: Check },
  { status: "failed", label: "Failed", icon: X },
];

export function ChecklistPanel({
  items,
  onUpdate,
  pendingItemId,
  disabled = false,
}: {
  items: ChecklistItem[];
  onUpdate?: (itemId: string, status: ChecklistStatus) => void;
  pendingItemId?: string | null;
  disabled?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-[0.8rem] text-slate-500">
        No remediation checklist has been generated for this record.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pending = pendingItemId === item.id;
        return (
          <div
            key={item.id}
            className="rounded-xl border border-[#1b3a5c] bg-[#06101f]/50 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip border-slate-500/25 bg-slate-500/[0.06] text-slate-400">
                    {CATEGORY_LABEL[item.category]}
                  </span>
                  {item.requiresIntegration ? (
                    <span className="chip border-amber-400/25 bg-amber-400/[0.06] text-amber-200">
                      Integration required
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[0.85rem] font-semibold text-slate-100">
                  {item.title}
                </p>
                <p className="mt-1 text-[0.77rem] leading-relaxed text-slate-400">
                  {item.description}
                </p>
                {item.updatedAt ? (
                  <p className="mono mt-2 text-[0.64rem] text-slate-600">
                    Updated {formatUtc(item.updatedAt)}
                  </p>
                ) : null}
              </div>
              <ChecklistBadge status={item.status} />
            </div>

            {onUpdate ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#173450] pt-3">
                {STATUS_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.status}
                      type="button"
                      className={`btn text-[0.72rem] ${
                        item.status === option.status
                          ? "btn-primary"
                          : "btn-secondary"
                      }`}
                      disabled={disabled || pending || item.status === option.status}
                      onClick={() => onUpdate(item.id, option.status)}
                    >
                      {pending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {option.label}
                    </button>
                  );
                })}
                {item.status !== "recommended" ? (
                  <button
                    type="button"
                    className="btn btn-ghost text-[0.72rem]"
                    disabled={disabled || pending}
                    onClick={() => onUpdate(item.id, "recommended")}
                  >
                    <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
                    Reset
                  </button>
                ) : null}
                <span className="ml-auto flex items-center gap-1.5 text-[0.66rem] text-slate-600">
                  <Minus className="h-3 w-3" aria-hidden="true" />
                  User-reported status, not independent verification
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
