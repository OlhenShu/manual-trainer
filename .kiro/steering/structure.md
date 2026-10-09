# Project Structure

## Repository Layout

Monorepo managed with **pnpm workspaces**.

```
manual-trainer/
├── apps/
│   ├── web/              # React client (Vite)
│   ├── api/              # Express server (Node.js)
│   │   └── prisma/       # Prisma schema and migrations
│   └── e2e/              # Playwright end-to-end tests
├── packages/
│   └── shared/           # Zod schemas, TypeScript types, constants
├── docker-compose.yml    # PostgreSQL only (dev + test databases)
├── pnpm-workspace.yaml
├── tsconfig.base.json    # Base TS config extended by every workspace
├── eslint.config.js      # Single ESLint flat config for the whole repo
├── .prettierrc           # Single Prettier config for the whole repo
└── package.json          # Root — dev tooling only, no runtime deps
```

## Package Responsibilities

### `apps/web`
- React application bundled with Vite.
- Imports shared types and Zod schemas from `packages/shared`.
- Communicates with the API over HTTP; no direct DB access.
- Unit and component tests: **Vitest**.

### `apps/api`
- Express HTTP server.
- Owns all database access via Prisma. Prisma schema and migrations live in `apps/api/prisma/`.
- Makes all LLM calls; the AI API key never leaves this package.
- Imports shared schemas from `packages/shared` for request validation.
- Unit tests: **Vitest**.

### `apps/e2e`
- End-to-end tests using **Playwright**.
- Separate pnpm workspace; runs against the locally started web and API apps.

### `packages/shared`
- The single source of truth for data shapes used by both client and server.
- Contains: Zod schemas, inferred TypeScript types, shared constants (e.g. role names, severity/priority enums).
- Must **not** import Prisma Client or any server-only code — dependency flows one way only.

## TypeScript Configuration

- `tsconfig.base.json` at the repository root defines shared compiler options.
- Each workspace (`apps/web`, `apps/api`, `apps/e2e`, `packages/shared`) has its own `tsconfig.json` that extends the base config.

## Linting & Formatting

- Single **ESLint flat config** (`eslint.config.js`) at the repository root covers all workspaces.
- Single **Prettier config** (`.prettierrc`) at the repository root.
- No separate `packages/config` workspace.

## Local Development

- `docker-compose.yml` at the root starts **PostgreSQL only**: one database for development, one for tests. Apps are not containerized during development.
- A root `dev` script starts the database via Docker Compose and runs `apps/web` and `apps/api` in parallel with hot reload.
- Per-app Dockerfiles are out of scope until the deployment stage.

## Naming & Language Conventions

| Artifact | Language |
|----------|----------|
| UI text, labels, messages | Ukrainian |
| Code, variable/function/file names | English |
| Git commit messages | English |
| Comments in code | English |
