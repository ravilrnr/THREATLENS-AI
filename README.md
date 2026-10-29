# ThreatLens AI

**A local-first threat analysis and phishing triage workspace built with Next.js.**

ThreatLens AI follows a five-stage workflow — **DETECT → EXPLAIN → CORRECT → VERIFY → REPORT** — and keeps every claim tied to evidence that was actually recorded. It analyzes URLs, IPv4 addresses, and domains with deterministic local rules, explains every score contribution, guides remediation, and only reports **VERIFIED** when a configured integration confirms that an indicator is blocked.

> **Important:** despite the name, this application does **not** use an AI or LLM model. "AI" is product branding. Analysis is performed by explicit, deterministic heuristics that can be inspected in `src/lib/analysis/`.
>
> This is an educational and portfolio project, not a production SOC platform. It has no user accounts, no authentication, and no durable database by default. Read [Security model and limitations](#security-model-and-limitations) before exposing it to anyone.

---

## Contents

- [What it does](#what-it-does)
- [Feature overview](#feature-overview)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started on Windows (PowerShell)](#getting-started-on-windows-powershell)
- [Environment configuration](#environment-configuration)
- [Optional threat intelligence provider](#optional-threat-intelligence-provider)
- [Optional block integration](#optional-block-integration)
- [Demo mode](#demo-mode)
- [Using the workflow](#using-the-workflow)
- [API reference](#api-reference)
- [Remediation and verification rules](#remediation-and-verification-rules)
- [Data storage](#data-storage)
- [Testing and quality checks](#testing-and-quality-checks)
- [Troubleshooting](#troubleshooting)
- [Publishing to GitHub](#publishing-to-github)
- [Deployment](#deployment)
- [Security model and limitations](#security-model-and-limitations)
- [Project status](#project-status)

---

## What it does

ThreatLens AI is a SOC-style dashboard with seven views:

| View | Route | Purpose |
| --- | --- | --- |
| Overview | `/` | Counts, workflow summary, safeguards, recent analyses |
| URL Analyzer | `/analyzer` | Lexical/structural URL analysis without visiting the URL |
| IP & Domain Analyzer | `/indicators` | IPv4 and domain syntax/pattern analysis without DNS or WHOIS |
| Threat Remediation | `/remediation` | Checklist, controlled block action, false-positive review, verification |
| Analysis History | `/history` | Browser-local records, search/filter, demo toggle |
| Reports | `/reports`, `/reports/[id]` | Read-only evidence report and JSON export |
| Settings / Integrations | `/settings` | Safe configuration status, storage stats, rate limits, disclosures |

The product is built around a simple rule: **later stages must not claim evidence that earlier stages did not produce.**

- A local score is a heuristic risk indicator, not a malware verdict.
- A checklist marked complete is a user report, not independent verification.
- A clean rescan is not proof that an indicator is blocked.
- A provider verdict is displayed separately and never changes the local score.
- **VERIFIED** requires a configured integration to report the indicator as blocked.

---

## Feature overview

### URL Analyzer

- Accepts only `http://` and `https://` URLs (maximum 2,048 characters).
- Rejects missing schemes, spaces, control characters, non-HTTP(S) schemes, and malformed hosts.
- **Never visits, fetches, resolves, or follows redirects from the submitted URL.**
- Runs deterministic local checks for:
  - HTTP transport, raw IP hosts, embedded URL credentials, Punycode/non-ASCII hosts
  - excessive subdomains, long hostnames, hyphen/digit-heavy hosts, IP-like subdomains
  - long URLs, heavy percent-encoding, encoded schemes, encoded control bytes
  - non-standard ports, frequently abused TLDs, shorteners, brand-like hostnames
  - credential-themed hostnames, executable/archive downloads, double extensions
  - external redirect parameters, embedded `javascript:`/`data:`/`vbscript:` values
  - unusually high query-parameter counts
- Every finding includes title, severity, category, plain-language explanation, exact evidence, potential impact, confidence, recommendation, and **the exact points it adds to the score**.
- The score is the bounded sum of those explicit contributions:

| Band | Score | Meaning |
| --- | --- | --- |
| Low | 0–24 | Few weak signals |
| Medium | 25–49 | Multiple or stronger signals |
| High | 50–74 | Strong combination of signals |
| Critical | 75–100 | Very strong combination of signals |

- A low score is **not** a guarantee of safety. A high score is **not** proof of malicious intent.

### IP & Domain Analyzer

- Accepts IPv4 addresses and domain names (including IDNs that normalize to Punycode).
- Rejects URLs, IPv6 addresses, ports, paths, credentials, whitespace, and `localhost`.
- Classifies IPv4 scope (public, private, loopback, link-local, documentation, reserved, multicast) as **context**, not as maliciousness.
- Local domain checks include abused TLDs, Punycode, brand-like names, hyphen-heavy names, credential-themed names, deep subdomain chains, and long domains.
- Performs **no DNS resolution, WHOIS lookup, geolocation lookup, ASN lookup, or reputation query** by itself.
- When no provider is configured, the UI displays exactly:
  > Live threat intelligence is unavailable. Only local analysis is available.

### Threat Remediation

- Generates a contextual checklist (contain, report, credential response, technical action, review) based on the findings and score.
- Tracks four checklist statuses: `recommended`, `in_progress`, `completed`, `failed`.
- Supports a controlled **block indicator** action through an optional server-side integration.
- Requirements for the block action:
  - the record exists in the current server session;
  - the record is not demo data;
  - the user explicitly confirms in a dialog;
  - the API receives `confirm: true`;
  - a block integration is actually configured.
- Without an integration, the action is recorded as `not_configured` and the state becomes `NOT_CONFIGURED`. The app **never claims that a block happened**.
- Integration failures and timeouts are recorded with the returned/sanitized message.
- A false-positive review can be requested with an optional reason; the detection is **not** silently overridden.
- Demo records are read-only: remediation actions cannot be run against them.

### Verification

- "Verify Again" performs a fresh local analysis and, when available:
  - queries the configured threat intelligence provider;
  - asks the configured block integration for the current block status.
- Verification produces a check-by-check evidence panel and audit events.
- **Only a configured integration reporting `blocked: true` can produce `VERIFIED`.**
- If the integration says "not blocked" or errors, verification fails.
- If the block is confirmed but the provider check errors, verification stays **pending**.
- If no integration is configured, the state becomes `NOT_CONFIGURED`; manual guidance remains available.
- Clients cannot set `VERIFIED` directly. State transitions are enforced in server-side services and recorded in an append-only audit trail within the record.

### History and reports

- Analyses are saved to **browser-local history** (LocalStorage) on this device.
- History is capped at 40 records per browser and survives page reloads; it is subject to browser quota and private-mode behavior.
- Server-session records are separate and kept in memory for 24 hours (maximum 250 records).
- Reports show the complete snapshot: input, score, findings, limitations, provider result, checklist, actions, verification evidence, and audit timeline.
- JSON export includes:
  - `reportVersion`, `generatedAt`, `demoData`, `notice`
  - assurance metadata explaining the score and verification meanings
  - the exact record, including its audit trail
- Demo report exports are explicitly marked `demoData: true` and carry a **DEMO DATA** notice.

### Settings / Integrations

- Reads safe configuration status from `GET /api/status`: booleans, display names, and non-secret reasons only.
- Shows storage scope and limits, active rate limits, and the behavior disclosures.
- Never returns provider endpoints, API keys, integration tokens, or other secrets to the browser.
- Displays the exact "Live threat intelligence is unavailable..." message only when no provider is configured.

### Demo mode

- A browser-local toggle displays six fictional records covering low, medium, high, and critical risk, plus pending verification, failed verification, and not-configured examples.
- Uses only reserved `example.*` domains and documentation IP ranges.
- Every demo record is labelled **DEMO DATA**.
- Demo records are never merged into user history.
- Remediation actions are disabled for demo records.
- Demo report exports are labelled as fictional.

---

## Screenshots

**No screenshots are committed to this repository yet.** To add real screenshots without fabricating UI state:

1. Start the app:
   ```powershell
   npm run dev
   ```
2. Open `http://localhost:3000`.
3. Turn on **Demo mode** on the Overview or History page to show populated states, including pending and failed verification examples.
4. Capture at a consistent size (for example 1440 × 900). On Windows, use `Win + Shift + S`, or use the browser's device toolbar/screenshot command.
5. Save the files under `docs/screenshots/` and reference them here, for example:

   ```markdown
   ![Overview](docs/screenshots/overview.png)
   ```

6. Before committing, redact real indicators, personal data, secrets, hostnames, and anything else sensitive. Do not screenshot a configured token or endpoint.

Suggested set:

| File | View | Suggested state |
| --- | --- | --- |
| `overview.png` | Overview | Demo mode on |
| `url-analysis.png` | URL Analyzer | A medium/high example with findings |
| `remediation.png` | Threat Remediation | Checklist plus verification panel |
| `reports.png` | Reports | Report detail with audit timeline |
| `settings.png` | Settings | Provider/integration badges and disclosures |

---

## Architecture

```text
Browser
  │
  ├─ App Router pages (client views + shared components)
  │     └─ Browser-local history (LocalStorage)
  │
  └─ POST/GET /api/*
        │
        ├─ Zod validation + body-size limit + rate limit
        ├─ Local deterministic analyzers (no network to submitted indicator)
        ├─ Optional provider adapter ── HTTPS POST, hostname-only for URLs
        ├─ Checklist / record / audit construction
        └─ Process-local in-memory store (24 h TTL, 250 records)
```

### Analysis request flow

1. The browser submits a URL or indicator to a route handler.
2. The route validates the body with Zod and enforces the request-size and per-IP rate limits.
3. A pure local analyzer produces findings and a bounded score.
4. If a provider is configured and safe, the server queries it with bounded time and response size. The result is attached separately.
5. A checklist is generated, an audit trail is started, and the record begins in `FIX_RECOMMENDED`.
6. The server-session store keeps the record; the browser saves its own snapshot in LocalStorage.
7. The client renders findings, provider data, checklist, and report links.

### Remediation request flow

1. The browser sends `analysisId` (plus item/status or explicit confirmation).
2. The route checks rate limits, origin (for block and verify), and body schema.
3. Domain services enforce the state machine. A block calls the configured integration and records the actual result.
4. The updated record is saved to the server session, returned to the client, and mirrored to browser-local history.
5. The UI shows exactly what the integration reported — success, failure, timeout, or not configured.

### Directory layout

```text
src/
  app/
    api/                     Route handlers (analysis, remediation, reports, history, status)
    analyzer/                URL Analyzer page
    indicators/              IP & Domain Analyzer page
    remediation/             Remediation page + client workspace
    history/                 History page
    reports/                 Reports list + dynamic detail route
    settings/                Settings page
    layout.tsx, page.tsx     App shell and Overview
  components/
    analysis/                Result, findings, checklist, verification, audit, actions
    history/                 Record table
    layout/                  Sidebar/app shell and page header
    remediation/             Review dialog
    reports/                 Read-only report document
    ui/                      Shared cards, badges, alerts, dialogs, buttons
  lib/
    analysis/                Local URL/indicator heuristics + static constants
    scoring/                 Score clamping and risk bands
    validation/              URL and indicator parsing/validation
    remediation/             State machine, services, recommendations, webhook adapter
    verification/            Evidence rules for verification status
    providers/               Optional threat intelligence adapter and query scope
    persistence/             Server in-memory store + browser LocalStorage history
    security/                Rate limiting, origin checks, outbound URL safety
    demo/                    Fictional demo dataset
    client/                  Browser API helper, export, hooks
    api/                     JSON response/error helpers
    audit/                   Append-only audit helpers and transitions
  tests/                     Vitest suites
  types/                     Shared API/domain types
```

### Key design decisions

- **Pure analysis domain.** Analyzers are isomorphic functions with no network access, making them easy to test and reason about.
- **Server-enforced state.** The client can request actions, but only server services can transition remediation states.
- **Provider data is separate.** Provider verdicts and scores never alter the local heuristic score.
- **No automatic URL fetching.** The app never visits submitted links, so it cannot be used as a request proxy or SSRF pivot through user input.
- **Allowlisted outbound calls only.** Operator-configured provider/integration endpoints must use HTTPS, port 443, an explicit hostname allowlist, and resolve to public addresses.
- **No invented data.** When a capability is not configured, the UI says so instead of filling the gap with fake results.

---

## Tech stack

| Layer | Technology | Version |
| --- | --- | --- |
| Framework | Next.js (App Router, Turbopack, Cache Components) | 16.4.3 |
| UI | React / React DOM | 19.3.0 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS v4 via `@tailwindcss/turbopack` | ^4 |
| Icons | Lucide React | 1.64.0 |
| Validation | Zod | 4.6.7 |
| Tests | Vitest | 5.0.5 |
| Lint | ESLint + `eslint-config-next` | 9 / 16.4.3 |

There is no UI component library, chart library, database, ORM, authentication provider, or AI SDK. The project uses npm and the scripts in `package.json`.

---

## Getting started on Windows (PowerShell)

### Prerequisites

- **Node.js 20.9 or newer** (Next.js 16 requirement). This project was verified locally with Node.js 26.13.0 and npm 11.20.0.
- npm (included with Node.js).
- A modern browser.
- Optional: Git, only if you want to publish the project.

Verify:

```powershell
node --version
npm --version
```

### Install and run

From the project directory:

```powershell
cd "D:\THREAT LENS AI"
npm install
npm run dev
```

Open <http://localhost:3000>.

The app works without any environment file. With no provider or integration configured:

- analysis is local-only;
- Settings shows both adapters as **Not Configured**;
- block and verification actions do not claim success.

### Optional environment file

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Restart the dev server after changing environment variables.

### Production build locally

```powershell
npm run build
npm start
```

Then open <http://localhost:3000>. To use another port:

```powershell
npm run dev -- -p 3001
```

### macOS / Linux

```bash
npm install
npm run dev
```

The application code is cross-platform; only the setup commands above are Windows-specific.

---

## Environment configuration

All variables are optional for a local-only demo. Secrets are read on the server and are never exposed through `NEXT_PUBLIC_*`.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `THREAT_INTEL_PROVIDER` | No | unset | Set to `generic` to enable the built-in provider adapter |
| `THREAT_INTEL_API_URL` | With provider | — | HTTPS endpoint for the provider contract |
| `THREAT_INTEL_API_KEY` | No | — | Bearer token sent to the provider |
| `THREAT_INTEL_ALLOWED_HOSTS` | With provider | — | Comma-separated hostnames; the endpoint host must be listed |
| `THREAT_INTEL_NAME` | No | `Generic Threat Intelligence` | Display name shown in the UI |
| `BLOCK_INTEGRATION_URL` | With integration | — | HTTPS webhook endpoint for block/status actions |
| `BLOCK_INTEGRATION_TOKEN` | With integration | — | Least-privilege bearer token |
| `BLOCK_INTEGRATION_ALLOWED_HOSTS` | With integration | — | Comma-separated hostnames; the endpoint host must be listed |
| `BLOCK_INTEGRATION_NAME` | No | `Generic Webhook Integration` | Display name shown in the UI |
| `THREATLENS_MAX_BODY_BYTES` | No | `16384` | JSON body limit; accepted range 1,024–1,000,000 |
| `THREATLENS_RATE_LIMIT_ANALYZE` | No | `20` | Analysis requests per 60-second window per client key |
| `THREATLENS_RATE_LIMIT_REMEDIATION` | No | `30` | Remediation requests per 60-second window |
| `THREATLENS_RATE_LIMIT_VERIFY` | No | `10` | Verification requests per 60-second window |
| `THREATLENS_ALLOWED_ORIGIN` | No | — | Extra allowed browser origins for block/verify calls, comma-separated |

Notes:

- `.env.local` is ignored by Git. `.env.example` is intentionally tracked.
- Never commit real tokens. Use a dedicated least-privilege credential with a short lifetime.
- Rate-limit overrides accept positive integers up to 1,000.
- A partially configured provider is treated as **not configured** with a safe reason shown in Settings.

---

## Optional threat intelligence provider

Without a configured provider, the app reports exactly:

> Live threat intelligence is unavailable. Only local analysis is available.

To enable the included generic adapter, set:

```dotenv
THREAT_INTEL_PROVIDER=generic
THREAT_INTEL_API_URL=https://intel.example.com/v1/lookup
THREAT_INTEL_API_KEY=replace-with-a-real-token
THREAT_INTEL_ALLOWED_HOSTS=intel.example.com
THREAT_INTEL_NAME=Example Threat Intelligence
```

### Request contract

The server sends `POST` to the configured endpoint with:

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <THREAT_INTEL_API_KEY>   # only when configured
```

```json
{
  "indicator": "example.com",
  "type": "url",
  "scope": "hostname"
}
```

- For **URL analyses**, only the **hostname** is sent. Paths, query strings, fragments, page contents, and credentials are never sent to the provider.
- For **IP/domain analyses**, the normalized indicator is sent.
- The application does **not** fetch the submitted URL or indicator itself.

### Response contract

A `2xx` response must be JSON:

```json
{
  "verdict": "malicious",
  "score": 87,
  "tags": ["phishing", "credential-harvesting"],
  "reference": "https://intel.example.com/cases/123",
  "checkedAt": "2026-10-30T12:00:00Z",
  "message": "Optional short explanation"
}
```

| Field | Required | Constraints |
| --- | --- | --- |
| `verdict` | Yes | `malicious`, `suspicious`, `clean`, or `unknown` |
| `score` | No | Number from 0 to 100; stored separately, never blended into the local score |
| `tags` | No | Up to 20 strings, each 1–40 characters |
| `reference` | No | Up to 500 characters |
| `checkedAt` | No | Up to 64 characters; parsed if it is a valid date |
| `message` | No | Up to 300 characters |

### Safety behavior

Before every request, the server:

- requires HTTPS;
- requires port 443 (or no explicit port);
- rejects embedded credentials;
- rejects IP-address hosts, `localhost`, `.local`, and `.internal`;
- requires the exact hostname to be in `THREAT_INTEL_ALLOWED_HOSTS`;
- resolves the hostname and blocks private, loopback, link-local, reserved, documentation, multicast, and other non-public addresses.

Requests also use `redirect: "error"`, a 6-second timeout, and a 100,000-character response cap. Invalid JSON, oversized responses, timeout, HTTP errors, and 429 responses become explicit provider statuses (`invalid_response`, `timeout`, `error`, `rate_limited`). **No verdict is invented.** The local analysis still returns normally.

---

## Optional block integration

Without a configured integration:

- the UI shows **Not Configured**;
- the block action records `not_configured` and does not claim success;
- verification cannot produce `VERIFIED`;
- manual blocking guidance remains available.

Configure it with:

```dotenv
BLOCK_INTEGRATION_URL=https://gateway.example.com/threatlens/actions
BLOCK_INTEGRATION_TOKEN=replace-with-a-least-privilege-token
BLOCK_INTEGRATION_ALLOWED_HOSTS=gateway.example.com
BLOCK_INTEGRATION_NAME=Example Security Gateway
```

The same endpoint handles two actions. Every request uses:

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <BLOCK_INTEGRATION_TOKEN>
```

### Block action

```json
{
  "action": "block",
  "indicator": "https://example.com/login?next=%2Fhome",
  "indicatorType": "url"
}
```

Expected response:

```json
{
  "ok": true,
  "message": "Block rule created.",
  "reference": "rule-123"
}
```

- `ok` is required and must be a boolean.
- `message` is optional, up to 300 characters.
- `reference` is optional, up to 200 characters.
- A response with `ok: false` is recorded as a **failed** action.
- 401/403, 429, other non-2xx statuses, invalid JSON, oversized responses, and timeouts are recorded as failures. The app does not retry silently or claim success.

### Status action

```json
{
  "action": "status",
  "indicator": "https://example.com/login?next=%2Fhome",
  "indicatorType": "url"
}
```

Expected response:

```json
{
  "blocked": true,
  "message": "Block rule is active.",
  "checkedAt": "2026-10-30T12:00:00Z"
}
```

- `blocked` is required and must be a boolean.
- `message` is optional, up to 300 characters.
- `checkedAt` is optional and parsed if valid.
- Only `blocked: true` is treated as evidence for `VERIFIED`.

**Privacy note:** unlike the provider call, the integration receives the record's **normalized indicator**. For URL records, that is the normalized full URL, including its path and query string. Integration calls happen only when an operator explicitly runs a confirmed block action or a verification check.

The integration endpoint is subject to the same HTTPS/port/allowlist/private-address checks as the provider, with a 6-second timeout, `redirect: "error"`, and a 50,000-character response cap.

---

## Demo mode

Demo mode is a browser-local toggle on the Overview/History/Reports UI. It displays six fictional records:

- Low risk (`https://www.example.com/...`)
- Medium risk with **pending verification**
- High risk with **failed verification** and a failed fictional action
- Critical risk
- Domain example in `NOT_CONFIGURED`
- Documentation-range IPv4 example

All demo records:

- are labelled **DEMO DATA / fictional**;
- use reserved `example.*` domains and documentation IP ranges;
- are **never saved** into the user's browser-local history;
- are excluded from Overview counts of "your analyses";
- cannot be remediated or verified;
- produce JSON exports with `demoData: true` and a clear notice.

The preference is stored under the LocalStorage key `threatlens.demo-mode.v1`. The records are generated in the browser from the same local analyzers; they are not live threat intelligence.

---

## Using the workflow

### 1. Detect

1. Open **URL Analyzer** or **IP & Domain Analyzer**.
2. Enter an indicator. Use the built-in examples or safe reserved domains if you just want to explore.
3. Submit. The result is analyzed locally and saved to browser history (unless storage is unavailable).

### 2. Explain

Review each finding's:

- severity and category;
- evidence observed in the input;
- why it matters and what an attacker could do;
- confidence;
- recommendation;
- exact score contribution.

The total is only the sum of those contributions, bounded to 0–100. Provider data, if present, is shown separately.

### 3. Correct

Open **Threat Remediation** for the analysis. Work through the checklist:

- `recommended` → `in_progress` → `completed` or `failed`.
- Checklist updates are user-reported and audited as such.
- Use the manual blocking guidance in an authorized tool.
- If an integration is configured, use the controlled block action. It requires explicit confirmation.

### 4. Verify

Run **Verify Again**:

- A fresh local analysis is always recorded.
- The app asks any configured integration for the block status.
- The app asks any configured provider for a separate verdict.
- The evidence panel explains the outcome.

Only a configured integration reporting the indicator as blocked can produce **VERIFIED**.

### 5. Report

Open the report from the result or Reports page:

- Review the full evidence snapshot.
- Export JSON. The file is generated locally in the browser and includes assurance metadata.

---

## API reference

All API responses are JSON and use `Cache-Control: no-store`.

### Success envelope

```json
{
  "ok": true,
  "data": {}
}
```

### Error envelope

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body is invalid.",
    "details": [{ "path": "url", "message": "A URL is required." }]
  }
}
```

Stack traces, secrets, endpoints, and internal error details are never returned. Unexpected failures return a generic `INTERNAL_ERROR` message.

### Rate-limit headers

Limited endpoints may return:

```text
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
Retry-After        (only when blocked)
```

Limits are per client key per 60-second fixed window. The client key is the first `x-forwarded-for` value, then `x-real-ip`, then `anonymous`.

### Endpoints

| Method | Path | Rate limit | Description |
| --- | --- | --- | --- |
| `POST` | `/api/analyze/url` | analyze | Analyze a URL |
| `POST` | `/api/analyze/indicator` | analyze | Analyze an IPv4 address or domain |
| `GET` | `/api/reports/[id]` | — | Get a full record from the server session |
| `GET` | `/api/history` | — | List server-session record summaries + storage stats |
| `GET` | `/api/status` | — | Safe configuration/status summary |
| `POST` | `/api/remediation/recommend` | remediation | Generate a checklist if missing |
| `POST` | `/api/remediation/checklist` | remediation | Update a checklist item |
| `POST` | `/api/remediation/review` | remediation | Request a false-positive review |
| `POST` | `/api/remediation/execute` | remediation | Execute a confirmed block action |
| `POST` | `/api/remediation/verify` | verify | Run verification |

#### `POST /api/analyze/url`

Request:

```json
{ "url": "https://example.com/login" }
```

- Strict object; only `url` is accepted.
- Maximum 2,048 characters.
- Returns `201` with an `AnalysisRecord`.

#### `POST /api/analyze/indicator`

Request:

```json
{ "indicator": "203.0.113.42" }
```

Optional type assertion:

```json
{ "indicator": "secure-login.example.xyz", "indicatorType": "domain" }
```

- Only `indicator` and optional `indicatorType` are accepted.
- `indicatorType` must be `ipv4` or `domain` and must match the parsed input.
- Returns `201` with an `AnalysisRecord`.

#### `GET /api/reports/[id]`

- ID must match `^[a-zA-Z0-9_-]{1,120}$`.
- Returns the record from the **current server session**.
- Returns `404` after the 24-hour TTL, after a process restart, or on another instance.

#### `GET /api/history`

Returns server-session summaries, not browser LocalStorage:

```json
{
  "ok": true,
  "data": {
    "records": [],
    "storage": {
      "scope": "server-session",
      "persistence": "in-memory",
      "note": "Server-session records expire after 24 hours or when the process restarts. Browser-local history is stored separately on this device.",
      "count": 0,
      "max": 250,
      "ttlHours": 24
    }
  }
}
```

#### `GET /api/status`

Returns only safe status data: provider/integration configured booleans, display names, reasons, storage stats, rate limits, behavior flags, the exact provider-unavailable message, the disclaimer, and the external-lookup disclosure.

#### `POST /api/remediation/recommend`

```json
{ "analysisId": "tl_..." }
```

- Returns the record, checklist, and prioritized next actions.
- If the record already has a checklist, it is returned unchanged.
- `404 NOT_FOUND` when the record is not in the server session.

#### `POST /api/remediation/checklist`

```json
{
  "analysisId": "tl_...",
  "itemId": "do-not-open",
  "status": "in_progress"
}
```

- `status` must be `recommended`, `in_progress`, `completed`, or `failed`.
- Records an audit event stating the update is user-reported, not independent verification.
- May move `FIX_RECOMMENDED` → `REMEDIATION_PENDING` → `REMEDIATED` according to the state machine.

#### `POST /api/remediation/review`

```json
{
  "analysisId": "tl_...",
  "reason": "This domain belongs to our own staging environment."
}
```

- `reason` is optional and capped at 500 characters.
- Moves the record to `FALSE_POSITIVE_PENDING_REVIEW` when allowed.
- Does not override the detection automatically.

#### `POST /api/remediation/execute`

```json
{
  "analysisId": "tl_...",
  "confirm": true
}
```

- `confirm` must be exactly `true`.
- Requires a same-origin browser request (or an origin listed in `THREATLENS_ALLOWED_ORIGIN`).
- Requires a configured integration; otherwise returns `409 NOT_CONFIGURED` and records `not_configured`.
- Integration failure returns `502 INTEGRATION_ACTION_FAILED` with the updated record in `details`.
- Success does **not** set `VERIFIED`; it moves to `REMEDIATED` and prompts verification.

#### `POST /api/remediation/verify`

```json
{ "analysisId": "tl_..." }
```

- Requires a same-origin browser request (or an allowed configured origin).
- Runs a fresh local analysis, provider check (if configured), and integration status check (if configured).
- Returns the updated record. Inspect `verification.status` and `verification.checks`.
- Never accepts a target state from the client.

### PowerShell examples

```powershell
$base = "http://localhost:3000"

# Analyze a URL
$body = @{ url = "https://example.com/login" } | ConvertTo-Json
$response = Invoke-RestMethod -Method Post -Uri "$base/api/analyze/url" `
  -ContentType "application/json" -Body $body
$id = $response.data.id
$response.data | ConvertTo-Json -Depth 8

# Update a checklist item
$checklist = @{
  analysisId = $id
  itemId = "do-not-open"
  status = "completed"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/api/remediation/checklist" `
  -ContentType "application/json" -Body $checklist | ConvertTo-Json -Depth 8

# Run verification
$verify = @{ analysisId = $id } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/api/remediation/verify" `
  -ContentType "application/json" -Body $verify | ConvertTo-Json -Depth 8

# Read configuration status
Invoke-RestMethod -Uri "$base/api/status" | ConvertTo-Json -Depth 8
```

To execute a block action (only after you intentionally configure an integration):

```powershell
$execute = @{ analysisId = $id; confirm = $true } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/api/remediation/execute" `
  -ContentType "application/json" -Body $execute | ConvertTo-Json -Depth 8
```

### Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Body schema failed |
| `INVALID_JSON` | 400 | Body was not valid JSON |
| `EMPTY_BODY` | 400 | No body was provided |
| `INVALID_URL` | 400 | URL failed local validation |
| `INVALID_INDICATOR` | 400 | Indicator failed local validation |
| `INDICATOR_TYPE_MISMATCH` | 400 | Declared type differs from parsed type |
| `INVALID_ID` | 400 | Report ID has an invalid shape |
| `ORIGIN_REJECTED` | 403 | Cross-origin state-changing request |
| `NOT_FOUND` | 404 | Record/item not found in the current server session |
| `NOT_CONFIGURED` | 409 | No block integration configured |
| `ACTION_NOT_PERMITTED` | 409 | State machine rejected the transition |
| `PAYLOAD_TOO_LARGE` | 413 | Body exceeded the configured limit |
| `RATE_LIMITED` | 429 | Per-window request limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error; no action performed |
| `INTEGRATION_ACTION_FAILED` | 502 | Integration failed or returned a negative result |

---

## Remediation and verification rules

### States

```text
DETECTED                      Analysis created locally.
UNDER_REVIEW                  Human review requested or in progress.
FIX_RECOMMENDED               Checklist/recommendations ready; no action performed.
REMEDIATION_PENDING           Work started or integration action in progress.
REMEDIATED                    User-reported completion or integration success (not verified).
VERIFIED                      Configured integration confirmed the block.
VERIFICATION_FAILED           Verification ran but block evidence was missing/negative/errored.
VERIFICATION_PENDING          Verification started but a dependency could not complete.
FALSE_POSITIVE_PENDING_REVIEW Review requested; detection not automatically overridden.
NOT_CONFIGURED                Required automation is unavailable; manual guidance remains.
```

### Allowed transitions

The authoritative matrix is in `src/lib/remediation/stateMachine.ts`.

```text
DETECTED                      → FIX_RECOMMENDED, UNDER_REVIEW, VERIFICATION_PENDING,
                                FALSE_POSITIVE_PENDING_REVIEW, NOT_CONFIGURED
UNDER_REVIEW                  → FIX_RECOMMENDED, REMEDIATION_PENDING, FALSE_POSITIVE_PENDING_REVIEW,
                                VERIFICATION_PENDING, NOT_CONFIGURED
FIX_RECOMMENDED               → REMEDIATION_PENDING, UNDER_REVIEW, VERIFICATION_PENDING,
                                FALSE_POSITIVE_PENDING_REVIEW, NOT_CONFIGURED
REMEDIATION_PENDING           → REMEDIATED, VERIFICATION_PENDING, NOT_CONFIGURED,
                                UNDER_REVIEW, FALSE_POSITIVE_PENDING_REVIEW
REMEDIATED                    → VERIFICATION_PENDING, REMEDIATION_PENDING, UNDER_REVIEW,
                                FALSE_POSITIVE_PENDING_REVIEW
VERIFIED                      → VERIFICATION_PENDING, REMEDIATION_PENDING, UNDER_REVIEW,
                                FALSE_POSITIVE_PENDING_REVIEW
VERIFICATION_PENDING          → VERIFIED, VERIFICATION_FAILED, NOT_CONFIGURED,
                                FALSE_POSITIVE_PENDING_REVIEW
VERIFICATION_FAILED           → VERIFICATION_PENDING, REMEDIATION_PENDING, UNDER_REVIEW,
                                FALSE_POSITIVE_PENDING_REVIEW, NOT_CONFIGURED
FALSE_POSITIVE_PENDING_REVIEW → UNDER_REVIEW, FIX_RECOMMENDED, VERIFICATION_PENDING
NOT_CONFIGURED                → REMEDIATION_PENDING, VERIFICATION_PENDING, UNDER_REVIEW,
                                FALSE_POSITIVE_PENDING_REVIEW, FIX_RECOMMENDED
```

### Verification decision table

| Integration configured? | Block status | Provider check | Outcome |
| --- | --- | --- | --- |
| No | — | any | `not_configured` → state `NOT_CONFIGURED` |
| Yes | `error` | any | `failed` → state `VERIFICATION_FAILED` |
| Yes | not blocked | any | `failed` → state `VERIFICATION_FAILED` |
| Yes | no confirmed status | any | `failed` → state `VERIFICATION_FAILED` |
| Yes | confirmed | error | `pending` → state `VERIFICATION_PENDING` |
| Yes | confirmed | checked or not configured | `verified` → state `VERIFIED` |

Additional rules:

- A fresh local analysis is always recorded, even when verification fails or remains pending.
- A clean rescan does **not** prove a block exists.
- A completed checklist or a recipe is not independent evidence.
- A provider verdict is not block evidence. The integration's status check is authoritative for block status.
- The client cannot submit `state`, `verification`, or `audit` fields. State changes happen only through server services.
- Each transition appends an audit event. Audit entries are not edited or removed by the app.

---

## Data storage

### Browser-local history

- LocalStorage key: `threatlens.history.v1`.
- Demo preference key: `threatlens.demo-mode.v1`.
- Maximum 40 records; newest first.
- `isAnalysisRecord` validation rejects malformed records and anything marked `demo: true`.
- If storage is unavailable or full, analyses still display for the session but are not persisted. The UI tells you when this happens.
- History exists only in the current browser profile. Clearing site data removes it.
- Submitted indicators are stored on your device, so avoid entering sensitive production data on a shared machine.

### Server-session store

- In-memory `Map` exposed through `src/lib/persistence/serverStore.ts`.
- 24-hour TTL and 250-record cap.
- Process-local: lost on restart and not shared across multiple server instances.
- No database, file, or external persistence adapter is included.
- Browser history and server history are separate snapshots. A report can fall back to the server session when the browser copy is missing, but only while that record still exists.

---

## Testing and quality checks

### Commands

```powershell
npm test
npm run test:watch
npm run lint
npm run typecheck
npm run build
```

### Verified local results (2026-10-30)

- `npm test` — **5 test files, 87 tests passed**.
- `npm run lint` — clean.
- `npm run typecheck` — clean (`tsc --noEmit`).
- `npm run build` — succeeded with Next.js 16.4.3/Turbopack. The build generated 20/20 pages, including 8 fully static UI routes, the partially prerendered `/reports/[id]` route, and dynamic API handlers.
- Production smoke test with `npm start` — `GET /api/status`, URL analysis, report retrieval, the `/analyzer` page, and verification without an integration all returned the expected behavior (`provider.configured=false`, `integration.configured=false`, verification `not_configured` / state `NOT_CONFIGURED`).

### Test coverage areas

| File | Focus |
| --- | --- |
| `src/tests/url.test.ts` | URL validation, normalization, local heuristics, score contributions |
| `src/tests/scoring.test.ts` | Score clamping, band boundaries, deterministic totals |
| `src/tests/api.test.ts` | Success/error envelopes, malformed/oversized bodies, rate limiting, secret redaction, status/history/report APIs |
| `src/tests/security.test.ts` | Outbound URL guard, private-address blocking, provider configuration/lookup safety, integration config/webhook behavior |
| `src/tests/remediation.test.ts` | State transitions, checklist updates, block success/failure/not-configured, review, verification rules |

---

## Troubleshooting

### `npm` is not recognized

Install Node.js 20.9 or newer, reopen PowerShell, and run `node --version`. If you use a portable Node build, add its directory to `PATH` for the current shell.

### PowerShell blocks `npm.ps1`

Use `npm.cmd`:

```powershell
npm.cmd run dev
```

Or allow local scripts for your user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Environment changes have no effect

Restart the dev server (and the production server) after editing `.env.local`.

### Settings says the provider is not configured

Check all of the following:

- `THREAT_INTEL_PROVIDER` is exactly `generic`.
- `THREAT_INTEL_API_URL` uses `https://` and port 443.
- `THREAT_INTEL_ALLOWED_HOSTS` contains the exact endpoint hostname.
- The hostname resolves to a public address, not a private/reserved range.
- The safe reason shown under the provider badge explains the specific failure.

The same applies to the block integration with its `BLOCK_INTEGRATION_*` variables.

### A report or remediation action returns `NOT_FOUND`

Server-session records expire after 24 hours or when the process restarts. Re-run the analysis. Browser-local history may still show the old snapshot, but server-side actions need the current session record.

### The block action returns `NOT_CONFIGURED`

No block integration is configured. The app will not pretend a block happened. Use the manual guidance or configure the webhook integration deliberately.

### The block action returns `INTEGRATION_ACTION_FAILED`

The integration was reached but returned a failure, a timeout, invalid JSON, or a negative result. Inspect the action message and the integration's own logs. Verification will not report success without a confirmed block status.

### `RATE_LIMITED`

Wait for the `Retry-After` interval or raise the relevant `THREATLENS_RATE_LIMIT_*` value for local testing. Limits are process-local and reset when the process restarts.

### Browser history is not saved

Private browsing, blocked site storage, or a full quota can prevent writes. The analysis result remains visible for the session, and the UI displays a warning. Check the browser's storage settings for the site.

### Styles are missing or the build behaves oddly

Confirm dependencies are installed, then clear the build cache:

```powershell
Remove-Item -Recurse -Force .next
npm run build
```

### Port 3000 is already in use

```powershell
npm run dev -- -p 3001
```

---

## Publishing to GitHub

No Git repository was initialized, and no commits, pushes, or deployments were performed while building this project. To publish it yourself:

### 1. Install Git (if needed)

```powershell
winget install --id Git.Git -e --source winget
```

Reopen PowerShell and verify:

```powershell
git --version
```

### 2. Review before committing

- Confirm `.env.local` is not present in `git status`; `.gitignore` excludes `.env*` but tracks `.env.example`.
- Remove any real tokens, endpoints, private hostnames, screenshots, or analysis records.
- Check that no personal or production data is embedded in demo data or tests.
- Consider adding a `LICENSE` file. None is included by default.

### 3. Initialize and commit

```powershell
cd "D:\THREAT LENS AI"
git init
git add .
git status
git commit -m "Initial ThreatLens AI implementation"
git branch -M main
```

### 4. Create and push the repository

Create an empty repository on GitHub, then:

```powershell
git remote add origin https://github.com/<your-account>/<your-repo>.git
git push -u origin main
```

Or use the GitHub CLI:

```powershell
gh repo create <your-repo> --public --source . --remote origin --push
```

Only publish if you are comfortable with the repository being public. Do not publish unredacted screenshots, secrets, or real customer indicators.

---

## Deployment

The build is a standard Next.js application, but the default persistence model is intentionally lightweight. **No deployment has been performed or verified.**

### Vercel

1. Push the repository to GitHub.
2. Import the repository in Vercel.
3. Framework preset: Next.js.
4. Add the environment variables you actually need (`THREAT_INTEL_*`, `BLOCK_INTEGRATION_*`, rate limits, `THREATLENS_ALLOWED_ORIGIN`).
5. Deploy.

Caveats:

- The server store is in-memory. On serverless platforms, records may not be available across invocations or instances, so remediation/verification can return `NOT_FOUND` after a cold start or routing change.
- Rate limiting is process-local and not a distributed control.
- There is no authentication. Add access control before exposing the app beyond a demo audience.
- For durable behavior, replace the store with a shared database/KV adapter and move rate limiting to a shared edge/store.

### Self-hosted Node server

```powershell
npm ci
npm run build
npm start
```

Then place it behind an HTTPS reverse proxy, set production environment variables, and run a single instance unless you add shared storage. Restarting the process clears server-session records. The app does not include a Dockerfile, process manager configuration, or TLS termination.

### Post-deploy checks

- `GET /api/status` shows the expected provider/integration state and no secrets.
- A local-only analysis returns a record.
- A remediation action without an integration returns `NOT_CONFIGURED`, not a success claim.
- Verification without an integration returns `not_configured` / `NOT_CONFIGURED`.
- With an integration, a confirmed block status produces `VERIFIED`; a negative/errored status does not.
- Rate-limit headers are present and 429 responses behave as expected.

---

## Security model and limitations

### Controls implemented

- Strict Zod schemas and strict objects on API bodies.
- Bounded request bodies with streaming enforcement, not just `Content-Length`.
- Per-client fixed-window rate limiting with standard headers.
- Consistent JSON error envelopes; no stack traces or secrets in responses.
- Same-origin checks for block execution and verification, with an optional allowlist.
- Explicit `confirm: true` requirement for block actions.
- Server-side state machine and audit transitions; the client cannot set `VERIFIED`.
- Provider and integration endpoints require HTTPS, port 443, hostname allowlists, and public DNS resolution.
- Outbound requests reject redirects, enforce timeouts, and cap response sizes.
- Submitted URLs/indicators are never fetched or resolved by the analyzer.
- Provider URL analyses send only the hostname; paths and queries are excluded.
- No fabricated provider, geolocation, WHOIS, DNS, reputation, blocking, or verification data.
- Demo data is separated, labelled, read-only, and excluded from user history.
- Browser storage failures are surfaced instead of being silently ignored.

### Limitations and non-goals

- **Heuristics are not a verdict.** Expect false positives and false negatives. Brand-name, TLD, hyphen, and length checks are weak signals by design.
- **No page inspection.** The app does not load page content, inspect certificates, take screenshots, or evaluate JavaScript. It cannot detect a malicious page behind a clean-looking URL.
- **No DNS/WHOIS/geolocation/reputation of its own.** The app only shows those categories if an operator configures a compatible provider, and even then only the provider's returned contract fields.
- **No malware scanning or file submission.** Download-related findings are contextual only.
- **No automatic remediation without an integration.** Manual instructions are guidance, not proof of action.
- **Verification is integration-scoped.** It confirms what the configured integration reports; it does not independently inspect browsers, endpoints, DNS, or gateways.
- **No authentication, authorization, accounts, or multi-tenancy.** Anyone who can reach a deployment can use the APIs and see server-session records (if they know an ID). Do not expose it publicly without adding access control.
- **No durable database.** In-memory records expire after 24 hours and disappear on restart. Browser history is device-local and can be cleared.
- **Rate limiting is process-local.** It is not suitable as the only defense against distributed abuse. The client key trusts `x-forwarded-for`/`x-real-ip`, so deploy behind a proxy you control.
- **CSRF protection is partial.** Block/verify calls check Origin, but they do not use per-session CSRF tokens. Requests without an `Origin` header are allowed for CLI/server use.
- **Third-party data is untrusted.** Provider and integration messages are validated and truncated but still originate outside the app. Review them before acting.
- **Secrets are server-side but still environment-dependent.** A compromised host or build pipeline can expose them. Use least-privilege, short-lived credentials.
- **Demo data is fictional.** It must never be presented as real threat intelligence, a real provider result, or a real blocking outcome.
- **Name only.** "AI" does not indicate machine learning; no model inference is performed.
- **No compliance certification.** Nothing here should be treated as SOC 2, ISO 27001, HIPAA, PCI, or legal advice.

### Privacy notes

- Submitted indicators are stored in browser LocalStorage and, during the session, in server memory.
- If a provider is configured, URL hostnames or IP/domain indicators leave the server over HTTPS.
- If an integration is configured and an operator confirms an action, the normalized full URL (including path/query) or indicator is sent to that integration.
- No analytics, telemetry, advertising, or external font/script calls are included by the application code.

---

## Project status

| Item | Status |
| --- | --- |
| Application implementation | Complete in this workspace |
| Automated tests | 87 passing across 5 files |
| Lint / typecheck / production build | Passing locally |
| Git repository | Not initialized |
| Commits / pushes | None performed |
| Deployment | None performed |
| Screenshots | Not included; instructions above |
| Durable persistence | Not included (in-memory server store + browser LocalStorage) |
| Authentication | Not included |

The project is suitable as a cybersecurity student portfolio piece and as a foundation for a more complete platform. Treat the current storage, authentication, rate-limiting, and integration layers as adapters that must be hardened before real operational use.
