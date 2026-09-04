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
