# Implementation Plan: Foundation & Authentication

## Overview

Set up the pnpm monorepo scaffold, Docker-based PostgreSQL, Prisma schema and migrations, full authentication surface (register, login, logout, current-user), JWT httpOnly cookies, role-based middleware, admin seed script, unified API error format, rate limiting, React auth pages, and client-side role guards.

Implementation follows the package dependency order: `packages/shared` → `apps/api` → `apps/web` → `apps/e2e`.

---

## Tasks

- [x] 1. Scaffold monorepo and shared tooling
  - [x] 1.1 Initialise pnpm workspace root
    - Create `pnpm-workspace.yaml` listing `apps/*` and `packages/*`
    - Create root `package.json` with `dev`, `test`, `test:e2e`, `typecheck`, and `lint` scripts; dev tooling deps only (concurrently, vitest, eslint, prettier, typescript, playwright)
    - The root `typecheck` script runs `tsc --noEmit` across all workspaces
    - The root `lint` script runs ESLint across all workspaces
    - The root `test` script calls `node scripts/test.mjs`. That script: (1) loads `apps/api/.env` via dotenv, (2) sets `process.env.DATABASE_URL` to the value of `TEST_DATABASE_URL`, (3) spawns `prisma migrate deploy` inside `apps/api`, (4) spawns the root Vitest run. Using a Node script instead of shell variable assignment ensures identical behaviour on Windows, macOS, and Linux
    - Create `tsconfig.base.json` with shared compiler options (`"strict": true`, `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"target": "ES2022"`, `"skipLibCheck": true`)
    - Create `eslint.config.js` (flat config) covering all workspaces
    - Create `.prettierrc`
    - _Requirements: 1.1, 1.3, 1.5, 1.6_

  - [x] 1.2 Create `docker-compose.yml` with two PostgreSQL services
    - One service for dev (`postgres_dev`), one for tests (`postgres_test`), each on a distinct port
    - Use named volumes for persistence
    - _Requirements: 1.2_

- [x] 2. Build `packages/shared` — Zod schemas, types, and constants
  - [x] 2.1 Initialise `packages/shared` package
    - Create `packages/shared/package.json` (name `@manual-trainer/shared`, `"type": "module"`)
    - Configure `package.json` `exports` to point directly to TypeScript sources in `src/` (no separate build step); `apps/api` consumes them via `tsx`; `apps/web` consumes them via Vite
    - Create `packages/shared/tsconfig.json` extending base config
    - Create `packages/shared/vitest.config.ts` (`environment: 'node'`)
    - Create `packages/shared/src/index.ts` barrel (empty for now)
    - _Requirements: 1.1_

  - [x] 2.2 Implement shared constants
    - Create `packages/shared/src/constants/roles.ts` — export `ROLE` const object `{ USER: 'user', ADMIN: 'admin' }`
    - Create `packages/shared/src/constants/errorCodes.ts` — export `ERROR_CODE` const object and `ErrorCode` type (all 8 values: `VALIDATION_ERROR`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR`)
    - Create `packages/shared/src/constants/validationKeys.ts` — export `VALIDATION_KEY` const object `{ EMAIL_INVALID, PASSWORD_TOO_SHORT, PASSWORD_TOO_LONG, FIELD_REQUIRED }`
    - Re-export all constants from `src/index.ts`
    - _Requirements: 6.7, 10.4_

  - [x] 2.3 Implement shared Zod schemas (Zod v4)
    - Create `packages/shared/src/schemas/auth.ts` with `registerSchema`, `loginSchema`, and `publicUserSchema` exactly as specified in the design
    - Create `packages/shared/src/schemas/error.ts` with `errorDetailSchema` and `errorResponseSchema`
    - Infer and export TypeScript types: `RegisterInput`, `LoginInput`, `PublicUser`, `ErrorResponse`, `ErrorDetail`
    - Re-export all schemas and types from `src/index.ts`
    - Use `TextEncoder` (not `Buffer`) for UTF-8 byte-length check in `registerSchema`
    - _Requirements: 2.3, 3.3, 3.4, 10.1_

  - [x] 2.4 Write property tests for shared Zod schemas
    - **Property 2: Valid registration round-trip** — `fc.property(safeEmailArb, validPasswordArb, ...)` verifies `registerSchema.parse()` succeeds and normalises email
    - **Property 4: Invalid request body always returns 422 (schema layer)** — `fc.property(invalidRegistrationInputArb, ...)` verifies `registerSchema.safeParse()` returns an error with the correct key in `issues[].message`
    - **Property 19: Seed script password validation (schema layer)** — `fc.property(invalidPasswordArb, ...)` verifies `registerSchema.safeParse()` returns `PASSWORD_TOO_SHORT` or `PASSWORD_TOO_LONG`
    - Use arbitraries defined in the design's Testing Strategy section (`safeEmailArb`, `validPasswordArb`, `invalidPasswordArb`, `invalidRegistrationInputArb`)
    - Include explicit Cyrillic boundary test cases (36-char = 72 bytes → accepted; 37-char = 74 bytes → rejected)
    - _Requirements: 3.3, 9.3_

- [x] 3. Set up `apps/api` package skeleton
  - [x] 3.1 Initialise `apps/api` package
    - Create `apps/api/package.json` (`"type": "module"`, scripts: `dev`, `build`, `start`, `seed`, `postinstall: prisma generate`)
    - Include runtime deps: `express`, `jsonwebtoken`, `bcrypt`, `cookie-parser`, `express-rate-limit`, `dotenv`, `@prisma/adapter-pg`, `pg`
    - Include dev deps: `tsx`, `vitest`, `supertest`, `fast-check`, `@types/*`
    - Create `apps/api/tsconfig.json` extending base (`"module": "ESNext"`, `"moduleResolution": "bundler"`)
    - Create `apps/api/vitest.unit.config.ts` (`name: 'api-unit'`, includes `**/*.test.ts`, excludes `**/*.integration.test.ts`)
    - Create `apps/api/vitest.integration.config.ts` (`name: 'api-integration'`, `fileParallelism: false`, includes `**/*.integration.test.ts`)
    - Create `apps/api/.env.example` with all variables from the design's environment variable table
    - **Completion criterion**: `pnpm install` on a fresh clone with no `.env` file succeeds, including the `postinstall` `prisma generate` step
    - _Requirements: 1.4, 1.7, 1.8_

  - [x] 3.1.5 Create root `vitest.config.ts` with three projects
    - Create `vitest.config.ts` at the repository root with `test.projects` referencing: `packages/shared/vitest.config.ts`, `apps/api/vitest.unit.config.ts`, `apps/api/vitest.integration.config.ts`
    - The `apps/web` project will be added to this list in task 10.1 once its config exists
    - _Requirements: 1.10_

  - [x] 3.2 Set up Prisma schema and config
    - Create `apps/api/prisma/schema.prisma` with `User` model exactly as specified in the design (`id`, `email`, `passwordHash`, `role`, `createdAt`, `@@map("users")`)
    - Create `apps/api/prisma.config.ts` using `defineConfig` from `prisma/config` with `schema`, `migrations`, and `datasource` fields
    - Before running the migration: start the databases with `docker compose up -d` and copy `apps/api/.env.example` to `apps/api/.env`, filling in the `DATABASE_URL` for the dev database
    - Run `prisma migrate dev --name init` to create the initial migration
    - Add `src/generated/` to `apps/api/.gitignore`
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Implement `apps/api/src/db.ts` — Prisma client singleton
    - Instantiate `PrismaClient` with `PrismaPg` driver adapter reading `DATABASE_URL` from env
    - Import `PrismaClient` from `./generated/prisma/client`
    - _Requirements: 2.1_

  - [x] 3.4 Implement `apps/api/src/config.ts` — typed env config
    - Read and validate all env variables at startup
    - Exit with non-zero code and descriptive stderr message if `JWT_SECRET` is missing
    - Default `JWT_EXPIRES_IN` to `'7d'`, `BCRYPT_ROUNDS` to `12`, `PORT` to `3000`, `RATE_LIMIT_AUTH_MAX` to `20`, `RATE_LIMIT_AUTH_WINDOW_MS` to `900000`
    - _Requirements: 1.7, 1.8_

- [x] 4. Implement `apps/api` auth service and middleware
  - [x] 4.1 Implement `apps/api/src/services/auth.ts`
    - `hashPassword(plaintext: string): Promise<string>` — bcrypt hash with work factor from `BCRYPT_ROUNDS`
    - `comparePassword(plaintext: string, hash: string): Promise<boolean>` — bcrypt compare
    - `signToken(payload: { sub: string }): string` — jwt.sign with `JWT_SECRET` and `JWT_EXPIRES_IN`; JWT payload contains only `sub`
    - `verifyToken(token: string): { sub: string }` — jwt.verify; throws `JsonWebTokenError`/`TokenExpiredError` on invalid/expired
    - Cookie helpers: `setAuthCookie(res, token)` and `clearAuthCookie(res)` with correct attributes (`httpOnly`, `sameSite: 'strict'`, `secure` in production)
    - _Requirements: 3.1, 4.1, 5.1, 6.5_

  - [x] 4.2 Write unit tests for auth service functions
    - `hashPassword` + `comparePassword` round-trip — hash then compare always returns `true` for correct password
    - `signToken` + `verifyToken` round-trip — sign then verify returns the original `sub`
    - `verifyToken` throws for tampered token, malformed string, and expired token
    - _Requirements: 3.1, 4.1_

  - [x] 4.3 Implement Express middleware: `requireAuth`, `requireAdmin`, `errorHandler`, `rateLimiter`, and `asyncHandler`
    - `requireAuth`: extract JWT from `token` cookie → `verifyToken` → load user from DB by `jwt.sub` → attach full DB user to `req.user`; return 401 `UNAUTHORIZED` on any failure; role comes from DB record
    - `requireAdmin`: check `req.user.role === 'admin'`; return 403 `FORBIDDEN` otherwise; must be composed after `requireAuth`
    - `errorHandler`: global four-argument Express error handler mapping all error types to `ErrorResponse` shape per the design's error mapping table; include Prisma `P2002`, `JsonWebTokenError`, `TokenExpiredError`, and `SyntaxError` mappings; log full error server-side on 500; never leak stack traces
    - `rateLimiter(opts)`: factory returning `express-rate-limit` middleware; reads `RATE_LIMIT_AUTH_MAX` and `RATE_LIMIT_AUTH_WINDOW_MS` from config; maps 429 to `RATE_LIMITED` error code
    - `asyncHandler`: utility that wraps async route handlers and forwards rejections to `next`
    - _Requirements: 6.1, 6.2, 6.3, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3_

  - [x] 4.4 Implement `apps/api/src/app.ts` — Express app factory
    - `createApp(config?: AppConfig): Express` — accepts optional `rateLimiting: false | { max, windowMs }`
    - Mount `cookie-parser`, JSON body parser, routes; register global `errorHandler` last
    - Add 404 catch-all for unmatched `/api` paths returning `NOT_FOUND`
    - Apply separate rate limiter instances to `POST /api/auth/register` and `POST /api/auth/login`
    - _Requirements: 6.6, 11.1, 11.2_

  - [x] 4.5 Implement auth routes (`apps/api/src/routes/auth.ts`) and admin route (`apps/api/src/routes/admin.ts`)
    - `POST /api/auth/register`: validate with `registerSchema` → check duplicate → hash password → create user → `signToken` → `setAuthCookie` → 201 + `publicUserSchema` response
    - `POST /api/auth/login`: validate with `loginSchema` → find user by email → `comparePassword` → `signToken` → `setAuthCookie` → 200 + public profile; use identical 401 `INVALID_CREDENTIALS` response for missing user and wrong password
    - `POST /api/auth/logout`: `clearAuthCookie` → 200
    - `GET /api/auth/me`: `requireAuth` → 200 + current user's public profile
    - `GET /api/admin/ping`: `requireAuth` + `requireAdmin` → 200
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3, 6.3, 6.4_

  - [x] 4.6 Implement `apps/api/src/index.ts` — server entry point
    - Validate env via `config.ts` (exits if `JWT_SECRET` missing)
    - Call `createApp()` and start listening on configured `PORT`
    - _Requirements: 1.7_

- [ ] 5. Checkpoint — API starts and responds correctly
  - Start the databases with `docker compose up -d`, then start the API with `pnpm --filter api dev`
  - Verify that `GET /api/auth/me` without a cookie returns HTTP 401 in the `ErrorResponse` format `{ error: { code: 'UNAUTHORIZED', message: '...' } }`
  - Typecheck and lint must pass: run `pnpm typecheck` and `pnpm lint` from the repository root

- [x] 6. Checkpoint — API unit tests pass
  - Run `pnpm test` from the repository root; tests run against `TEST_DATABASE_URL` — never against the dev database
  - Typecheck and lint must pass: run `pnpm typecheck` and `pnpm lint` from the repository root

- [x] 7. API integration tests
  - [x] 7.1 Write integration tests for auth routes (Supertest)
    - Cover all example-based scenarios listed in the design's testing strategy (register, login, logout, me, admin ping, rate limiting, 404, 500)
    - Use `beforeEach` to truncate `users` table; use unique emails per test
    - Disable rate limiting in app factory for all tests except dedicated 429 test
    - Set `BCRYPT_ROUNDS=4` in test environment
    - Verify `Set-Cookie` header attributes on registration and login responses (Properties 2, 5, 10)
    - Verify 404/500 response bodies conform to `errorResponseSchema` (Properties 11, 12)
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 6.3, 6.4, 6.6, 10.1, 10.3, 11.3_

- [x] 8. Implement admin seed script
  - [x] 8.1 Implement `apps/api/scripts/seed.ts`
    - Read `ADMIN_EMAIL` and `ADMIN_PASSWORD` from env; exit non-zero with stderr if either is missing
    - Normalise email (trim + lowercase)
    - Validate `ADMIN_PASSWORD` with `registerSchema` password rules; exit non-zero with stderr on failure
    - Check if email already exists; if so, print stdout warning with existing user's role and exit 0
    - Otherwise create user with `role: 'admin'` using `hashPassword`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 8.2 Write integration tests for admin seed script
    - Seed creates admin: run seed with valid `ADMIN_EMAIL` and `ADMIN_PASSWORD` → user exists in DB with role `'admin'`
    - Duplicate email: run seed twice with same email → DB unchanged on second run, stdout warning printed
    - Invalid password: run seed with password < 8 chars or > 72 UTF-8 bytes → exits non-zero, no DB record created
    - Missing env vars: run seed without `ADMIN_EMAIL` or `ADMIN_PASSWORD` → exits non-zero with stderr message
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 9. Checkpoint — API integration tests and seed script pass
  - Run `pnpm test` from the repository root; integration tests run against `TEST_DATABASE_URL` — never against the dev database
  - Typecheck and lint must pass: run `pnpm typecheck` and `pnpm lint` from the repository root

- [x] 10. Set up `apps/web` package skeleton
  - [x] 10.1 Initialise `apps/web` package with Vite + React
    - Create `apps/web/package.json` with React, React Router, TanStack Query, Tailwind CSS, Vite, lucide-react, React Hook Form, and `@hookform/resolvers` (use a version that supports Zod 4), `i18next`, and `react-i18next` as npm dependencies
    - shadcn/ui is a CLI tool — do not add it to `package.json`; run `npx shadcn@latest init` to scaffold its configuration; it adds its required libraries (`class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`) as npm dependencies automatically
    - Create `apps/web/tsconfig.json` extending base config; configure the `@/` path alias pointing to `src/` (set `baseUrl` and `paths`)
    - Create `apps/web/vite.config.ts` with the Vite React plugin, the `/api` dev server proxy to `http://localhost:3000`, and the `@/` alias matching tsconfig
    - Create `apps/web/vitest.config.ts` (`environment: 'jsdom'`, Vite React plugin, `@/` alias matching tsconfig)
    - Initialise Tailwind CSS with CSS-first configuration; define theme tokens (neutral base palette, primary accent, semantic tokens for `success`, `warning`, `danger`) in the CSS entry file
    - Add shadcn/ui components needed for auth pages: Button, Input, Label, Form, Alert
    - Create `apps/web/src/i18n.ts`: initialises i18next with the `uk` locale and three namespaces (`common`, `auth`, `errors`); import it at the top of `main.tsx` before any component is rendered
    - Declare the `uk` locale resources as the i18next resource types (via `i18next.d.ts` or inline declaration in `i18n.ts`), so referencing a non-existent key is a TypeScript error
    - Add a Vitest setup file for `apps/web` (referenced in `vitest.config.ts` via `setupFiles`) that imports `i18n.ts` and registers an i18next missing-key handler that throws; any component test that renders a missing translation key fails immediately
    - When typing form fields with `useForm`, use the schema's input type for the form values and the output type for the resolved value, because the email field uses a `.transform()` and the two types differ
    - Create `apps/web/src/main.tsx` — mount `App` with `QueryClientProvider`
    - Add `apps/web/vitest.config.ts` to the root `vitest.config.ts` projects list (alongside the three projects added in task 3.1.5)
    - _Requirements: 1.1, 1.9, 1.10_

  - [x] 10.2 Create i18next translation resources
    - Create `apps/web/src/locales/uk/errors.json` — one entry for every `ERROR_CODE` value and every `VALIDATION_KEY` value; this is the single place for error and validation text
    - Create `apps/web/src/locales/uk/auth.json` — login, registration, and logout copy
    - Create `apps/web/src/locales/uk/common.json` — shared labels, buttons, and navigation copy
    - The raw API `message` field and raw keys such as `EMAIL_INVALID` must never be rendered; all display strings come from the `errors` namespace via i18next
    - _Requirements: 8.3, 8.4_

  - [x] 10.2.5 Create `FormMessage` component
    - Create a `FormMessage` wrapper component in `apps/web/src/components/ui` that translates raw Zod validation keys (e.g. `PASSWORD_TOO_SHORT`) through i18next (`errors` namespace) before rendering — raw keys are never passed directly to the DOM
    - `FormMessage` is used by all auth forms; the `errors` namespace is the single source of translation for validation keys
    - _Requirements: 8.3_

  - [x] 10.3 Write property test for error code and validation key coverage
    - **Property 16: All ERROR_CODE and VALIDATION_KEY values have non-empty entries in the uk errors resource** — `fc.property(fc.constantFrom(...Object.values(ERROR_CODE), ...Object.values(VALIDATION_KEY)), key => ...)` verifies every key resolves to a non-empty string in the `uk/errors.json` resource; the test fails if any key is missing or maps to an empty string
    - _Requirements: 8.4_

- [x] 11. Implement client auth layer
  - [x] 11.1 Implement `apps/web/src/api/auth.ts` — TanStack Query hooks
    - `useMe()` — GET `/api/auth/me`; `retry: false`; treat 401 as `null` (never rejects); populates `['me']` cache key
    - `useLogin()` — POST `/api/auth/login` mutation; on success calls `queryClient.setQueryData(['me'], user)`
    - `useRegister()` — POST `/api/auth/register` mutation; on success calls `queryClient.setQueryData(['me'], user)`
    - `useLogout()` — POST `/api/auth/logout` mutation; on success calls `queryClient.setQueryData(['me'], null)`
    - _Requirements: 7.3, 8.5_

  - [x] 11.2 Implement `apps/web/src/context/AuthContext.tsx` and `apps/web/src/components/RoleGuard.tsx`
    - `AuthContext`: thin wrapper exposing the `['me']` query result via context
    - `RoleGuard`: renders full-page spinner while `currentUser === undefined`; redirects to `/login` (storing `location.state.from`) when `currentUser === null` and `requireAuth`; redirects to `/not-authorized` when `requireAuth && requireAdmin && currentUser.role !== 'admin'`; renders children otherwise
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 11.3 Write property tests for RoleGuard
    - **Property 13: RoleGuard redirects unauthenticated users to /login** — `fc.property(anyProtectedRoutePath, ...)` renders RoleGuard with `currentUser=null`, always redirects to `/login`
    - **Property 14: RoleGuard redirects role=user away from admin routes** — `fc.property(anyAdminRoutePath, ...)` renders with `requireAdmin` and `role='user'`, always redirects to `/not-authorized`
    - _Requirements: 7.1, 7.2_

- [x] 12. Implement web authentication pages
  - [x] 12.1 Implement `apps/web/src/pages/LoginPage.tsx`
    - Build the form with React Hook Form and the Zod resolver using `loginSchema` from `packages/shared`; use shadcn/ui Form, Input, Label, and Button components
    - Show field-level validation errors below each field after the first submit attempt via the `FormMessage` component (translates keys through i18next `errors` namespace); show API errors in a shadcn/ui Alert above the form (translated via i18next `errors` namespace)
    - All visible text uses i18next translation keys from the `auth` or `common` namespace — no hard-coded strings
    - Submit button shows a loading state and is disabled while the request is in flight
    - Redirect authenticated users to `/` (Property 17)
    - Store `location.state.from` and redirect back after successful login (Property 18)
    - _Requirements: 8.2, 8.3, 8.4, 8.6, 8.7_

  - [x] 12.2 Implement `apps/web/src/pages/RegisterPage.tsx`
    - Build the form with React Hook Form and the Zod resolver using `registerSchema` from `packages/shared`; use shadcn/ui Form, Input, Label, and Button components
    - Show field-level validation errors below each field after the first submit attempt (including `PASSWORD_TOO_LONG` for UTF-8 bytes > 72) via the `FormMessage` component (translates keys through i18next `errors` namespace); show API errors in a shadcn/ui Alert above the form (translated via i18next `errors` namespace)
    - All visible text uses i18next translation keys from the `auth` or `common` namespace — no hard-coded strings
    - Submit button shows a loading state and is disabled while the request is in flight
    - Redirect authenticated users to `/` (Property 17)
    - _Requirements: 8.1, 8.3, 8.4, 8.6_

  - [x] 12.3 Implement shared authenticated layout and placeholder pages
    - Create `apps/web/src/components/AuthLayout.tsx` — the shared layout for all protected pages: top bar with the app name, main navigation, the current user's email, and the logout control; all visible text uses i18next translation keys (`common` namespace); admin pages will extend this with admin navigation in a later spec
    - Create `apps/web/src/components/LogoutButton.tsx` — calls `useLogout()`; redirects to `/login` on success; used exclusively inside `AuthLayout`'s top bar
    - `apps/web/src/pages/HomePage.tsx` — protected (`requireAuth`), rendered inside `AuthLayout`; shows a greeting that includes the user's email using an i18next key with interpolation (e.g. `auth:home.greeting`); the email and logout control are in the `AuthLayout` top bar — do not duplicate them on the page itself
    - `apps/web/src/pages/AdminPage.tsx` — protected (`requireAuth + requireAdmin`), rendered inside `AuthLayout`, calls `GET /api/admin/ping` on mount and displays response; all visible text uses i18next translation keys
    - `apps/web/src/pages/NotAuthorizedPage.tsx` — no guard; all visible text uses i18next translation keys
    - _Requirements: 8.5, 12.1, 12.2, 12.3_

  - [x] 12.4 Implement `apps/web/src/App.tsx` — router root with route table
    - Wrap all routes in `AuthProvider` only; `QueryClientProvider` is mounted in `main.tsx` — do not add it again in `App.tsx`
    - Apply `RoleGuard` per the route table in the design (`/login`, `/register` redirect authenticated users; `/` requires auth; `/admin` requires auth + admin; `/not-authorized` has no guard)
    - Add React error boundaries at route level
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.6_

- [ ] 13. Checkpoint — Full dev stack works manually in the browser
  - Run `pnpm dev` from the repository root; verify it starts the databases, API, and web app
  - Manually verify in the browser: registration creates an account, login sets the cookie, logout clears it
  - Typecheck and lint must pass: run `pnpm typecheck` and `pnpm lint` from the repository root

- [x] 14. Component tests for web pages
  - [x] 14.1 Write component tests for RoleGuard and auth pages
    - RoleGuard renders spinner while loading (`currentUser === undefined`), does not redirect
    - `LoginPage` shows Ukrainian validation error next to email field for invalid email format; assert the rendered text is a Ukrainian string, not the raw key (e.g. not `'EMAIL_INVALID'`)
    - `RegisterPage` shows Ukrainian validation error for password < 8 chars; assert rendered text is Ukrainian, not `'PASSWORD_TOO_SHORT'`
    - `RegisterPage` shows Ukrainian validation error for password > 72 UTF-8 bytes; assert rendered text is Ukrainian, not `'PASSWORD_TOO_LONG'`
    - `LoginPage` redirects authenticated user to `/`
    - `LoginPage` preserves `location.state.from` for post-login redirect
    - `LogoutButton` calls logout and redirects to `/login`
    - `HomePage` displays a Ukrainian greeting containing the current user's email
    - `AdminPage` calls `GET /api/admin/ping` on mount and displays response
    - Missing translation keys are caught by two mechanisms and do not need a separate enumeration test: (1) typed i18next resources make a missing key a TypeScript error caught by `pnpm typecheck`; (2) the Vitest setup file registers a throwing missing-key handler so any component test that renders a missing key fails immediately
    - _Requirements: 7.4, 8.3, 8.4, 8.5, 8.6, 8.7, 12.1, 12.2_

- [ ] 15. Checkpoint — All unit, schema, and component tests pass
  - Run `pnpm test` from the repository root; tests run against `TEST_DATABASE_URL` — never against the dev database
  - Typecheck and lint must pass: run `pnpm typecheck` and `pnpm lint` from the repository root

- [x] 16. Set up `apps/e2e` and write Playwright tests
  - [x] 16.1 Initialise `apps/e2e` package
    - Create `apps/e2e/package.json` and `apps/e2e/tsconfig.json`
    - Create `playwright.config.ts` with `webServer` entries for both `apps/web` and `apps/api` pointing at the test database
    - Set `RATE_LIMIT_AUTH_MAX=9999` in `webServer` env so the E2E suite never hits the rate limit
    - Add global setup: `prisma migrate reset --force` + explicit seed script run to create the admin account (Prisma 7 does not run seed automatically after migrate reset)
    - _Requirements: 1.11_

  - [x] 16.2 Write Playwright E2E test scenarios
    - Registration flow: visit `/register` → fill form → submit → land on `/`
    - Login flow: visit `/login` → fill form → submit → land on `/`
    - Logout flow: from `/`, click logout → land on `/login`; subsequent `/me` returns 401
    - Protected route redirect: visit `/` unauthenticated → redirected to `/login` → login → redirected back to `/`
    - Admin guard: log in as `role=user` → visit `/admin` → redirected to `/not-authorized`
    - Already-authenticated redirect: log in → navigate to `/login` → redirected to `/`
    - Validation errors displayed: submit register form with empty password → Ukrainian error shown inline
    - API error displayed: submit login with wrong password → Ukrainian error shown; raw message not visible
    - Admin login and ping: admin logs in → navigates to `/admin` → sees successful ping response
    - _Requirements: 3.1, 4.1, 5.1, 7.1, 7.2, 8.3, 8.4, 8.6, 8.7, 12.2_

- [ ] 17. Final checkpoint — All tests pass
  - Run `pnpm test` and `pnpm test:e2e` from the repository root
  - Typecheck and lint must pass: run `pnpm typecheck` and `pnpm lint` from the repository root

---

## Notes

- Each task references specific requirements for traceability
- The design document contains exact code signatures, file paths, and schema definitions — use it as the authoritative reference during implementation
- Property-based tests use fast-check; each runs a minimum of 100 iterations as specified in the design
- Integration tests always target `TEST_DATABASE_URL`; the root `test` script sets `DATABASE_URL=TEST_DATABASE_URL` before running Prisma migrations and Vitest
- `BCRYPT_ROUNDS=4` must be set in the test environment for speed
- `apps/api` has two separate Vitest config files (`vitest.unit.config.ts` and `vitest.integration.config.ts`) because Vitest does not support nested projects
- The Prisma client is generated into `src/generated/prisma`; `prisma generate` runs automatically via `postinstall` and must be re-run after any schema change
- Seed script is run as an explicit separate step in E2E global setup because Prisma 7 does not auto-seed after `migrate reset`

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["2.4", "3.1"] },
    { "id": 5, "tasks": ["3.1.5"] },
    { "id": 6, "tasks": ["3.2"] },
    { "id": 7, "tasks": ["3.3", "3.4"] },
    { "id": 8, "tasks": ["4.1"] },
    { "id": 9, "tasks": ["4.2", "4.3"] },
    { "id": 10, "tasks": ["4.4"] },
    { "id": 11, "tasks": ["4.5"] },
    { "id": 12, "tasks": ["4.6"] },
    { "id": 13, "tasks": ["7.1"] },
    { "id": 14, "tasks": ["8.1"] },
    { "id": 15, "tasks": ["8.2"] },
    { "id": 16, "tasks": ["10.1"] },
    { "id": 17, "tasks": ["10.2"] },
    { "id": 18, "tasks": ["10.2.5"] },
    { "id": 19, "tasks": ["10.3", "11.1"] },
    { "id": 20, "tasks": ["11.2"] },
    { "id": 21, "tasks": ["11.3"] },
    { "id": 22, "tasks": ["12.1"] },
    { "id": 23, "tasks": ["12.2"] },
    { "id": 24, "tasks": ["12.3"] },
    { "id": 25, "tasks": ["12.4"] },
    { "id": 26, "tasks": ["14.1"] },
    { "id": 27, "tasks": ["16.1"] },
    { "id": 28, "tasks": ["16.2"] }
  ]
}
```