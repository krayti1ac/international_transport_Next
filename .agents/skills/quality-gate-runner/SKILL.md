---
name: quality-gate-runner
description: >-
  Executes full validation suite including pre-flight environment checks, ESLint,
  TypeScript compilation checks, and Next.js production build for Trans Bodanon TMS.
  Use before finalizing any task, submitting changes, or diagnosing build failures.
---

# Quality Gate & Build Verification (Trans Bodanon TMS)

This skill describes the exact sequence required to verify code health and ensure zero breaking issues in production.

## Verification Pipeline

Run the following checks sequentially:

### 1. Environment & Database Pre-Flight Check
```powershell
node scripts/pre-flight-check.js
```
- Validates that required environment variables are set in `.env.local` or `.env`.
- Pings Supabase connection to confirm connectivity.

### 2. TypeScript Static Analysis (No Emit)
```powershell
npx tsc --noEmit
```
- Ensures strict type safety without generating JS files.
- Zero `any` types allowed unless explicitly justified.

### 3. ESLint Verification
```powershell
npm run lint
```
- Runs Next.js ESLint configuration across all files.
- Automatically fix simple styling/lint issues where applicable:
  ```powershell
  npx eslint . --fix
  ```

### 4. Next.js Production Build
```powershell
npm run build
```
- Executes `node scripts/pre-flight-check.js` followed by `next build`.
- Catches server-side rendering issues, missing dependencies, or route misconfigurations.

## Troubleshooting Common Failures

- **Decimal.js type mismatch**: Ensure `@types/decimal.js` is installed (already in `devDependencies`) and import `Decimal` correctly (`import Decimal from 'decimal.js'`).
- **Supabase SSR client in Client Component**: If you see cookies/header errors, ensure Server Actions or Server Components use `@/lib/supabase/server`, and Client Components use `@/lib/supabase/browser`.
- **next-intl missing keys**: Check `messages/ar.json` and `messages/fr.json` for missing translation keys flagged during build or rendering.

