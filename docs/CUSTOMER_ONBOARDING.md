# Customer onboarding runbook

EcoCompute is deployed **single-tenant per customer**: each B2B customer gets
their own backend, their own MongoDB database, and their own admin login —
total data isolation, no shared state, no tenant-filtering logic to get
wrong. The tradeoff is that onboarding a new customer means provisioning a
new instance rather than them self-serve signing up. This doc is the exact,
repeatable process for that, so it stays a 15-minute checklist instead of a
one-off favor you have to remember how to do each time.

If you outgrow this model (dozens of customers, self-serve signup needed),
that's a real rebuild — a tenant/organization data model, not a tweak to
this process. Cross that bridge when the operational cost of running N
separate instances actually becomes the bottleneck, not before.

## Where leads come from

The public Landing page's "Book a walkthrough" button opens a form that
posts to `POST /api/leads` (no auth, rate-limited, honeypot-guarded — see
`backend/controllers/leadsController.js`). Submissions land in the **Leads**
screen inside the app (`/app/leads`) on whichever deployment is running the
public marketing site. Set `LEADS_NOTIFY_EMAIL` (plus SMTP — see README) on
that deployment if you want an email the moment one comes in instead of
checking the screen.

A customer's own dedicated instance also has this same Leads screen — it'll
just stay empty there, since nobody outside your sales motion sees that
instance's URL. Harmless, not worth hiding.

## Provisioning a new customer

1. **MongoDB Atlas** — create a new free-tier (or paid, if their data volume
   needs it) cluster. Get its connection string. This is the customer's
   database and nobody else's.
2. **Generate secrets** — from `backend/`:
   ```bash
   node scripts/new-customer-secrets.js "<a strong password>" "<customer>-admin"
   ```
   Prints `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`,
   `ENCRYPTION_KEY` ready to paste into Render, and the plaintext
   username/password to hand to the customer separately (Slack DM, a
   password manager share link — not the same email thread as the Render
   invite).
3. **Render** — connect this repo (or a customer-specific branch, if they
   need custom branding later) as a new Blueprint. Render reads
   `render.yaml` and proposes two services; rename them with the customer's
   slug (e.g. `acmecorp-backend`, `acmecorp-frontend`) before creating.
4. **Fill in env vars** on the backend service: `MONGO_URI` (step 1),
   `CORS_ORIGINS` (the frontend URL Render just assigned — fill in after
   step 5 and redeploy), the four values from step 2, and optionally the
   `SMTP_*` / `AWS_*` vars if this customer wants report emails or a
   delegated-role AWS connection from day one.
5. **Fill in** `REACT_APP_API_URL` on the frontend service to the backend's
   Render URL, then go back and set the backend's `CORS_ORIGINS` to the
   frontend's URL. Redeploy both.
6. **Verify** — `https://<customer>-backend.onrender.com/api/health` should
   return `{"status":"ok","db":"connected"}`. Log in with the credential
   from step 2. If anything's off, run `npm run smoke-test` locally against
   the same `MONGO_URI` to isolate whether it's a data issue or a deploy
   issue.
7. **Hand off** — send the customer their URL + username (separately, the
   password). Mark the lead `provisioned` on the Leads screen.
8. **Decide their first data source** with them on the kickoff call: upload
   a CSV of their fleet, or walk them through connecting a real AWS account
   (Connections screen — see README's "Connecting AWS" section for the IAM
   policy they'll need).
9. **Offer the desktop widget**, if they want always-visible live metrics:
   the `electron/` app (see README's "The desktop widget" section) points
   at `WIDGET_URL` — for a customer deployment that's their frontend's
   `/widget` route, not localhost. They'd run it themselves, pointed at
   their own instance; it isn't something you host for them.

## What you're tracking yourself

There's no central registry of "which customer has which URL" built into
the app (it would need to live somewhere a customer's own instance can't
see, which is a different system). Keep a simple list wherever you already
track deals — a spreadsheet row per customer with their Render service
names and Atlas cluster name is enough at this stage.
