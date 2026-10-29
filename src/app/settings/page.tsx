"use client";

import {
  CheckCircle2,
  Database,
  EyeOff,
  FlaskConical,
  KeyRound,
  Loader2,
  Lock,
  PlugZap,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  ShieldQuestion,
  Timer,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DemoModeToggle } from "@/components/ui/DemoModeToggle";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { SectionCard } from "@/components/ui/SectionCard";
import { IntegrationBadge } from "@/components/ui/badges";
import { apiRequest } from "@/lib/client/api";
import type { SystemStatus } from "@/types";

const ENV_VARS = [
  {
    name: "THREAT_INTEL_PROVIDER",
    example: "generic",
    description:
      "Enables the built-in generic provider adapter. Leave unset to keep live threat intelligence disabled.",
  },
  {
    name: "THREAT_INTEL_API_URL",
    example: "https://intel.example.com/lookup",
    description:
      "HTTPS endpoint that accepts the documented POST contract. Must be on the hostname allowlist.",
  },
  {
    name: "THREAT_INTEL_API_KEY",
    example: "server-side-secret",
    description:
      "Optional bearer token. Sent only from the server; never returned to the browser.",
  },
  {
    name: "THREAT_INTEL_ALLOWED_HOSTS",
    example: "intel.example.com",
    description:
      "Comma-separated hostname allowlist. DNS is resolved and private/reserved addresses are blocked.",
  },
  {
    name: "THREAT_INTEL_NAME",
    example: "Example Threat Intelligence",
    description: "Display name shown in provider results.",
  },
  {
    name: "BLOCK_INTEGRATION_URL",
    example: "https://gateway.example.com/block",
    description:
      "HTTPS webhook for controlled block and status actions. Leave unset to keep actions Not Configured.",
  },
  {
    name: "BLOCK_INTEGRATION_TOKEN",
    example: "least-privilege-token",
    description:
      "Bearer token for the integration. Required whenever the integration URL is configured.",
  },
  {
    name: "BLOCK_INTEGRATION_ALLOWED_HOSTS",
    example: "gateway.example.com",
    description: "Comma-separated allowlist for the remediation integration hostname.",
  },
  {
    name: "BLOCK_INTEGRATION_NAME",
    example: "Example Security Gateway",
    description: "Display name shown on integration actions.",
  },
  {
    name: "THREATLENS_ALLOWED_ORIGIN",
    example: "https://threatlens.example.com",
    description:
      "Optional comma-separated extra origins permitted to call state-changing remediation routes.",
  },
] as const;

function BehaviorRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-[#173450] bg-[#06101f]/45 px-3.5 py-3">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
      )}
      <div>
        <p className="text-[0.8rem] font-medium text-slate-200">{label}</p>
        <p className="mt-0.5 text-[0.72rem] leading-relaxed text-slate-500">{detail}</p>
      </div>
    </li>
  );
}

export default function SettingsPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    const response = await apiRequest<SystemStatus>("/api/status");
    if (response.ok) {
      setStatus(response.data);
    } else {
      setError(response.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    apiRequest<SystemStatus>("/api/status").then((response) => {
      if (cancelled) return;
      if (response.ok) {
        setStatus(response.data);
        setError(null);
      } else {
        setError(response.message);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Configuration and scope"
        title="Settings / Integrations"
        description="Inspect server-side configuration without exposing secrets. Provider and remediation integrations are optional; when they are unconfigured, ThreatLens states that clearly instead of simulating a result."
        icon={Settings}
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadStatus}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh status
          </button>
        }
      />

      {error ? (
        <InlineAlert tone="danger" title="Configuration status unavailable" className="mb-4">
          {error} No configuration claims are assumed while the status cannot be
          read.
        </InlineAlert>
      ) : null}

      {loading && !status ? (
        <div className="panel flex items-center justify-center gap-3 p-10 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Reading safe configuration status…
        </div>
      ) : null}

      {status ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="panel p-4">
              <div className="flex items-center justify-between">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Threat intel provider
                </p>
                <ShieldQuestion className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </div>
              <div className="mt-2">
                <IntegrationBadge configured={status.provider.configured} />
              </div>
              <p className="mt-2 text-[0.74rem] text-slate-300">
                {status.provider.name ?? "No provider configured"}
              </p>
              {status.provider.reason ? (
                <p className="mt-1 text-[0.68rem] leading-relaxed text-amber-200/80">
                  {status.provider.reason}
                </p>
              ) : null}
            </div>

            <div className="panel p-4">
              <div className="flex items-center justify-between">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Block integration
                </p>
                <PlugZap className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </div>
              <div className="mt-2">
                <IntegrationBadge configured={status.integration.configured} />
              </div>
              <p className="mt-2 text-[0.74rem] text-slate-300">
                {status.integration.name ?? "No integration configured"}
              </p>
              {status.integration.reason ? (
                <p className="mt-1 text-[0.68rem] leading-relaxed text-amber-200/80">
                  {status.integration.reason}
                </p>
              ) : null}
            </div>

            <div className="panel p-4">
              <div className="flex items-center justify-between">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Server store
                </p>
                <Server className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </div>
              <p className="tabular mt-2 text-lg font-bold text-white">
                {status.storage.count}{" "}
                <span className="text-[0.72rem] font-medium text-slate-500">
                  / {status.storage.max} records
                </span>
              </p>
              <p className="mt-1 text-[0.68rem] leading-relaxed text-slate-500">
                {status.storage.persistence}, {status.storage.scope}. TTL{" "}
                {status.storage.ttlHours} hours.
              </p>
            </div>

            <div className="panel p-4">
              <div className="flex items-center justify-between">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Browser history
                </p>
                <Database className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm font-semibold text-white">LocalStorage</p>
              <p className="mt-1 text-[0.68rem] leading-relaxed text-slate-500">
                Device and browser-profile scoped. Not a remote database. Demo
                records are kept separate.
              </p>
            </div>
          </div>

          {!status.provider.configured ? (
            <InlineAlert tone="warning" title="Live threat intelligence is unavailable">
              {status.providerUnavailableMessage}
            </InlineAlert>
          ) : null}

          {!status.integration.configured ? (
            <InlineAlert tone="info" title="Controlled block actions are Not Configured">
              No block integration is configured. The remediation workspace will
              show “Not Configured”, will not attempt an action, and verification
              cannot reach VERIFIED without a configured integration.
            </InlineAlert>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard
              title="Protective behaviour"
              description="Server-reported safeguards for this deployment."
            >
              <ul className="space-y-2.5">
                <BehaviorRow
                  ok={status.behavior.fetchesSubmittedIndicators === false}
                  label="Submitted indicators are never fetched"
                  detail="No URL, IP, or domain is visited, crawled, or followed during analysis. Redirects are not followed."
                />
                <BehaviorRow
                  ok={status.behavior.sendsUrlPathToProvider === false}
                  label="URL paths are not sent to the provider"
                  detail={`Provider query scope: ${status.behavior.providerQueryScope}.`}
                />
                <BehaviorRow
                  ok={status.behavior.demoModeIsBrowserLocal}
                  label="Demo mode is browser-local"
                  detail="Fictional records are never written into the user's browser-local history or server store."
                />
                <BehaviorRow
                  ok
                  label="Remediation transitions are server-enforced"
                  detail="A client cannot set VERIFIED directly. The verification service must record the required evidence first."
                />
              </ul>
            </SectionCard>

            <SectionCard
              title="Rate limits and storage"
              description="Process-local safeguards. A production deployment should add a shared limiter and durable storage."
            >
              <div className="space-y-2">
                {Object.entries(status.rateLimits).map(([category, limit]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between rounded-lg border border-[#173450] bg-[#06101f]/45 px-3.5 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-[0.76rem] text-slate-300">
                      <Timer className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                      {category}
                    </span>
                    <span className="tabular text-[0.76rem] font-semibold text-slate-200">
                      {limit} / minute
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-500">
                Server-session records: {status.storage.count}/{status.storage.max},
                expiring after {status.storage.ttlHours} hours. Browser history is
                separate and remains until you clear it.
              </p>
            </SectionCard>
          </div>

          <SectionCard
            title="Demo data"
            description="Illustrative records are optional and always labelled. They are never mixed into user history."
          >
            <DemoModeToggle />
          </SectionCard>

          <SectionCard
            title="External lookup disclosure"
            description="What would leave the server if optional integrations are configured."
          >
            <div className="flex items-start gap-3 rounded-xl border border-[#1b3a5c] bg-[#06101f]/55 p-4">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
              <p className="text-[0.78rem] leading-relaxed text-slate-300">
                {status.externalLookupsDisclosure}
              </p>
            </div>
            <p className="mt-3 text-[0.72rem] leading-relaxed text-slate-500">
              {status.disclaimer}
            </p>
          </SectionCard>

          <SectionCard
            title="Server environment variables"
            description="Set these in .env.local (server-side only) and restart the app. Never prefix secrets with NEXT_PUBLIC_."
            actions={
              <span className="chip border-amber-400/25 bg-amber-400/[0.06] text-amber-200">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Server-only
              </span>
            }
          >
            <div className="space-y-2.5">
              {ENV_VARS.map((entry) => (
                <div
                  key={entry.name}
                  className="rounded-xl border border-[#173450] bg-[#06101f]/45 p-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="mono text-[0.74rem] font-semibold text-cyan-200">
                      {entry.name}
                    </code>
                    <span className="chip text-slate-500">{entry.example}</span>
                  </div>
                  <p className="mt-1.5 text-[0.72rem] leading-relaxed text-slate-500">
                    {entry.description}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.7rem] text-slate-500">
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              The status API returns only booleans, display names, and safe reasons.
              Endpoints, tokens, and API keys never leave the server.
            </div>
          </SectionCard>

          <SectionCard
            title="Security limitations"
            description="This is a portfolio-grade local workspace, not a managed SOC platform."
          >
            <ul className="grid gap-2.5 md:grid-cols-2">
              {[
                "Heuristic analysis is not a malware verdict and cannot guarantee safety.",
                "No live reputation, geolocation, WHOIS, DNS, or certificate data is invented.",
                "Server-session storage is process-local and expires after 24 hours.",
                "Rate limiting is in-memory and does not protect a multi-instance deployment.",
                "Browser-local history is not encrypted; shared devices can read it.",
                "Optional provider and webhook contracts must be implemented by the operator.",
                "Verification is only as trustworthy as the configured integration's response.",
                "No SIEM, ticketing, or enterprise identity integration is included.",
              ].map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-[0.74rem] leading-relaxed text-slate-400"
                >
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-start gap-2 border-t border-[#173450] pt-3 text-[0.7rem] leading-relaxed text-slate-500">
              <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Never paste real credentials, provider keys, or confidential indicators
              into demo records, screenshots, issues, or exported reports you intend
              to publish.
            </div>
          </SectionCard>

          <div className="panel flex flex-col gap-2 p-4 text-[0.72rem] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2">
              <FlaskConical className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
              Demo mode is a browser-local presentation layer, not live intelligence.
            </p>
            <p className="mono">Blank integrations remain unconfigured by design.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
