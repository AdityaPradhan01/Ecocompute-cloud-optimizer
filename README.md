# Eco Compute Cloud Optimization Suite 🌱💰

A full-stack cloud infrastructure monitoring and sustainability platform. Ingest server metrics (CSV or a real AWS connection), classify utilization, estimate energy/carbon/cost, and get a ranked optimization queue — with one real, deliberately conservative action: stopping an idle EC2 instance it actually discovered.

## Features
- **Data intake:** upload a CSV snapshot, or connect a real AWS account.
- **Live AWS connections:** real `ec2:DescribeInstances` + CloudWatch `CPUUtilization`, not simulated data. See [Connecting AWS](#connecting-aws) below.
- **Detection sandbox:** live energy/carbon/cost calculator.
- **Optimization engine:** idle/underutilized/off-hours/zone-migration rules, plus a guarded real "shut down on AWS" action for live-discovered idle instances.
- **Analytics & reports:** trends, regional comparison, PDF export, audit trail.
- **Scheduled report emails:** save a recipient + cadence on the Reports screen; if SMTP is configured (see below), a real email with the PDF attached goes out automatically on the due date, or immediately via "Send now".
- **Single-admin auth:** the whole API is behind a login; nothing is reachable anonymously.
- **Lead capture:** the public Landing page's "Book a walkthrough" form saves to a Leads screen in-app (and optionally emails you), feeding the onboarding process below.
- **Installs like an app:** a PWA — icon on the desktop/Start menu/home screen, its own window (no browser chrome) — plus a real frameless, native desktop widget (Electron, in `electron/`) that docks to a screen edge with no title bar at all. See [Installing as a desktop app](#installing-as-a-desktop-app) and [The desktop widget](#the-desktop-widget-frameless-native) below.

## Installing as a desktop app

Honest framing first: a website can't place an icon on your desktop by itself. What it *can* do — and what this is — is a PWA (Progressive Web App), which Chrome and Edge can install as a real standalone app: its own window, its own icon in the Start menu/taskbar/dock, no address bar.

**To install (Chrome or Edge, desktop):**
1. Open the app and sign in.
2. Look for the install icon in the address bar (a small monitor-with-arrow icon), or open the browser's ⋮ menu → "Install EcoCompute Cloud Optimizer". The sidebar also has an **Install as app** button once the browser's made the option available.
3. Confirm. It now opens from your Start menu/dock like any other installed app.

**On Android (Chrome):** the browser menu offers "Add to Home Screen" / "Install app" the same way.

**On iOS (Safari):** Apple doesn't support the installable-PWA prompt at all — there is no programmatic "Install" button possible there, by design of the platform, not a limitation of this app. The only path is manual: Share → Add to Home Screen. It still launches full-screen without Safari's chrome once added.

**What you get once installed:**
- An animated splash screen on launch (plays once per session) while it confirms it can reach the data service.
- A **pop-out widget** (Sidebar → "Pop-out widget", or the `/widget` route directly) — a small live-metrics window you can keep open beside your other work, polling every 2 seconds. Opened as a browser popup this way, it keeps one thin native title bar — browsers never let a page remove that. For a real frameless widget, see below.
- Offline resilience for the app shell (navigating around still works without a connection); live numbers never come from a cache — `/api/*` requests are explicitly never cached, so you'll always either see the real current data or an honest "Backend offline" state, never stale numbers presented as current.

## The desktop widget (frameless, native)

The in-browser pop-out widget above still has a browser's title bar — no website can remove that, in any browser, by design (a page that could draw a borderless window could impersonate real OS chrome). The `electron/` folder is the real fix: a tiny separate desktop app — not a browser tab — that loads the exact same `/widget` UI in a genuinely frameless, transparent, always-on-top window docked to the edge of your screen. No title bar, no minimize/maximize/close buttons, no taskbar entry — just the floating card, indistinguishable from a native OS widget, because it isn't running inside a browser at all.

```bash
cd electron
npm install
npm start          # launches the widget; lives in the system tray (right-click for Show/Hide/Quit)
```

By default it points at `http://localhost:3000/widget` (the local dev server). To run it against a real deployed instance instead:

```bash
WIDGET_URL=https://your-frontend.onrender.com/widget npm start
```

It remembers where you last dragged it (a small JSON file in its own userData folder) and reopens there next time.

**Packaging a distributable:** `npm run dist` (`electron-builder` — portable `.exe` on Windows, `.dmg` on macOS, `AppImage` on Linux). On Windows, this needs either **Developer Mode enabled** (Settings → Privacy & security → For developers) or running the command as Administrator — electron-builder extracts a macOS code-signing tool into its cache even for a Windows-only build, and that archive contains symlinks, which plain Windows accounts can't create. Without one of those, `electron-builder` fails at the last step (bundling into one portable file) with a `Cannot create symbolic link` error — but it will have already produced a fully working app at `dist/win-unpacked/EcoCompute Widget.exe`, which runs identically; only the single-file packaging step is blocked.

## Deployment model: single-tenant per customer

This is a B2B tool sold to companies, not a self-serve multi-tenant SaaS. Each customer gets their **own** deployment — own backend, own database, own login, total data isolation, no tenant-filtering logic that could leak one customer's data into another's. Onboarding a new customer means provisioning a new instance, not them signing up on a shared one. See **[docs/CUSTOMER_ONBOARDING.md](docs/CUSTOMER_ONBOARDING.md)** for the exact, repeatable checklist, and `backend/scripts/new-customer-secrets.js` for generating a new customer's credentials in one shot.

## Tech stack
- **Frontend:** React, Recharts, Axios
- **Backend:** Node.js, Express, Mongoose, AWS SDK v3
- **Database:** MongoDB (Atlas in production)

## Local development

```bash
# backend
cd backend
npm install
cp .env.example .env   # then fill in the values below
npm run dev             # http://localhost:5000

# frontend, in a second terminal
cd frontend
npm install
npm start                # http://localhost:3000
```

### Required backend env vars

The server refuses to start if any of these are missing — see `backend/.env.example`.

| Var | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `CORS_ORIGINS` | comma-separated list of allowed frontend origins |
| `ADMIN_USERNAME` | the one admin login |
| `ADMIN_PASSWORD_HASH` | bcrypt hash — generate with `node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"` |
| `JWT_SECRET` | generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ENCRYPTION_KEY` | AES-256 key for stored cloud credentials — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | optional — only needed if you use "delegated role" AWS connections (see below) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | optional — only needed to actually deliver scheduled report emails (see below) |

### Verifying it actually works

```bash
cd backend
npm run smoke-test
```

Boots the real server against a throwaway in-memory MongoDB (no setup needed, nothing touches `MONGO_URI`) and exercises every route — auth, the full data pipeline, settings, connections, and the report-schedule/send-now guard. Runs in CI on every push; run it yourself before deploying if you've changed backend code.

### Frontend env var

`REACT_APP_API_URL` — the backend's URL (`frontend/.env.example`).

## Connecting AWS

The AWS card on the Connections screen is a real integration, not a demo. Two auth modes:

**Access key** — simplest. Create an IAM user with the read-only policy below, generate an access key, paste it in.

**Delegated role** — the app generates an External ID, you put it in your IAM role's trust policy (prevents the confused-deputy problem), then the *server's own* AWS identity (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` env vars) calls `sts:AssumeRole` into your role. This mode needs those two env vars set on the backend.

Minimum IAM policy to attach (read-only discovery + metrics):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ec2:DescribeInstances",
      "ec2:DescribeRegions",
      "ec2:DescribeTags",
      "cloudwatch:GetMetricStatistics",
      "sts:GetCallerIdentity"
    ],
    "Resource": "*"
  }]
}
```

Add `"ec2:StopInstances"` to that list only if you want the Optimize screen's "Shut down on AWS" button to work — it's the one place this app mutates real infrastructure, and it only ever calls `StopInstances` on an instance it classified as idle, after you type the instance's name to confirm.

Two numbers AWS doesn't publish, handled honestly rather than invented:
- **TDP** (power draw) — AWS never discloses this per-instance. Estimated from vCPU count (`backend/utils/awsPricing.js`), flagged `tdpSource: "estimated"` in every API response that uses it.
- **Cost** — uses AWS's public on-demand list price (not Cost Explorer, which most read-only roles can't reach), flagged `pricingSource: "aws-ondemand-list-price-approx"`. It will not match your actual invoice if you have Savings Plans/RIs/negotiated pricing.

## Scheduled report emails

The Reports screen lets you save an email + cadence (monthly/quarterly/yearly). What happens next depends on whether SMTP is configured:

- **Not configured** (no `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`): the schedule is saved and shown on screen, honestly labeled "SMTP not configured" — nothing is sent, and the "Send now" button is disabled.
- **Configured**: a background check (every 6 hours, plus once at boot) looks for schedules whose period has rolled over since they last sent, generates the same PDF report the screen would, and emails it as an attachment. The "Send now" button on any schedule bypasses the due-date wait so you can verify delivery immediately.

Any standard SMTP provider works — SendGrid, Mailgun, Amazon SES, Postmark, or a Gmail account with an [app password](https://support.google.com/accounts/answer/185833). Set the six `SMTP_*` vars (see `backend/.env.example`) and redeploy the backend.

## Deploying

**Recommended: Render + MongoDB Atlas.**

1. Create a free MongoDB Atlas cluster, get its connection string → `MONGO_URI`.
2. Push this repo to GitHub, connect it in Render, and let it read `render.yaml` (two services: `ecocompute-backend`, `ecocompute-frontend`).
3. Fill in every env var marked `sync: false` in the Render dashboard for the backend service (see table above). `JWT_SECRET` is auto-generated for you. The `SMTP_*` vars are optional — leave them blank to skip report emails for now, fill them in later to turn delivery on without any other change.
4. Once the backend service has a URL, set the frontend's `REACT_APP_API_URL` to it, and the backend's `CORS_ORIGINS` to the frontend's URL. Redeploy both.
5. Confirm `https://<backend>.onrender.com/api/health` returns `{"status":"ok"}`.

**Alternative: Docker Compose**, for a local sanity check before touching Render (not how this runs in real production — Mongo-in-a-container isn't where you want production data):

```bash
docker compose up --build
# frontend: http://localhost:8080, backend: http://localhost:5000
```

## Security notes

- The entire `/api` surface requires a Bearer JWT except `/api/auth/login` and `/api/health`.
- Cloud credentials are encrypted at rest (AES-256-GCM), never logged or returned by any endpoint.
- Rate limiting on the general API, login, and connection-test endpoints.
- CSV upload is capped at 5MB and restricted to `.csv` files.
- The one action that touches real infrastructure (`StopInstances`) requires a typed confirmation and only applies to an idle instance this app itself discovered via a live connection.
