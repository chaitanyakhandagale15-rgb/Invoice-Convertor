---
name: Clerk Auth Setup
description: How Clerk auth is wired in InvoiceBridge (Express API + React+Vite frontend) — pitfalls and decisions
---

# Clerk Auth Setup in InvoiceBridge

## Key decisions

- `publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)` — required, never use raw env var
- `proxyUrl={import.meta.env.VITE_CLERK_PROXY_URL}` — unconditional, empty in dev is intentional
- Routes MUST be `/sign-in/*?` and `/sign-up/*?` — the `/*?` optional wildcard is required for OAuth sub-paths
- `<SignIn path={`${basePath}/sign-in`}>` — full browser path, not base-relative
- Auth is cookie-based on web — no getToken(), no Bearer headers needed
- `requireAuth` uses `getAuth(req).userId` from `@clerk/express`

**Why:** Any deviation from these patterns breaks either dev or prod proxy.

## Tailwind v4 + Clerk CSS layers
- `@layer theme, base, clerk, components, utilities;` must come BEFORE `@import 'tailwindcss'`
- `tailwindcss({ optimize: false })` in vite.config.ts prevents prod build from reordering nested @layer imports

## DB: userId column
- Added `userId text("user_id").notNull().default("")` to invoicesTable
- All queries filter by `eq(invoicesTable.userId, req.userId)`
- Join queries for stats use `innerJoin` with userId filter on invoicesTable
