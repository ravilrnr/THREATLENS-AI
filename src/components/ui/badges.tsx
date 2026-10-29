import type {
  ChecklistStatus,
  ProviderStatus,
  ProviderVerdict,
  RemediationState,
  RiskBand,
  Severity,
  VerificationStatus,
} from "@/types";

type Tone =
  | "slate"
  | "cyan"
  | "sky"
  | "emerald"
  | "amber"
  | "orange"
  | "rose"
  | "violet";

const TONES: Record<Tone, string> = {
  slate: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  cyan: "border-cyan-400/35 bg-cyan-400/10 text-cyan-200",
  sky: "border-sky-400/35 bg-sky-400/10 text-sky-200",
  emerald: "border-emerald-400/35 bg-emerald-400/10 text-emerald-200",
  amber: "border-amber-400/35 bg-amber-400/10 text-amber-200",
  orange: "border-orange-400/35 bg-orange-400/10 text-orange-200",
  rose: "border-rose-400/35 bg-rose-500/10 text-rose-200",
  violet: "border-violet-400/35 bg-violet-400/10 text-violet-200",
};

const SEVERITY_TONE: Record<Severity, Tone> = {
  info: "slate",
  low: "emerald",
  medium: "amber",
  high: "orange",
  critical: "rose",
};

const RISK_TONE: Record<RiskBand, Tone> = {
  low: "emerald",
  medium: "amber",
  high: "orange",
  critical: "rose",
};

const STATE_TONE: Record<RemediationState, Tone> = {
  DETECTED: "slate",
  UNDER_REVIEW: "sky",
  FIX_RECOMMENDED: "cyan",
  REMEDIATION_PENDING: "amber",
  REMEDIATED: "sky",
  VERIFIED: "emerald",
  VERIFICATION_FAILED: "rose",
  VERIFICATION_PENDING: "amber",
  FALSE_POSITIVE_PENDING_REVIEW: "violet",
  NOT_CONFIGURED: "slate",
};

const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  verified: "emerald",
  failed: "rose",
  pending: "amber",
  not_configured: "slate",
};

const PROVIDER_TONE: Record<ProviderStatus, Tone> = {
  not_configured: "slate",
  ok: "emerald",
  error: "rose",
  timeout: "amber",
  rate_limited: "amber",
  invalid_response: "rose",
};

const VERDICT_TONE: Record<ProviderVerdict, Tone> = {
  malicious: "rose",
  suspicious: "amber",
  clean: "emerald",
  unknown: "slate",
};

const CHECKLIST_TONE: Record<ChecklistStatus, Tone> = {
  recommended: "slate",
  in_progress: "amber",
  completed: "emerald",
  failed: "rose",
};

function Badge({
  children,
  tone,
  className = "",
  title,
}: {
  children: React.ReactNode;
  tone: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={`chip ${TONES[tone]} ${className}`}
      title={title}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: RiskBand | Severity;
  className?: string;
}) {
  const tone =
    severity in RISK_TONE
      ? RISK_TONE[severity as RiskBand]
      : SEVERITY_TONE[severity as Severity];
  const label = severity.charAt(0).toUpperCase() + severity.slice(1);
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}

export function StateBadge({
  state,
  label,
  className,
}: {
  state: RemediationState;
  label: string;
  className?: string;
}) {
  return (
    <Badge tone={STATE_TONE[state]} className={className} title={state}>
      {label}
    </Badge>
  );
}

export function VerificationBadge({
  status,
  className,
}: {
  status: VerificationStatus;
  className?: string;
}) {
  const labels: Record<VerificationStatus, string> = {
    verified: "Verified by integration",
    failed: "Verification failed",
    pending: "Verification pending",
    not_configured: "Not configured",
  };
  return (
    <Badge tone={VERIFICATION_TONE[status]} className={className}>
      {labels[status]}
    </Badge>
  );
}

export function ProviderBadge({
  status,
  verdict,
}: {
  status: ProviderStatus;
  verdict?: ProviderVerdict;
}) {
  if (verdict) {
    return <Badge tone={VERDICT_TONE[verdict]}>{verdict.toUpperCase()}</Badge>;
  }
  const labels: Record<ProviderStatus, string> = {
    not_configured: "Provider not configured",
    ok: "Provider checked",
    error: "Provider error",
    timeout: "Provider timeout",
    rate_limited: "Provider rate limited",
    invalid_response: "Invalid provider response",
  };
  return <Badge tone={PROVIDER_TONE[status]}>{labels[status]}</Badge>;
}

export function ChecklistBadge({ status }: { status: ChecklistStatus }) {
  return (
    <Badge tone={CHECKLIST_TONE[status]}>
      {status === "in_progress"
        ? "In progress"
        : status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <Badge
      tone="violet"
      className={className}
      title="Fictional illustrative data, kept separate from user history."
    >
      DEMO DATA
    </Badge>
  );
}

export function IntegrationBadge({ configured }: { configured: boolean }) {
  return (
    <Badge tone={configured ? "emerald" : "slate"}>
      {configured ? "Configured" : "Not Configured"}
    </Badge>
  );
}
