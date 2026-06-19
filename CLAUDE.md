# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server (localhost:5173)
npm run build     # tsc -b && vite build (type-check + bundle)
npm run lint      # ESLint
npm run preview   # serve the dist/ build locally
```

There is no test suite. Use `npx tsc --noEmit` to type-check without building.

## Stack

- **React 19 + TypeScript + Vite** — frontend SPA
- **Tailwind CSS** — all styling; dark theme with a fixed palette (`#09090b` bg, `#fafafa` text, `#22c55e` accent)
- **Supabase** — Postgres database, auth (email/password), and Storage (contract PDFs in the `contratos` bucket)
- **TanStack Query** — all server state and caching; `queryKey` arrays always include `user.id` as the second element
- **Zustand** (`src/store/authStore.ts`) — only used for auth session; all other state is local or TanStack Query
- **React Router v7** — `src/App.tsx` defines all routes; all pages are nested under `ProtectedRoute` + `Layout`
- **Recharts** — charts rendered inline in `Dashboard`, no abstracted chart components
- **Vercel** — deploy target; `vercel.json` handles SPA rewrite and security headers

## Architecture

### Data flow
All Supabase queries go through `src/services/` (one file per domain). Pages import from services and call them via TanStack Query hooks. Services return typed objects from `src/types/database.ts`.

### Types
`src/types/database.ts` is the single source of truth for all DB entity types and the `Database` interface used by the Supabase client. All `Insert`/`Update` variants are defined there.

### Client creation (`createCliente`)
`src/services/clientes.ts:createCliente` is a compound operation — it atomically inserts a `clientes` row, then creates all `parcelas` rows split by installment count, and if `tipo_servico === 'manutencao'` also inserts a `manutencao_recorrente` record. These three steps run sequentially; if any Supabase insert fails, an error is thrown.

### Maintenance billing (Edge Function)
`supabase/functions/gerar-cobrancas-manutencao/` is a Deno Edge Function that must be triggered by a daily cron via the Supabase Dashboard (no in-code scheduler). It queries all `manutencao_recorrente` rows with `status = 'ativo'` and `data_vencimento_atual <= today`, creates the next `parcelas` row, advances `data_vencimento_atual` by one month, and encerrates contracts that have exceeded `duracao_meses`. The function runs with `verify_jwt = false` (intended for cron use only).

### Realtime
The Dashboard subscribes to Postgres changes on the `parcelas` table and calls `queryClient.invalidateQueries` on `dashboard-metrics` to refresh metrics automatically.

### Auth
Auth session is bootstrapped in `App.tsx` via `AuthProvider`, which calls `supabase.auth.getSession()` on mount and listens to `onAuthStateChange`. The session is stored in Zustand. `ProtectedRoute` redirects to `/login` if no session exists.

### UI components
`src/components/ui/` contains primitive components (`Card`, `Button`, `Badge`, `Input`, `Select`, `Textarea`, `Modal`, `Table`, `Avatar`, `Spinner`, `EmptyState`). All accept `className` for overrides. `Card` accepts an optional `accentColor` prop that renders a colored left border.

## Environment

Requires a `.env` file (see `.env.example`):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
