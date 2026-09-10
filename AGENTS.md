<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Trans Bodanon TMS — Developer Agent Directives

## 1. Autonomous Execution
- Work autonomously and solve errors proactively.
- Auto-run checks (`npx tsc --noEmit`, `npm run lint`, `node scripts/pre-flight-check.js`) after major edits.
- Never stop prematurely if an error occurs during execution; inspect logs, diagnose root cause, and resolve it.

## 2. Critical Financial Rule (Decimal.js)
- NEVER use native JavaScript `number` arithmetic for financial, currency, fuel, pricing, or balance calculations.
- Always use `decimal.js`: `Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP })`.
- Operations: `.plus()`, `.minus()`, `.times()`, `.dividedBy()`.

## 3. Architecture & Tech Stack
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript (strict).
- **Structure**: Feature-First (`src/features/[feature_name]/`).
- **Data Flow**: Server Actions (`*.actions.ts`) for mutations with Zod validation. React Query (`*.queries.ts`) for data fetching.
- **Supabase**: `@/lib/supabase/server` on server; `@/lib/supabase/browser` on client. Never bypass RLS.
- **i18n & RTL**: Arabic first (`dir="rtl"`, `src/i18n/messages/ar.json`), French (`src/i18n/messages/fr.json`).

## 4. Applied Migrations
- `supabase/migrations/20260906_fine_penalties_and_risk.sql` — Phase 9: Driver Fines & Risk Management (`fine_penalties` table, RLS policies, indexes).
- `supabase/migrations/20260908_driver_rls_and_storage_policies.sql` — Driver RLS & Storage Security (`storage.objects`, `trip_orders`, `truck_maintenance`, `advances`).
- `supabase/migrations/20260908_fifo_payment_rpc.sql` — FIFO Payment Allocation Engine (`process_fifo_payment` RPC, `payment_invoice_allocations` table).
- `supabase/migrations/20260909_multi_tenant_saas.sql` — Multi-Tenancy SaaS Architecture & Tenant Isolation (`companies` table, `company_id` columns, RLS policies, helper functions).
- `supabase/migrations/20260909_company_subscriptions_and_devices.sql` — Company Subscriptions & Devices Management (`subscription_cost`, `subscription_start_date`, `subscription_end_date`, `max_devices`, `company_devices` table).
- `supabase/migrations/20260910_super_admin_role_and_policies.sql` — Super Admin Role Isolation & Central Companies Management.
- `supabase/migrations/20260911_update_transbodanon_user_emails.sql` — Update Trans Bodanon User Emails (Admin, Secretary, Driver).
- `supabase/migrations/20260912_hide_super_admin_from_tenants.sql` — Super Admin Isolation from Tenant Companies & User Management RLS.
- `supabase/migrations/20260913_add_company_email_domain.sql` — Company Email Domain Assignment & User Registration Enforcement.
- `supabase/migrations/20260914_unique_username_per_company.sql` — Enforce unique username per company domain across all user roles (indexes & constraints).
- `supabase/migrations/20260915_add_driver_photo_url.sql` — Add driver photo_url column and driver-photos storage bucket.
- `supabase/migrations/20260916_add_user_avatar_url.sql` — Add user avatar_url column to public.users table.
- `supabase/migrations/20260917_add_client_logo_url.sql` — Add client logo_url column to public.clients table.
- `supabase/migrations/20260918_add_provider_logo_url.sql` — Add provider logo_url and photo_url columns to public.providers table.
- `supabase/migrations/20260919_add_route_cost_and_pricing.sql` — Add route freight cost, fuel calculation parameters (fuel price, consumption rate, fuel cost) and customs/other expenses to public.transport_routes.
- `supabase/migrations/20260920_add_truck_fuel_and_route_ferry.sql` — Add truck fuel_consumption_rate (default 36%), route ferry_cost, road_distance_km, and ferry_distance_km.

