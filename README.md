# OpenBao Web UI

[中文文档](./README_ZH.md)

A modern, self-hosted admin interface for [OpenBao](https://openbao.org) — the open-source fork of HashiCorp Vault. Built with Next.js 16 App Router, Tailwind CSS 4, and shadcn/ui.

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)

---

## Features

### Implemented

#### Authentication & Connection
- Token-based login with server health check before connecting
- Recent server address chips for quick reconnection
- Token TTL and accessor display in the header
- Automatic reconnection guard — redirects to login when token is invalid
- Direct CORS fetch with transparent Next.js proxy fallback for cross-origin deployments

#### Dashboard
- Cluster health banner (sealed / standby / active)
- Stat cards: total mounts, auth methods, policies, active leases
- Token information panel (accessor, policies, TTL, creation time)
- Version history timeline

#### KV v2 Secrets Browser (`/secrets`)
- Two-pane folder/file tree — navigate nested paths without page reloads
- Read, write, and soft-delete secret versions
- Undelete and permanent destroy of specific versions
- Version history tab with diff-friendly value display
- Metadata tab: max versions, CAS required, custom metadata editing
- Create secret dialog with key-value table editor

#### Policies (`/policies`)
- **ACL Policies** — list, view, create, edit, delete with live HCL editor (CodeMirror 6)
- **Password Policies** — list, view, create, edit, delete, and generate a sample password
- System policies (`root`, `default`) shown as read-only
- Empty list handled gracefully (OpenBao returns 404 on empty LIST)

#### Applications (`/apps`)
- Application registry backed by KV v2 at `secret/vault-ui/apps/{name}`
- List with environment filter (dev / staging / prod)
- **7-step creation wizard:**
  1. Basics — app name, project name, category (preset chips + custom), environment
  2. Initial secrets — optional KV key-value pairs
  3. Policy — auto-generated HCL template, fully editable
  4. AppRole configuration — TTLs, num-uses, bind secret ID, CIDR bounds
  5. Review — full summary before execution
  6. Execution — live per-operation status (policy → secrets → AppRole → role ID → secret ID → metadata)
  7. Success — role ID (copyable) and one-time secret ID (copyable, shown once only)
- KV path format: `app/{project}/{category}/{app}/{env}`
- Application detail page with tabs: Overview, Secrets (link to browser), Policy (editable), Credentials (role ID, generate secret ID, list/destroy accessors)
- Delete app: cleans up policy and AppRole, preserves KV secrets

#### Secrets Engines (`/engines`)
- List all mounted engines with type, path, description, accessor, options
- Enable new engine (type, path, description, version) via dialog
- Tune mount (TTL, max TTL, description) via dialog
- Disable with confirmation
- **Engine detail pages:**
  - **PKI** — CA certificate info, generate/set CA, roles CRUD, issue certificate, revoked certificates list
  - **Transit** — keys list, create key (type, exportable, allow plaintext backup), rotate key, encrypt/decrypt data
  - **TOTP** — keys list, create key (issuer, account, period, digits, algorithm, QR), generate code with 30-second live countdown, validate code
  - **Generic** — raw API explorer for any other engine type

#### Auth Methods (`/auth`)
- List all enabled auth methods with type, path, accessor, description
- Enable new method (type, path, description) via dialog
- Disable with confirmation
- **Auth method detail pages:**
  - **AppRole** — roles list + detail panel with config, role ID, generate/list/destroy secret IDs, tidy stale accessors
  - **Token** — accessor list, lookup token by accessor, revoke token, tidy
  - **JWT / OIDC** — config edit (JWKS URL, OIDC discovery, bound issuer), roles CRUD, generate OIDC test URL
  - **Generic** — raw API explorer fallback for any other type

#### Identity (`/identity`)
- **Entities** — table with batch detail fetch, create/edit/delete dialogs, alias display
- **Groups** — list with member count, create/edit/delete, internal vs external type
- **Aliases** — entity alias list, create alias (mount accessor + alias name)
- **OIDC Provider** — tabs for Keys, Roles, Providers, Clients, Scopes, well-known endpoints
- **MFA** — Methods tab (TOTP, Duo, Okta, PingID) and Login Enforcements tab

#### Leases (`/leases`)
- Two-pane prefix tree — drill into lease namespaces
- Lease detail: ID, issue/expiry times, TTL, renewable flag
- Renew, revoke, force-revoke, and tidy per lease or prefix

#### System (`/system`)
- **Status** — seal state, unseal progress, HA cluster info (leader address, standby nodes)
- Seal and unseal vault with key share input
- **Audit** — list devices, enable (file/syslog/socket), disable
- **CORS** — toggle enabled, set allowed origins and headers (state properly seeded from API on load)
- **Tools** — hash (SHA-2/SHA-3 family, hex/base64 output), random bytes generator

#### Namespaces (`/namespaces`)
- List namespaces, create, lock/unlock, delete with confirmation

---

### Not Yet Implemented

These routes exist but render partial or placeholder content:

| Area | Missing |
|---|---|
| System | Quotas, Plugins, Logging, Request Headers, Wrapping, Key Rotation, Rekey, Locked Users tabs |
| Identity / OIDC | Full CRUD for keys, roles, providers, clients, scopes |
| Identity / MFA | Full CRUD for TOTP/Duo/Okta/PingID methods and login enforcements |
| Namespaces | Nested namespace tree (child namespaces), namespace-scoped navigation |
| Secrets Browser | KV v1 engine support (currently only KV v2) |
| Auth / AppRole | Bind CIDR list editor in role config |

---

### Planned (P3)

| Feature | Notes |
|---|---|
| Dark mode | CSS variable theme toggle, persisted to localStorage |
| Command palette | `Cmd+K` quick-nav across all routes and entities |
| Internationalization | i18n via `next-intl`, starting with English and Chinese |
| Token renewal | Auto-renew self token before TTL expiry with configurable threshold |
| Audit log streaming | Real-time audit log tail (requires websocket-capable proxy) |
| Multi-cluster | Switch between multiple OpenBao instances without logging out |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router, TypeScript strict) |
| Styling | Tailwind CSS 4, shadcn/ui (Radix UI primitives) |
| State | Zustand v5 — connection state persisted to `localStorage` |
| Data fetching | TanStack Query v5 — all API calls via `useQuery` / `useMutation` |
| Forms | React Hook Form + Zod validation |
| Editor | CodeMirror 6 with custom HCL StreamLanguage and policy keyword completions |
| Build | `output: 'standalone'` for Docker deployment |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A running OpenBao (or Vault-compatible) instance reachable from the browser or the Next.js server

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter your OpenBao server address and a valid token.

### Production Build

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t vault-ui .
docker run -p 3000:3000 vault-ui
```

The standalone build includes only the files needed to run — no `node_modules` at runtime.

---

## Configuration

No environment variables are required. The server address and token are entered at login time and persisted to `localStorage` under the key `vault-ui:connection`. Recent addresses are stored separately under `vault-ui:recent-addrs`.

### CORS

If the browser cannot reach your OpenBao instance directly (cross-origin), the UI automatically falls back to routing requests through the built-in Next.js proxy at `/api/proxy/[...path]`. No extra configuration is needed — the proxy forwards the `X-Vault-Token` header and the request body transparently.

To allow direct browser connections, add your UI origin to OpenBao's CORS config:

```bash
bao write sys/config/cors \
  enabled=true \
  allowed_origins="http://localhost:3000"
```

---

## Project Structure

```
src/
├── app/
│   ├── (shell)/           # Authenticated shell (sidebar + header layout)
│   │   ├── apps/          # Application registry + wizard
│   │   ├── auth/          # Auth methods list + detail
│   │   ├── dashboard/     # Cluster overview
│   │   ├── engines/       # Secrets engines list + detail
│   │   ├── identity/      # Entities, groups, aliases, OIDC, MFA
│   │   ├── leases/        # Lease browser
│   │   ├── namespaces/    # Namespace management
│   │   ├── policies/      # ACL + password policies
│   │   ├── secrets/       # KV v2 browser
│   │   └── system/        # System admin
│   ├── api/proxy/         # Edge-runtime transparent proxy
│   └── login/             # Login page
├── components/
│   ├── hcl-editor/        # CodeMirror 6 HCL editor + completions
│   ├── layout/            # Sidebar, header, breadcrumb
│   └── ui/                # shadcn/ui components
├── hooks/                 # TanStack Query hooks per domain
├── lib/
│   ├── store.ts           # Zustand connection store
│   ├── utils.ts           # cn, relativeTime, formatTTL, slugify
│   └── vault/
│       ├── api/           # OpenBao API wrappers per domain
│       ├── client.ts      # vaultFetch — direct + proxy fallback
│       └── errors.ts      # VaultError class
└── types/                 # TypeScript domain types
```

---

## API Compatibility

Built against the OpenBao REST API. All LIST operations are sent as `GET ?list=true` (OpenBao convention). A 404 response on any LIST endpoint is treated as an empty result rather than an error, matching OpenBao's behavior of returning 404 when a path has no entries.

Tested against OpenBao v2.x. Should be compatible with HashiCorp Vault 1.13+ with minor differences in enterprise-only endpoints.
