# Trans Bodanon — Go-Live Handover Document

**Project:** Trans Bodanon — International Transport Management System  
**Version:** 2.0.0 (Next.js)  
**Go-Live Date:** September 2026  
**Prepared for:** Company Owner & IT Administrators  

---

## Table of Contents

1. [Environment Summary](#1-environment-summary)
2. [Production & Staging Access](#2-production--staging-access)
3. [Supabase Project Access & Backups](#3-supabase-project-access--backups)
4. [Vercel Dashboard & Environment Variables](#4-vercel-dashboard--environment-variables)
5. [Admin Login Credentials](#5-admin-login-credentials)
6. [Deployment Workflow](#6-deployment-workflow)
7. [Sentry Monitoring](#7-sentry-monitoring)
8. [Troubleshooting Guide](#8-troubleshooting-guide)
9. [Rollback Procedure](#9-rollback-procedure)
10. [Contact & Support](#10-contact--support)

---

## 1. Environment Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.3.3 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v4 |
| UI Components | Shadcn UI (Radix primitives) |
| Auth / Database | Supabase (PostgreSQL + Auth + Storage) |
| Data Fetching | @tanstack/react-query (v5) |
| State Management | Zustand v5 |
| i18n | next-intl (Arabic / French / English) |
| PWA | next-pwa + Workbox |
| Error Monitoring | @sentry/nextjs v10 |
| Maps | React Leaflet / Leaflet |
| PDF | HTML-to-PDF via `react-pdf`/`puppeteer` stack |
| OCR | Tesseract.js (fuel receipts) |
| WhatsApp | Meta Cloud API v20.0 |

---

## 2. Production & Staging Access

| Environment | URL | Purpose |
|------------|-----|---------|
| **Production** | `https://app.transbodanon.ma` | Live system for all users |
| **Staging** | `https://staging.transbodanon.vercel.app` | Pre-production testing |
| **Supabase Project** | `https://app.supabase.com/project/_/dashboard` | Database & Auth management |
| **Sentry** | `https://sentry.io/organizations/trans-bodanon/` | Error monitoring dashboard |
| **Vercel** | `https://vercel.com/trans-bodanon/international-transport-next` | Deployment & domains |

> **DNS:** The custom domain `app.transbodanon.ma` is configured in Vercel under **Settings > Domains**. DNS must point a CNAME record to `cname.vercel-dns.com`.

---

## 3. Supabase Project Access & Backups

### Accessing the Supabase Dashboard

1. Navigate to **https://app.supabase.com/projects**.
2. Locate the **`jgehdsmrmcpnvcnfrjai`** project (Trans Bodanon).
3. Use the credentials provided by the development team. Enable SSO / 2FA if available.

### Key Areas

| Area | Location in Dashboard | What to Do |
|------|----------------------|------------|
| **API Keys** | Settings > API | View/copy the `anon public` and `service_role` keys |
| **Auth Users** | Authentication > Users | Reset passwords, disable compromised accounts, view login history |
| **Database** | SQL Editor | Run ad-hoc queries, inspect schemas |
| **Table Editor** | Table Editor | Browse/edit data directly (use with caution) |
| **Storage** | Storage > Buckets | Inspect `fuel-receipts`, `delivery-proofs`, invoice documents |
| **Logs** | Logs | Monitor Postgres and Auth logs for errors |

### Storage Buckets in Production

| Bucket | Used For | Public Access |
|--------|----------|--------------|
| `fuel-receipts` | Driver fuel receipt images | Public |
| `delivery-proofs` | E-POD signatures & CMR images | Public |
| `invoices` | E-invoice PDF documents | Public (planned) |
| `fleet-docs` | Truck & driver document images | Public |

### Backup Policies

Supabase provides **automated daily backups** at **03:00 UTC** with a retention of **7 days**.

| Backup Type | Schedule | Retention | Notes |
|-------------|----------|-----------|-------|
| **Physical Backup (PITR)** | Continuous (WAL) | 7 days | Point-in-time recovery via Dashboard |
| **Logical Backup** | Daily at 03:00 UTC | Indefinite (manual) | Generate manually via SQL Editor |

#### Restoring from Backup (Emergency)

1. Go to **Supabase Dashboard > Settings > Backups**.
2. Select the **"Daily"** tab.
3. Click **"Restore to new project"** for the desired timestamp.
4. Update the new project's URL and keys in Vercel Environment Variables.
5. Redeploy: push an empty commit (`git commit --allow-empty -m "trigger redeploy"`) to trigger Vercel.

#### Manual Full Export (Recommended Weekly)

```bash
# Via Supabase CLI
supabase db dump --schema public --data-only > backup_$(date +%Y%m%d).sql

# Via psql
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner > backup_$(date +%Y%m%d).dump
```

Store exported backups in an **encrypted** off-site location (e.g., company Google Drive or AWS S3 with versioning).

---

## 4. Vercel Dashboard & Environment Variables

### Environment Variables Reference

All production secrets must be configured in **Vercel Dashboard > Settings > Environment Variables**. Below is the full list (also templated in `.env.production`):

| Variable | Scope | Required | Description |
|----------|-------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + Server | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + Server | Yes | Supabase anonymous JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Yes | Bypasses RLS; used in Server Actions & API routes |
| `NEXT_PUBLIC_APP_URL` | Browser + Server | Yes | Canonical app URL (e.g. `https://app.transbodanon.ma`) |
| `NEXT_PUBLIC_SITE_URL` | Browser + Server | Yes | Used for sign-out redirects |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser | Recommended | Sentry client DSN |
| `SENTRY_DSN` | Server | Recommended | Sentry server DSN |
| `WHATSAPP_API_TOKEN` | Server | Recommended | Meta Cloud API long-lived token |
| `WHATSAPP_PHONE_NUMBER_ID` | Server | Recommended | WhatsApp Business phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Server | Recommended | Meta Business Account ID |
| `WHATSAPP_VERIFY_TOKEN` | Server | Recommended | Webhook verification token |
| `GPS_WEBHOOK_SECRET` | Server | Recommended | Secret for GPS tracking webhook (`x-gps-secret` header) |
| `OCR_API_KEY` | Server | Optional | OCR provider API key |
| `PDF_SIGNING_KEY` | Server | Optional | PDF digital signing key |

> **Critical:** Set each variable in Vercel with **Environment = Production** (and Staging/Development as needed). Server-only variables (no `NEXT_PUBLIC_` prefix) must **never** be exposed in the browser bundle.

### Function Memory & Timeout (vercel.json)

Heavy serverless functions (PDF generation, invoice export) are configured in `vercel.json` with:

| Route Pattern | Memory | Max Duration |
|---------------|--------|-------------|
| `/api/pdf/**` | 1024 MB | 60 s |
| `/api/invoices/**` | 1024 MB | 60 s |
| `/api/**` (default) | 512 MB | 30 s |

To adjust: edit `vercel.json` → `functions` section → redeploy.

---

## 5. Admin Login Credentials

Default credentials are seeded via `supabase/seed.sql`. These accounts are created in the Supabase Auth provider; use them to log in to the production dashboard.

> **Security note:** Change all default passwords immediately after first login via **Supabase Dashboard > Authentication > Users** or the app's "Reset Password" flow.

| Role | Email | Default Password | Notes |
|------|-------|------------------|-------|
| **Admin** | `admin@transbodanon.ma` | `TransB0d@non!2026` | Full system access — assign only to trusted IT admins |
| **Secretary** | `secretary@transbodanon.ma` | `Secr3tary!2026` | Trip, treasury, invoicing, fleet, reports |
| **Driver** | `driver1@transbodanon.ma` | `Dr1ver2026!` | Driver tasks, advances, fuel receipts |

### How to Reset a Password

1. Go to the app login page: `https://app.transbodanon.ma/login`.
2. Click **"Forgot Password"**.
3. Enter the user's email address.
4. Check the inbox (and spam folder) for the reset email from Supabase Auth.
5. Follow the link and set a new password.

Alternatively, an admin can reset passwords directly from the **Supabase Dashboard > Authentication > Users** table.

---

## 6. Deployment Workflow

### Automatic (Recommended)

The project is connected to GitHub via **Vercel Git Integration**. Every push to the `main` branch triggers:

1. **Pre-flight check** (`scripts/pre-flight-check.js`) — validates env vars & tests Supabase connectivity.
2. **ESLint** — code quality check (via GitHub Actions).
3. **Next.js build** — SSR, static generation, PWA assets.
4. **Sentry source maps upload** — automatically handled by `@sentry/nextjs`.
5. **Deploy** — Vercel deploys to production.

### Manual Deploy via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Link project (one-time)
vercel link

# Deploy to production
vercel --prod
```

### Staging Deploy

```bash
git checkout -b staging
git push origin staging
# Vercel auto-deploys preview URLs for every push to non-main branches.
```

---

## 7. Sentry Monitoring

Sentry is configured for both server and client with `@sentry/nextjs`.

### Configuration

| File | Scope | DSN |
|------|-------|-----|
| `sentry.server.config.ts` | Server | `SENTRY_DSN` |
| `sentry.client.config.ts` | Browser | `NEXT_PUBLIC_SENTRY_DSN` |

### Sampling Rates

| Metric | Rate |
|--------|------|
| Server traces | 10% (`tracesSampleRate: 0.1`) |
| Client traces | 10% (`tracesSampleRate: 0.1`) |
| Session replay | 10% (`replaysSessionSampleRate: 0.1`) |
| Error replay | 100% (`replaysOnErrorSampleRate: 1.0`) |

### Viewing Errors

1. Navigate to **https://sentry.io/organizations/trans-bodanon/**.
2. Use the **"Issues"** tab to browse grouped error types.
3. Use the **"Traces"** tab for performance profiling.
4. Alerts are configured for production errors exceeding 100 occurrences in 5 minutes.

---

## 8. Troubleshooting Guide

### 8.1 PDFs Fail to Generate

**Symptom:** Downloading an invoice PDF or E-POD shows a blank page, errors in console, or a 500 error.

**Diagnostic Steps:**
1. **Check Sentry:** Go to Sentry > Issues and search for `pdf` or `puppeteer`.
2. **Test API endpoint:** `curl -X POST https://app.transbodanon.ma/api/pdf/invoice?id=1`
3. **Verify function memory:** PDF routes (`/api/pdf/**`) are configured for 1024 MB in `vercel.json`. If the payload is unusually large, increase to 2048 MB.

**Quick Fixes:**
- Restart the deployment: Vercel Dashboard > Deployments > Redeploy.
- Check Supabase Storage connectivity for document URLs referenced in the invoice.
- Ensure the `bank_accounts` and `clients` tables contain the referenced records.

### 8.2 WhatsApp Messages Not Sending

**Symptom:** In-app "Send WhatsApp" returns an error: "إعدادات WhatsApp Cloud API غير مكتملة في متغيرات البيئة."

**Diagnostic Steps:**
1. Verify in Vercel that `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_VERIFY_TOKEN` are set for the **Production** environment.
2. Check token expiry: Meta long-lived tokens expire after **60 days**. Use the **Graph API Explorer** to verify:
   ```
   GET /v20.0/{phone-number-id}?fields=display_name
   ```
3. Test the webhook endpoint directly:
   ```
   GET https://app.transbodanon.ma/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test
   ```

### 8.3 Rotating WhatsApp API Keys

1. Go to **developers.facebook.com** → your app → **Tools > Access Token**.
2. Generate a new **long-lived token** (60-day expiry).
3. In **Vercel Dashboard > Settings > Environment Variables**, update `WHATSAPP_API_TOKEN` for all environments.
4. **Redeploy** the production deployment.
5. Optionally set up a **cron job** to proactively rotate tokens before expiry.

### 8.4 GPS Tracking Webhook Failing

**Symptom:** Truck locations not updating in real-time.

**Diagnostic Steps:**
1. Verify `GPS_WEBHOOK_SECRET` is set in Vercel.
2. Ensure the GPS device sends the `x-gps-secret` header matching the secret.
3. Check the GPS device's payload format matches the expected JSON schema (`plate_number`, `latitude`, `longitude`, `timestamp`).
4. Check Supabase `truck_locations` table for recent entries.

### 8.5 Supabase Connection Errors (Build Failures)

**Symptom:** The `pre-flight-check.js` script fails with "could not reach the database."

**Diagnostic Steps:**
1. Verify `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are all set correctly in Vercel.
2. Test the keys manually:
   ```bash
   curl https://<project-ref>.supabase.co/rest/v1/users?select=count -H "apikey: <anon-key>" -H "Authorization: Bearer <service-role-key>"
   ```
3. Check if the Supabase project is paused (it auto-pauses after 7 days of inactivity on the free tier). Unpause via Dashboard > Settings > Database.
4. Verify the database is not at capacity (max connections).

### 8.6 PWA Offline Sync Not Working

**Symptom:** Drivers report that offline actions (fuel receipts, E-POD signing) do not sync when connectivity is restored.

**Diagnostic Steps:**
1. Clear browser cache and re-register the service worker (check DevTools > Application > Service Workers).
2. Check the `pending_updates` table in Supabase for queued sync records.
3. Verify the `sync` mechanism in `src/lib/offline-sync.ts` is running on app startup.

### 8.7 Role-Based Access Issues

**Symptom:** A user sees "Access Denied" or is redirected to login on a page they should be able to access.

**Diagnostic Steps:**
1. Check the user's `role` in **Supabase Dashboard > Table Editor > users** table.
2. Verify the role is one of: `admin`, `secretary`, `driver`.
3. The allowed routes per role are defined in `src/lib/rbac.ts` and enforced in `middleware.ts`.

---

## 9. Rollback Procedure

If a production deployment causes critical issues:

### Option A: Vercel Rollback (Fastest)

1. Go to **Vercel Dashboard > Deployments**.
2. Find the previous working deployment (green checkmark).
3. Click **"..." → "Promote to Production"**.

### Option B: Git Revert

```bash
git revert <bad-commit-hash>
git push origin main
# Vercel automatically redeploys with the reverted code.
```

### Option C: Database Rollback (If data corruption occurs)

1. Go to **Supabase Dashboard > Settings > Backups**.
2. Select a **Point-in-Time Recovery (PITR)** backup from before the incident.
3. Restore to a new project.
4. Update Vercel Environment Variables with the restored project's keys.
5. Redeploy.

---

## 10. Contact & Support

| Concern | Contact |
|---------|---------|
| Application errors & monitoring | Sentry dashboard (see §7) |
| Database / Auth issues | Supabase Dashboard > Logs |
| Deployment / hosting | Vercel Support: https://vercel.com/support |
| Business / feature questions | IT Administrator, Trans Bodanon |
| Emergency (after-hours) | +212 5 39 00 00 00 (IT Helpdesk) |

---

*Document generated as part of Step 15: Go-Live, Vercel Deployment & Handover.*  
*Last updated: September 2026*
