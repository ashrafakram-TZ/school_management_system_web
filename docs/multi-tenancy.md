# Multi-tenancy — Admin web (frontend)

The build spec for the React admin web once the API is multi-tenant. Read the backend spec first: `C:\Users\DELL\Telematics\docs\multi-tenancy.md` (words, URLs, error codes, endpoints). This file covers only the web.

Reference that already works: `C:\Users\DELL\NOOL360\softsilk_web` (`src/lib/tenant.ts`, `src/lib/api.ts`, `src/admin/pages/Tenants/*`). We keep its idea (one build, the subdomain decides tenant vs admin console) and improve it: allowed domains come from `.env` instead of code, there is one header (`x-tenant-id`), and the console is its own route tree.

Telematics console is out of scope.

---

## 1. One build, three kinds of host

The same `dist/` is served on every host. At start the app reads `window.location.hostname` and mounts one of three apps:

| Host | Mounts | Example (local) | Example (live) |
|---|---|---|---|
| `<code>.<base>` | **School app** (today's app) for that tenant | `http://srividya.localhost:5173` | `https://srividya.tamilzorous.com` |
| `admin.<base>` | **Platform console** (Tamilzorous staff) | `http://admin.localhost:5173` | `https://admin.tamilzorous.com` |
| `<base>` (bare) or `www.<base>` | **Workspace finder**: type your code, get redirected | `http://localhost:5173` | `https://tamilzorous.com` |

Any other host (wrong base, reserved label) shows the "This address is not a school workspace" page with a link to the finder.

| Environment | `.env` |
|---|---|
| Local | `VITE_BASE_DOMAIN=localhost` |
| Dev | `VITE_BASE_DOMAIN=dev.tamilzorous.com` |
| Live | `VITE_BASE_DOMAIN=tamilzorous.com` |

Add to `.env.example`:

```
VITE_BASE_DOMAIN=localhost
VITE_PLATFORM_SUBDOMAIN=admin
```

Protocol and port are never configured: links are built from `window.location.protocol` and `window.location.port`, so local stays `http://…:5173` and dev/live stay `https://` automatically.

---

## 2. `src/lib/tenant.ts`

```ts
import { config } from '@/config/env'

export type HostKind =
  | { kind: 'tenant'; code: string }
  | { kind: 'platform' }
  | { kind: 'finder' }
  | { kind: 'invalid' }

const RESERVED = new Set(['www', 'api', 'app', 'static', 'assets', 'cdn', 'files', 'docs', 'mail', 'tenant', 'signup', 'login', 'help', 'support', 'status', 'platform'])
const CODE = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/

export function readHost(hostname = window.location.hostname): HostKind {
  const host = hostname.toLowerCase()
  const base = config.baseDomain
  if (host === base || host === `www.${base}`) return { kind: 'finder' }
  if (!host.endsWith(`.${base}`)) return { kind: 'invalid' }
  const label = host.slice(0, -(base.length + 1))
  if (label === config.platformSubdomain) return { kind: 'platform' }
  if (label.includes('.') || RESERVED.has(label) || !CODE.test(label)) return { kind: 'invalid' }
  return { kind: 'tenant', code: label }
}

export const tenantCode = () => {
  const host = readHost()
  return host.kind === 'tenant' ? host.code : null
}

export function workspaceUrl(code: string, path = '/') {
  const { protocol, port } = window.location
  return `${protocol}//${code}.${config.baseDomain}${port ? `:${port}` : ''}${path}`
}

export const platformUrl = (path = '/') => workspaceUrl(config.platformSubdomain, path)
```

- `config/env.ts` gains `baseDomain` (lowercase, required) and `platformSubdomain` (default `admin`).
- Keep the regex and the reserved list identical to the backend (`tenant-code.ts`). A unit test compares them with a shared fixture list.

---

## 3. HTTP client and sockets

### `src/lib/api/client.ts`
Add the header to **every** request, including the public auth paths (the API needs the tenant to find the user):

```ts
http.interceptors.request.use((request) => {
  const code = tenantCode()
  if (code) request.headers.set('x-tenant-id', code)
  const current = session.get()
  if (current && !PUBLIC_PATHS.includes(request.url ?? '')) {
    request.headers.set('Authorization', `Bearer ${current.accessToken}`)
    const schoolId = schoolContext.get()
    if (schoolId) request.headers.set('X-School-Id', String(schoolId))
  }
  return request
})
```

The raw `axios.post` used for `/auth/refresh` must also send `x-tenant-id`.

### Platform console client
A separate axios instance `src/platform/lib/platform-client.ts`, base `/api/v1/platform`, its own session store `platformSession` (key `tz.platform.session`), its own refresh. **Never** sends `x-tenant-id` and never shares tokens with the school app.

### `src/lib/live/socket.ts`
`io(url, { auth: { token, tenant: tenantCode() } })`. Nothing else changes; rooms are prefixed by the server.

### Storage
Each subdomain is its own browser origin, so `localStorage` and cookies are already separated per tenant. No key changes needed. Signing in to `alpha` and `beta` in two tabs works.

---

## 4. Boot sequence (`src/main.tsx` / app root)

```
readHost()
 ├─ invalid  → <InvalidHostPage/>
 ├─ finder   → <WorkspaceFinderPage/>
 ├─ platform → <PlatformApp/>            (separate router tree, src/platform/*)
 └─ tenant   → GET /tenants/resolve?code=<code>
                 ├─ 404 TENANT_NOT_FOUND     → <WorkspaceNotFoundPage code/>
                 ├─ status suspended          → school app, sign-in allowed, then gate (section 6)
                 ├─ status provisioning/failed → <WorkspaceNotReadyPage/>
                 └─ active                    → school app (today's router)
```

- `useTenant()` (TanStack Query, `staleTime: Infinity`) holds `{ code, name, logo_url, status }`. The sign-in page shows the group logo and name ("Sri Vidya Educational Trust") above the mobile field.
- Document title: `${tenant.name} · ${VITE_APP_NAME}`.
- While resolving, show the existing full-page skeleton, not a blank page.

---

## 5. Workspace finder (bare host)

Route `/` on the finder host. One input "Workspace code" with a `.tamilzorous.com` suffix shown as an adornment (from `VITE_BASE_DOMAIN`), and a "Continue" button.

- Validate with the shared regex as the user types (lowercase on input).
- On submit: `GET /tenants/resolve?code=` → found → `window.location.assign(workspaceUrl(code, '/sign-in'))`. Not found → field error "No school workspace with this code".
- Remember the last 3 codes in `localStorage` (`tz.recent_workspaces`) as quick buttons (wrap in try/catch).
- Responsive, dark mode, keyboard: Enter submits.

---

## 6. Subscription in the school app

### Data
`GET /me/subscription` (query key `['me','subscription']`, refetch every 10 minutes and on window focus). `GET /me` now returns `features: string[]`.

### Banner (top of the app shell, above the page header)
| Condition | Banner | Tone |
|---|---|---|
| `trialing`, `days_left ≤ 7` | "Free trial ends in 5 days." + "View plan" (group admin) | info |
| `past_due` | "Payment overdue. Access stops on 21 Nov." + "View invoices" | warning |
| over a limit | "Student limit reached (500/500). Contact Tamilzorous to upgrade." | warning |

Dismiss stores the banner key + day in `sessionStorage` (try/catch). Non-admin users see only the past-due text without the button.

### Blocked screen
The axios response interceptor watches for `403` with `TENANT_SUSPENDED`, `TRIAL_ENDED`, `SUBSCRIPTION_CANCELLED` and switches the whole app to `<SubscriptionBlockedPage/>`:

- Group admin: reason, plan, unpaid invoices list with **Download PDF**, Tamilzorous contact (phone, email, from `/me/subscription`), "Sign out".
- Everyone else: "Your school's subscription is inactive. Please contact the school office." + "Sign out".

Other codes:
| Code | Web behaviour |
|---|---|
| `TENANT_MISMATCH` | Clear the session, go to sign-in |
| `TENANT_NOT_FOUND`, `TENANT_REQUIRED` | `<WorkspaceNotFoundPage/>` |
| `TENANT_NOT_READY` | `<WorkspaceNotReadyPage/>` |
| `PLAN_LIMIT_REACHED` | Error toast with the server message; field errors as usual |
| `FEATURE_NOT_IN_PLAN` | Toast "This module is not in your plan" |

### Features
- `src/app/nav.ts`: every nav item gets an optional `feature` (`transport`, `fees`, `payroll`, `exams`, `meetings`, `chat`, `diary`, `announcements`, `achievements`, `id_cards`, `staff_attendance`). Hidden when `me.features` lacks it. Same check in the command palette and keyboard shortcuts (`g …`): a hidden module's shortcut does nothing.
- Route `beforeLoad` redirects to `/` when the feature is missing (direct URL typing).

### Billing page (group admin, permission `billing.view`)
`/billing`: plan card (name, cycle, renewal date, limits with usage bars), invoices table (number, period, total, status badge, **PDF** button), payments table (receipt **PDF**). Filters with searchable Combobox (status, financial year). Read only: payment is recorded by Tamilzorous.

---

## 7. Platform console (`admin.<base>`)

A separate route tree under `src/platform/`, same design system (Page, PageHeader, InsightCards, ListToolbar, SearchBox, Combobox, AppModal, ConfirmDialog, Badge), same dark mode and responsive rules, its own nav and shortcuts registry.

```
src/platform/
  platform-app.tsx         router + providers
  lib/platform-client.ts   axios, session, refresh
  features/
    auth/                  OTP sign-in (same UI as the school app, different API)
    dashboard/             cards: tenants by status, trials ending in 7 days, overdue invoices, MRR
    tenants/               list, create wizard, detail, provisioning progress
    plans/                 list, form
    subscriptions/         change plan, extend trial, cancel
    invoices/              list, detail, record payment, void, PDF
    admins/                platform admins (owner only)
    audit/                 audit log
```

### 7.1 Tenants list `/tenants`
- Insight cards: Active, Trial, Past due, Suspended, Provisioning/Failed (click = filter).
- Search: name, code, contact mobile. Filters (Combobox): status, plan.
- Columns: name + code, workspace link (opens `workspaceUrl(code)` in a new tab), plan, status badge, branches/students usage, trial or renewal date, actions.

### 7.2 Create tenant wizard `/tenants/new` (AppModal size `xl` or full page, 4 steps)
1. **Group:** name, legal name, **workspace code** with live check (`GET /platform/tenants/check-code`, debounced 400 ms) and a live preview of the URL `https://srividya.tamilzorous.com` built with `workspaceUrl()`. Suggest the code from the name (lowercase, hyphens, trimmed to 30).
2. **Billing:** GSTIN (format check), address, state (searchable Combobox of Indian states → `billing_state_code`), contact name/mobile/email.
3. **Plan:** plan cards, cycle (monthly/yearly), "Start with a 30-day free trial" switch, price preview with GST.
4. **First branch and group admin:** branch name, code, city; admin name, mobile (`IsMobile` rule), email.

Review → **Create and provision** → `POST /platform/tenants` then `POST /platform/tenants/:id/provision` → open the progress view.

Client validation mirrors the server; server field errors map back to the step that owns the field (jump to it).

### 7.3 Provisioning progress
Poll `GET /platform/provisioning-jobs/:id` every 2 s until `completed` or `failed`. Show the 10 steps with icons (pending, running spinner, done, failed with the error), a progress bar and elapsed time. On success: workspace URL (copy button), "Open workspace", "Send welcome again". On failure: the error and **Retry** (owner only). Leaving the page is safe; the tenant detail page shows the same view while a job is running.

### 7.4 Tenant detail `/tenants/$id`
Tabs: **Overview** (status, URL, contact, usage, schema status `up to date` / `2 pending`), **Subscription** (current plan, history timeline, change plan, extend trial, cancel), **Invoices** (list, PDF, record payment), **Activity** (audit rows). Header actions: Suspend / Reactivate (reason required, ConfirmDialog), Archive (owner, type the code to confirm), Delete (only `draft`/`failed`).

### 7.5 Plans `/plans`
Table + AppModal form: code, name, monthly/yearly price, limits (empty = unlimited), features (multi-select checklist), public, status. Retiring a plan never affects current subscribers (show the count).

### 7.6 Invoices `/invoices`
Insight cards: Issued, Overdue, Paid this month, Void. Filters: status, tenant (Combobox with `onSearch`), financial year. Detail drawer: lines, tax split, payments, **Download PDF**, **Record payment** (amount, date, method Combobox, reference; amount ≤ balance), **Void** (reason).

PDF downloads use the existing blob download helper with the server filename.

### 7.7 Console shortcuts
`g t` tenants, `g p` plans, `g i` invoices, `g a` admins, `alt+n` new tenant (on the tenants page). Registered in the platform shortcuts registry only, so they never clash with the school app.

---

## 8. Dev setup

- `vite.config.ts`: `server.allowedHosts: ['.localhost']` and `preview.allowedHosts: ['.localhost']` (Vite blocks unknown hosts otherwise). Keep `host: true`.
- The `/api` proxy is unchanged: `srividya.localhost:5173/api/v1/...` → `localhost:3000`. Same-origin, no CORS locally.
- Open `http://demo.localhost:5173` for today's data, `http://admin.localhost:5173` for the console, and `http://localhost:5173` for the finder. No hosts-file edits.
- Dev/live nginx: `server_name *.dev.tamilzorous.com dev.tamilzorous.com;` with `try_files $uri /index.html;` and the wildcard certificate. The same build for every subdomain.

---

## 9. Tests

### Jest (unit)
- `tenant.test.ts`: `readHost` for `srividya.localhost`, `admin.localhost`, `localhost`, `www.tamilzorous.com`, `a.b.tamilzorous.com` (invalid), `evil-tamilzorous.com` (invalid), uppercase hosts, reserved labels; `workspaceUrl` keeps protocol and port; regex and reserved list match the backend fixture.
- Client interceptor sends `x-tenant-id` on public and private paths and never on the platform client.
- Banner logic: each state → the right text and tone; dismiss per day.
- Wizard: code suggestion from the name; step validation; server field error → step.
- Nav filtering by `features`.

### Regression (`npm run test:regression`)
- Existing suites run unchanged against `http://demo.localhost:5173` (update the base URL in `e2e/*.mjs` to come from `REGRESSION_TENANT`, default `demo`).
- New `e2e/platform-regression.mjs`:
  1. Console sign-in on `admin.localhost`.
  2. Wizard validations (bad code, reserved code, taken code, GSTIN, mobile) and a successful create with progress reaching 100%.
  3. Open the new workspace URL → the sign-in page shows the group name → group admin signs in → only one branch.
  4. Two tabs on `alpha` and `beta`: create a student in alpha and check that it never appears in beta.
  5. Suspend beta in the console → beta tab shows the blocked page on next action → reactivate → works.
  6. Plan without `transport` → Transport menu hidden, direct URL redirects.
  7. Invoice PDF download returns `application/pdf`; record payment → status Paid.
  8. Finder: wrong code shows the error, right code redirects.
- Update the test tracker and both task Excels after the run (standing rule).

---

## 10. Order of work

| Step | Work | Days |
|---|---|---|
| 1 | `tenant.ts`, env, host router, client header, socket auth, finder, not-found/not-ready pages | 1 |
| 2 | Subscription banner, blocked page, feature-based nav/routes, billing page | 1 |
| 3 | Console shell, auth, tenants list, wizard, provisioning progress | 1.5 |
| 4 | Tenant detail, plans, subscriptions, invoices, admins, audit | 1.5 |
| 5 | Unit tests, regression suites, fixes | 1 |
| | **Frontend total** | **≈ 6 days**, alongside the backend |

## 11. Done means

- [ ] `demo.localhost:5173` works exactly like today; the full existing regression passes.
- [ ] `admin.localhost:5173` creates a tenant end to end, and the new `<code>.localhost:5173` URL works immediately.
- [ ] The same build on dev and live gives `https://<code>.dev.tamilzorous.com` and `https://<code>.tamilzorous.com` with only `VITE_BASE_DOMAIN` changed.
- [ ] Suspended, trial-ended, not-found and not-ready each show their own page; nobody sees a blank screen or a raw error.
- [ ] Hidden modules are hidden in the nav, the shortcuts and the command palette, and are blocked by direct URL.
- [ ] Invoice and receipt PDFs download from both the console and the group admin's billing page.
- [ ] Every dropdown is a searchable Combobox, every page is responsive and dark-mode correct, no code comments.
