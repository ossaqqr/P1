# Quadrant Two Weekly Planner

تطبيق عربي متجاوب يساعدك تخطط أدوارك وأهدافك وجدولك الأسبوعي وتراجع أسبوعك باستخدام Claude.

## Run & Operate

- `pnpm --filter @workspace/weekly-planner run dev` — run the Vite web app
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, Clerk-managed auth variables, and server-only `ANTHROPIC_API_KEY`
- The API uses `/api`; the web artifact is served at `/`
- Do not expose `ANTHROPIC_API_KEY` to Vite or browser code

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Web: React, Vite, Tailwind CSS, Wouter, TanStack Query
- Auth: Clerk
- PWA: installable web manifest, service worker, and PNG/SVG app icons
- AI review: server-side Anthropic Messages API using `claude-sonnet-4-6`

## Where things live

- `artifacts/weekly-planner/src/App.tsx` — Arabic planner UI, auth routes, date picker, review flow, and frontend API usage
- `artifacts/weekly-planner/src/index.css` — planner theme and responsive styling
- `artifacts/weekly-planner/public/manifest.webmanifest` and `public/sw.js` — PWA metadata and offline app shell
- `artifacts/api-server/src/routes/planner.ts` — authenticated planner load/save and Claude review endpoint
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/db/src/schema/planner.ts` — PostgreSQL planner data schema
- `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/` — generated API clients and validation

## Architecture decisions

- Clerk user IDs scope each planner row, so the same account can load its data on another device.
- PostgreSQL stores the complete planner JSON and review result in one user-keyed row.
- Claude is called only by the API server; the browser receives only validated analysis results.
- Native `input[type="date"]` remains the date source of truth; the visible control opens it through `showPicker()` with a click fallback for mobile browsers.
- Saves are queued to preserve the order of rapid edits, including changing the week-end date more than once.

## Product

- Arabic RTL landing, sign-in, sign-up, planner, weekly review, and analysis result screens.
- Persistent roles, goals, daily schedule, reflections, selected week-end date, and review results.
- Remaining-days indicator and automatic review prompt after the selected week ends.
- Responsive desktop/mobile layout with PWA install metadata.

## User preferences

- Preserve the original Arabic content, visual design, labels, and workflow unless a technical fix is explicitly requested.

## Gotchas

- After changing the OpenAPI file, run API code generation before typechecking consumers.
- Restart both managed artifact workflows after server, package, or environment changes.
- The service worker is registered only in production builds to avoid stale Vite development previews.
- The server rewrite keeps client routes working when the installed PWA opens `/`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
