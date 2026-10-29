import { Suspense } from "react";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportDetail } from "./ReportDetail";

function ReportFallback() {
  return (
    <>
      <PageHeader
        eyebrow="Report / evidence snapshot"
        title="Loading report"
        description="Resolving the report identifier for this request."
        icon={FileText}
      />
      <div className="panel px-5 py-6" aria-busy="true" aria-live="polite">
        <p className="mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
          Preparing report
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Reading the report ID from the current route.
        </p>
      </div>
    </>
  );
}

async function ReportDetailLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  const id = typeof resolved.id === "string" ? resolved.id : "";
  return <ReportDetail id={id} />;
}

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ReportFallback />}>
      <ReportDetailLoader params={params} />
    </Suspense>
  );
}
