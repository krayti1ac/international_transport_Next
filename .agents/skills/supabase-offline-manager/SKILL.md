---
name: supabase-offline-manager
description: >-
  Guide for managing Supabase database interactions, Row Level Security (RLS) policies,
  generating database TypeScript definitions, and handling PWA offline synchronization queues.
  Use when interacting with Supabase tables, adding RLS rules, or updating offline sync routines.
---

# Supabase & Offline Sync Manager

## 1. Database Types Single Source of Truth

- The canonical database types are kept in `src/types/database.ts`.
- When database schema changes, update `src/types/database.ts` accordingly.

## 2. Supabase Client Usage Guidelines

- **Server-side (Server Components, Server Actions, Route Handlers)**:
  ```typescript
  import { createClient } from '@/lib/supabase/server';
  const supabase = await createClient();
  ```
- **Client-side (Interactive UI components)**:
  ```typescript
  import { createClient } from '@/lib/supabase/browser';
  const supabase = createClient();
  ```
- **CRITICAL Security Rule**: Never bypass Row Level Security (RLS) by exposing the `service_role` key to the browser. Client requests must always execute with the user's authenticated session.

## 3. PWA & Driver Offline-First Synchronization

- Mobile drivers operate in areas with intermittent cellular coverage (international transit routes).
- Critical driver actions:
  - Fuel receipt image uploads & metadata
  - Electronic Proof of Delivery (E-POD) signatures
  - Driver advance receipts
- Use the offline queue in `src/lib/offline-sync.ts`:
  1. Action is persisted locally in IndexedDB / local storage.
  2. Background sync triggers when network connectivity resumes.
  3. Optimistic UI shows status as "Pending Sync" (في انتظار المزامنة) until confirmed.

