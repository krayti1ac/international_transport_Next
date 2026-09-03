# Technical Architecture Documentation

**Trans Bodanon — International Transport Management System**
**Migration: Flutter → Next.js 15 + Supabase**
**Date:** September 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Schema Summary](#2-database-schema-summary)
3. [Role-Based Access Control (RBAC)](#3-role-based-access-control-rbac)
4. [Key Algorithms](#4-key-algorithms)
5. [Integrations](#5-integrations)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Offline & PWA](#7-offline--pwa)
8. [Security & Compliance](#8-security--compliance)
9. [Deployment](#9-deployment)

---

## 1. System Overview

Trans Bodanon is an international transport management system built to manage the full lifecycle of cross-border freight operations. The system replaces a legacy Flutter application with a modern Next.js 15 stack.

### Core Modules

| Module | Responsibility |
|--------|---------------|
| **Trips** | Create outbound/return trip orders, assign drivers, track transit stages |
| **Finance** | Invoicing, E-invoicing with QR codes, client payments |
| **Treasury** | Bank accounts, cash boxes, balance tracking, reconciliation |
| **Fleet** | Trucks, trailers, documents, maintenance, fuel intelligence |
| **HR** | Driver payroll, fines, emergency advances |
| **Tracking** | GPS geofencing, real-time location, alerts |
| **Clients** | Client CRUD, shipping/billing addresses, bank defaults |
| **Reports** | Trip profitability, fleet utilization, financial reports |

---

## 2. Database Schema Summary

The database is PostgreSQL hosted on Supabase. All tables use Row Level Security (RLS).

### Core Tables

#### `profiles` + `users`
- Extends Supabase Auth users.
- Stores `role` (admin / secretary / driver), `theme_mode`, `mfa_enabled`.

#### `trip_orders`
- Central table for trip management.
- Fields: `client_id`, `driver_id`, `truck_id`, `trailer_id`, `route`, `status`, `price`, `departure_date`, `unloading_date_export`, `loading_date_import`, `unloading_date_import`.
- Supports split pricing: `price_export` / `price_import` for cross-border legs.
- Related documents: CMR export/import URLs, MRN, ferry info.

#### `advances`
- Cash advances given to drivers for a trip.
- Fields: `driver_id`, `amount`, `currency`, `reason`, `status`, `date`, `source_cash_box`, `extra_advances`, `driver_allowance`, `receipt_expenses`.
- Tied to `cmr_number` for trip linkage.

#### `treasury_transactions`
- Immutable ledger for all treasury movements.
- Fields: `type` (income / expense / salary / transfer), `amount`, `currency`, `cash_box_id`, `bank_account_id`, `reconciliation_status`, `attachment_url`.
- Reconciliation status: `pending` → `cleared` → `reconciled`.

#### `invoices`
- Client invoices with E-invoicing support.
- Fields: `client_id`, `invoice_number`, `total_amount`, `paid_amount`, `status`, `currency`, `ht_amount`, `tva_rate`, `tva_amount`, `ttc_amount`, `bank_account_id`.
- Supports MAD and EUR currencies.

#### `payment_invoice_allocations`
- Junction table for FIFO payment allocation.
- Links `payment_id` → `invoice_id` with `allocated_amount`.

#### `fleet_documents`
- Generic document store for trucks and drivers.
- Fields: `entity_type` (truck / driver / trailer), `entity_id`, `document_type`, `file_url`, `expiry_date`, `is_archived`.
- Includes renewal tracking via `fleet_document_renewals`.

#### `driver_salaries`
- Monthly payroll records.
- Fields: `driver_id`, `amount`, `currency`, `period_start`, `period_end`, `status`, `advance_id`.

#### `geofence_zones` + `geofence_alerts`
- Zones: ports, borders, customs, client warehouses.
- Alerts: triggered on truck enter/exit events.

#### `delivery_signatures`
- E-POD records: `signature_url`, `signed_by`, `signed_at`, `cmr_image_url`, GPS coordinates.

---

## 3. Role-Based Access Control (RBAC)

### Roles

| Role | Description |
|------|-------------|
| `admin` | Full access to all modules |
| `secretary` | Trip creation, invoicing, treasury, fleet management, reports |
| `driver` | Driver tasks, advances, fuel receipts, emergency requests, chat |

### Route Protection

Route access is defined in `src/lib/rbac.ts`:

```typescript
ROLE_ALLOWED_ROUTES = {
  admin: ['*'],  // all routes
  secretary: ['/dashboard', '/trips', '/invoices', '/treasury', '/fleet', ...],
  driver: ['/driver-tasks', '/driver-advances', '/fuel-receipt', '/emergency-advance-requests', '/chat'],
};
```

- Client-side: `isRouteAllowed(role, pathname)` in the layout guard.
- Server-side: Server Actions validate the authenticated user's role before executing.

### Navigation Filtering

The sidebar dynamically renders items based on `user.role`. Items have an optional `roles[]` property; only matching items are shown.

---

## 4. Key Algorithms

### 4.1 FIFO Invoice Allocation Engine

**File:** `src/lib/fifo-payment.ts`

When a payment is received from a client, it is automatically allocated to the **oldest unpaid or partially paid invoices first**.

**Algorithm:**
1. Fetch all unpaid / partially paid / overdue invoices for the client, ordered by `issue_date ASC` then `id ASC`.
2. Create a `payments` record.
3. Iterate through invoices:
   - If remaining payment ≥ invoice due amount: mark invoice `paid`, reduce payment balance.
   - Else: mark invoice `partially_paid`, set remaining payment to 0.
4. Batch-insert allocations into `payment_invoice_allocations`.
5. Record treasury income transaction.
6. Update bank account or cash box balance.

**Why FIFO:** Follows standard accounting practice and simplifies aging reports.

### 4.2 Dynamic Treasury Balance Calculation

Treasury balances are **not pre-computed**. They are derived on-the-fly from `treasury_transactions` filtered by `cash_box_id` or `bank_account_id`:

```
current_balance = SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END)
```

This ensures the balance is always accurate and audit-ready. Reconciliation status tracks whether each transaction has been matched against bank statements.

### 4.3 Driver Payroll Logic

**File:** `src/features/hr/services/payroll.actions.ts`

```
Net Pay = Base Salary
        + (Total Trips Revenue × Bonus Percentage / 100)
        - Total Advances (approved, within period)
        - Total Fines (not yet deducted)
```

**Steps:**
1. Fetch driver profile (`base_salary`, `bonus_percentage`).
2. Fetch completed/settled trips for the month.
3. Fetch approved advances for the month.
4. Fetch fines not yet deducted from settlement.
5. Compute net pay using `decimal.js` at every step.
6. Insert `driver_salaries` record.
7. Insert treasury salary transaction.
8. Mark fines as deducted.

---

## 5. Integrations

### 5.1 WhatsApp Deep Linking

**Files:**
- `src/lib/utils/whatsapp-links.ts`
- `src/lib/whatsapp.ts`

- **Deep Links:** Generate `wa.me` links with pre-filled messages for ferry companies and customs transit agents. Templates: `ferry` and `transit_export`.
- **Cloud API:** Send WhatsApp messages server-side via Meta Cloud API for notifications.

### 5.2 E-Invoicing PDF Generation

**File:** `src/lib/pdf-service.ts`

- Generates bilingual (French/Arabic) PDF invoices.
- Includes company info, client details, itemized transport services, HT/TVA/TTC breakdown.
- Embeds a **QR code** encoding the e-invoice payload (company name, TVA number, date, total TTC, TVA amount, invoice number).
- Bank account information is dynamically resolved: uses invoice's bank account → client's default → falls back to currency-based account (EUR for European clients, MAD for others).

### 5.3 OCR Fuel Receipt Workflow

- Drivers capture fuel receipt images via the PWA.
- Images are compressed client-side using `image-compressor`.
- OCR processing (via Tesseract.js or server-side) extracts: date, fuel station, amount, liters.
- Results are stored as `advance.receipt_expenses` linked to the trip's advance record.

### 5.4 E-POD (Electronic Proof of Delivery)

- Drivers capture delivery signatures on the PWA.
- `delivery_signatures` stores: `signature_url`, `signed_by`, `signed_at`, `cmr_image_url`, and GPS coordinates.
- The CMR image is linked to the signature record for full audit trail.

---

## 6. Frontend Architecture

### Routing

```
src/app/
  [locale]/
    (auth)/login/          → Login
    (app)/
      dashboard/           → Role-aware dashboard
      trips/               → Trip management hub
      invoices/            → Invoice creation & listing
      treasury/            → Bank accounts, cash boxes, transactions
      fleet/               → Trucks, trailers, documents
      driver-tasks/        → Driver task list
      driver-advances/     → Driver advance history
      fuel-receipt/        → OCR fuel receipt capture
      reports/             → Analytics & reports
      chat/                → Internal messaging
      whatsapp-notifications/ → WhatsApp message templates
```

### State Management

| Store | Location | Purpose |
|-------|----------|---------|
| `auth-store.ts` | `src/lib/stores/` | Current user, role, auth state |
| `treasury-store.ts` | `src/lib/stores/` | Cash box / bank account balances |
| `app-store.ts` | `src/lib/stores/` | UI state (sidebar, theme) |
| `driver-store.ts` | `src/lib/stores/` | Driver-specific session state |

### Data Fetching Pattern

```typescript
// In feature services/queries.ts
export const useTrips = () => {
  return useQuery({
    queryKey: ['trips'],
    queryFn: fetchTrips,
  });
};

// In Server Actions
export async function createTrip(data: CreateTripInput) {
  const supabase = await createClient();
  // validation, insert, return
}
```

---

## 7. Offline & PWA

- **PWA:** Registered via `next-pwa` with Workbox.
- **Offline Sync:** Unsynced mutations are queued in `pending_updates` table. A sync engine processes them when connectivity returns.
- **Critical Offline Actions:** Fuel receipt upload, E-POD signing, emergency advance requests.
- **Sync Strategy:** Last-write-wins with server timestamp conflict detection.

---

## 8. Security & Compliance

- **Authentication:** Supabase Auth (email/password, with optional MFA).
- **Authorization:** RBAC enforced at both route level and Server Action level.
- **RLS:** All tables protected by Supabase Row Level Security policies.
- **Audit Log:** `audit_log` table tracks all soft-deletes, updates, and duplicates with old/new data snapshots.
- **Data Residency:** Supabase project in EU region (for GDPR compliance on European clients).
- **Financial Integrity:** `decimal.js` prevents floating-point rounding errors in all monetary calculations.

---

## 9. Deployment

- **Platform:** Vercel (Next.js optimized).
- **Database:** Supabase (PostgreSQL + Auth + Storage).
- **Storage:** Supabase Storage for documents, signatures, receipt images.
- **Environment Variables:** See `.env.example` for required variables.
- **CI/CD:** GitHub Actions or Vercel Git Integration.

---

## Appendix: Technology Decision Record (TDR)

| Decision | Rationale |
|----------|-----------|
| Next.js App Router | SEO, SSR, streaming, built-in API routes |
| Supabase | Rapid auth, real-time, RLS, Postgres |
| React Query | Client caching, background refetch, optimistic updates |
| decimal.js | Financial precision — eliminates floating-point errors |
| Tailwind CSS v4 | Utility-first, consistent design system |
| Shadcn UI | Accessible, customizable Radix-based components |
| next-pwa | PWA support with Workbox |
| Zustand | Minimal boilerplate global state |
| next-intl | i18n with SSR support in App Router |
