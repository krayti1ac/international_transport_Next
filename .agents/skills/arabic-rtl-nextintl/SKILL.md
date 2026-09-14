---
name: arabic-rtl-nextintl
description: >-
  Provides guidelines and checklists for implementing trilingual Arabic (RTL), French (LTR),
  and Spanish (LTR) features using next-intl and Tailwind CSS v4. Use when building UI components, forms,
  tables, modals, or modifying translations in Trans Bodanon TMS.
---

# Arabic, French & Spanish UI Implementation Guide (next-intl)

Trans Bodanon TMS is a trilingual international transport system: Arabic-first (RTL), with full first-class support for French (LTR) and Spanish (LTR).

## 1. i18n Architecture

- Translations are located in:
  - `src/i18n/messages/ar.json` (Arabic - Primary RTL)
  - `src/i18n/messages/fr.json` (French - LTR)
  - `src/i18n/messages/es.json` (Spanish - LTR)
- Routes are wrapped in `[locale]` dynamic route segments.
- Configuration resides in `src/i18n/routing.ts` and `src/i18n/request.ts`.

## 2. Component Implementation Standards

### Using `useTranslations`
```tsx
import { useTranslations } from 'next-intl';

export function TripCard({ trip }: TripCardProps) {
  const t = useTranslations('Trips');
  
  return (
    <div className="rounded-xl border p-4 bg-card text-card-foreground">
      <h3 className="font-bold text-lg">{t('tripNumber', { id: trip.id })}</h3>
      <p className="text-muted-foreground">{t('origin')}: {trip.origin}</p>
    </div>
  );
}
```

### RTL/LTR Layout Conventions
- **Directional Utilities**: Use logical Tailwind properties where possible:
  - Use `ms-*` (margin-inline-start) and `me-*` (margin-inline-end) instead of `ml-*` and `mr-*`.
  - Use `ps-*` (padding-inline-start) and `pe-*` (padding-inline-end) instead of `pl-*` and `pr-*`.
  - Use `start-*` and `end-*` for absolute positioning instead of `left-*` and `right-*`.
  - For directional icons (like arrows), use `rtl:rotate-180` to mirror them in Arabic mode.

## 3. Translation Parity Checklist

When adding a new translation key:
1. Add key under appropriate namespace in `src/i18n/messages/ar.json`.
2. Add corresponding key in `src/i18n/messages/fr.json`.
3. Add corresponding key in `src/i18n/messages/es.json`.
4. Verify that dynamic interpolation variables (e.g. `{count}`, `{name}`) match exactly across all 3 languages.
5. Ensure error alerts and validation messages are presented in the active locale.

