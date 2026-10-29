import { Suspense } from "react";
import { RemediationWorkspace } from "./RemediationWorkspace";

function RemediationFallback() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="panel px-5 py-6">
        <p className="mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
          Loading remediation workspace
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Reading the analysis selection from the current URL.
        </p>
      </div>
    </div>
  );
}

export default function RemediationPage() {
  return (
    <Suspense fallback={<RemediationFallback />}>
      <RemediationWorkspace />
    </Suspense>
  );
}
