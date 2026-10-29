import Link from "next/link";
import { FileText, ShieldCheck, Trash2 } from "lucide-react";
import {
  DemoBadge,
  SeverityBadge,
  StateBadge,
  VerificationBadge,
} from "@/components/ui/badges";
import { formatUtc, shortIndicator } from "@/lib/format";
import { STATE_LABELS } from "@/lib/remediation/stateMachine";
import type { AnalysisRecord } from "@/types";

const TYPE_LABEL: Record<AnalysisRecord["indicatorType"], string> = {
  url: "URL",
  ipv4: "IPv4",
  domain: "Domain",
};

export function RecordTable({
  records,
  onDelete,
  empty,
}: {
  records: AnalysisRecord[];
  onDelete?: (record: AnalysisRecord) => void;
  empty?: React.ReactNode;
}) {
  if (records.length === 0) {
    return <>{empty ?? null}</>;
  }

  return (
    <div className="table-shell">
      <table className="data-table">
        <caption className="sr-only">Analysis records</caption>
        <thead>
          <tr>
            <th scope="col">Risk</th>
            <th scope="col">Indicator</th>
            <th scope="col">State</th>
            <th scope="col">Verification</th>
            <th scope="col">Created</th>
            <th scope="col" className="text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={record.severity} />
                  <span className="tabular text-[0.74rem] font-semibold text-slate-400">
                    {record.score}
                  </span>
                </div>
              </td>
              <td className="max-w-[360px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mono break-all text-[0.75rem] text-slate-200">
                    {shortIndicator(record.normalized, 64)}
                  </span>
                  {record.demo ? <DemoBadge /> : null}
                </div>
                <p className="mt-1 text-[0.65rem] text-slate-600">
                  {TYPE_LABEL[record.indicatorType]} · {record.findings.length} findings
                </p>
              </td>
              <td>
                <StateBadge state={record.state} label={STATE_LABELS[record.state]} />
              </td>
              <td>
                {record.verification ? (
                  <VerificationBadge status={record.verification.status} />
                ) : (
                  <span className="text-[0.72rem] text-slate-600">Not run</span>
                )}
              </td>
              <td className="whitespace-nowrap text-[0.72rem] text-slate-500">
                {formatUtc(record.createdAt)}
              </td>
              <td>
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/reports/${encodeURIComponent(record.id)}`}
                    className="btn btn-ghost px-2 py-1.5 text-[0.7rem]"
                    title="View report"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    Report
                  </Link>
                  {record.demo ? null : (
                    <Link
                      href={`/remediation?id=${encodeURIComponent(record.id)}`}
                      className="btn btn-ghost px-2 py-1.5 text-[0.7rem]"
                      title="Open remediation workspace"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Remediate
                    </Link>
                  )}
                  {onDelete && !record.demo ? (
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-1.5 text-[0.7rem] text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                      onClick={() => onDelete(record)}
                      title="Delete from browser-local history"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">Delete</span>
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
