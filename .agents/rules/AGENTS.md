# Trans Bodanon TMS — Workspace Agent Rules

## Autonomous Execution Directives
- **Self-Directed Action**: Execute tasks end-to-end. Autonomously run builds, tests, linting, and bug fixing.
- **Strict Financial Operations**: Every single currency/monetary calculation MUST use `decimal.js`. Zero native JS arithmetic on money.
- **Next.js 16 App Router**: Observe breaking conventions documented in `node_modules/next/dist/docs/`.
- **Feature-First**: All feature code resides in `src/features/[feature_name]/`.
- **Supabase SSR**: Strictly separate server client (`@/lib/supabase/server`) from browser client (`@/lib/supabase/browser`).
- **i18n & RTL**: Support Arabic (RTL) first, then French (LTR), using `next-intl` and logical Tailwind classes.

