---
name: nextjs-feature-builder
description: >-
  Standard procedure for implementing or modifying features in Trans Bodanon TMS.
  Follows the strict feature-first architecture in src/features/[feature_name]/,
  enforces Server Actions for mutations, React Query for queries, Supabase SSR client,
  Zod schemas, and RBAC rules. Use whenever creating or modifying TMS features.
---

# Next.js Feature Builder (Trans Bodanon TMS)

This skill provides step-by-step instructions for implementing or refactoring features in accordance with the project's strict architecture.

## 1. Feature Directory Structure

Every feature MUST reside inside `src/features/[feature_name]/`:

```text
src/features/[feature_name]/
├── components/          # Feature React components (RTL aware)
├── services/
│   ├── [feature].actions.ts   # Next.js Server Actions (all mutations)
│   └── [feature].queries.ts   # React Query fetching functions & query keys
├── hooks/               # Feature custom React Query hooks
├── stores/              # Local Zustand stores (if feature needs local state)
├── schemas/             # Zod validation schemas
└── types/               # Feature-specific TypeScript definitions
```

## 2. Server Actions for Mutations (`*.actions.ts`)

- Always use `'use server'` directive.
- Always validate input arguments using the feature's Zod schema.
- Instantiate Supabase server client:
  ```typescript
  import { createClient } from '@/lib/supabase/server';
  const supabase = await createClient();
  ```
- All money calculations MUST use `Decimal` from `decimal.js`. Never use native math `+`, `-`, `*`, `/`.

## 3. Client Data Fetching (`*.queries.ts` & `hooks/`)

- Never call Supabase mutation methods directly from client components.
- Use `@tanstack/react-query` with consistent query keys:
  ```typescript
  export const featureKeys = {
    all: ['feature_name'] as const,
    lists: () => [...featureKeys.all, 'list'] as const,
    list: (filters: FilterType) => [...featureKeys.lists(), filters] as const,
    details: () => [...featureKeys.all, 'detail'] as const,
    detail: (id: string) => [...featureKeys.details(), id] as const,
  };
  ```
- After mutation server actions succeed, always invalidate relevant query keys.

## 4. RBAC & Permissions

- The TMS defines 3 primary roles: `admin`, `secretary`, and `driver`.
- Validate role permissions before executing sensitive operations or rendering protected controls.
- Check `src/lib/rbac.ts` for route and action permissions.

## 5. Verification Checklist

1. [ ] File placed in `src/features/[feature_name]/` (never root `src/components/` or `src/app/`).
2. [ ] All monetary operations use `decimal.js`.
3. [ ] Server Actions validate inputs with Zod.
4. [ ] React components support RTL (`rtl:` utilities, appropriate padding/margins).
5. [ ] Translations registered in `src/i18n/messages/ar.json` and `fr.json`.

