"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Globe2,
  History,
  LayoutDashboard,
  Link2,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/analyzer", label: "URL Analyzer", icon: Link2 },
  { href: "/indicators", label: "IP & Domain Analyzer", icon: Globe2 },
  { href: "/remediation", label: "Threat Remediation", icon: ShieldCheck },
  { href: "/history", label: "Analysis History", icon: History },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings / Integrations", icon: Settings },
] as const;

const PAGE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/analyzer": "URL Analyzer",
  "/indicators": "IP & Domain Analyzer",
  "/remediation": "Threat Remediation",
  "/history": "Analysis History",
  "/reports": "Reports",
  "/settings": "Settings / Integrations",
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The pathname read lives in this small leaf so a Suspense boundary can isolate
 * it. Dynamic routes such as /reports/[id] do not otherwise provide a pathname
 * during prerendering under Cache Components.
 */
function NavList({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="mt-5 flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[0.845rem] font-medium transition-colors ${
              active
                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                : "border-transparent text-slate-400 hover:border-slate-700/70 hover:bg-slate-800/40 hover:text-slate-100"
            }`}
          >
            <Icon
              className={`h-[18px] w-[18px] shrink-0 ${
                active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"
              }`}
              aria-hidden="true"
            />
            <span>{item.label}</span>
            {active ? (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" aria-hidden="true" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function PageTitle() {
  const pathname = usePathname();
  return (
    <h1 className="truncate text-sm font-semibold text-slate-100">
      {PAGE_TITLES[pathname] ?? "ThreatLens AI"}
    </h1>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-[#02060d]/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        id="sidebar"
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col border-r border-[#12304d] bg-[#050e1b]/98 backdrop-blur-xl transition-transform duration-200 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="group flex items-center gap-3" aria-label="ThreatLens AI home">
            <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
              <ShieldCheck className="h-5 w-5 text-cyan-300" aria-hidden="true" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan-300" />
            </span>
            <span>
              <span className="block text-[0.95rem] font-bold tracking-tight text-white">
                ThreatLens <span className="text-cyan-300">AI</span>
              </span>
              <span className="mono block text-[0.6rem] uppercase tracking-[0.22em] text-slate-500">
                Local SOC workspace
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="btn btn-ghost px-2 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4">
          <div className="flex items-center gap-2 rounded-lg border border-cyan-400/15 bg-cyan-400/[0.04] px-3 py-2">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-cyan-300" />
            <span className="mono text-[0.62rem] uppercase tracking-[0.16em] text-cyan-200/80">
              Heuristic engine online
            </span>
          </div>
        </div>

        <Suspense fallback={<div className="mt-5 flex-1 px-3 pb-4" aria-hidden="true" />}>
          <NavList onNavigate={() => setMobileOpen(false)} />
        </Suspense>

        <div className="border-t border-[#12304d] p-4">
          <div className="rounded-xl border border-[#173a5c] bg-[#071527] p-3">
            <p className="mono text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">
              Analysis scope
            </p>
            <p className="mt-1.5 text-[0.72rem] leading-relaxed text-slate-400">
              Local heuristics only. ThreatLens never visits submitted URLs.
            </p>
          </div>
          <p className="mt-3 flex items-center justify-between px-1 text-[0.65rem] text-slate-600">
            <span>v1.0.0</span>
            <span className="mono">DETECT → VERIFY</span>
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[#12304d]/80 bg-[#040a14]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <button
              type="button"
              className="btn btn-secondary px-2.5 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              aria-controls="sidebar"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="mono text-[0.58rem] uppercase tracking-[0.2em] text-slate-500">
                ThreatLens AI / Workspace
              </p>
              <Suspense
                fallback={
                  <h1 className="truncate text-sm font-semibold text-slate-100">
                    ThreatLens AI
                  </h1>
                }
              >
                <PageTitle />
              </Suspense>
            </div>
            <div className="ml-auto hidden items-center gap-2 sm:flex">
              <span className="chip border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
                No auto-fetch
              </span>
              <span className="chip text-slate-400">Local-first</span>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>

        <footer className="border-t border-[#12304d]/70 px-4 py-5 text-[0.7rem] text-slate-600 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Local heuristic analysis. Not a malware verdict or a guarantee of safety.
            </p>
            <p className="mono">Browser storage stays on this device.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
