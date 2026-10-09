# Technology Stack

## Language

TypeScript throughout — both client and server.

## Frontend

- **Framework:** React (via Vite)
- **Routing:** React Router
- **Server state / data fetching:** TanStack Query
- **Styling:** Tailwind CSS with shadcn/ui (CSS-first configuration)
- **UI components:** shadcn/ui — added to `apps/web/src/components/ui`, editable locally
- **Forms:** React Hook Form with the Zod resolver
- **Internationalisation:** react-i18next (i18next)
- **Icons:** lucide-react

## Backend

- **Runtime:** Node.js
- **Framework:** Express

## Database

- **Engine:** PostgreSQL
- **ORM:** Prisma

## Shared Validation & Types

- **Zod** schemas are the single source of truth for validation and shared types.
- Schemas live in `packages/shared` and are imported by both the frontend and the backend.
- No type duplication between client and server.

## Authentication

- JWT stored in **httpOnly cookies** (not localStorage).
- Two roles: `user` and `admin`.
- Role is encoded in the JWT payload and validated server-side on every protected route.

## AI Integration

- All LLM calls are made **server-side only** — the API key never reaches the client.
- LLM access is abstracted behind a `ReviewProvider` interface in `apps/api`. The provider and model are selected via environment variables, making it easy to swap providers without changing business logic.
- MVP provider: OpenAI or Anthropic (decided at project setup).
- The chosen provider must support **structured output via JSON schema**.
- Every model response is validated against a Zod schema on the server. An invalid or failed response marks the review as **failed** without consuming the user's daily limit; the user may retry.
- The API key is stored in environment variables only (never hard-coded or committed).
- **Per-user daily review limit** is enforced to prevent abuse; configured via environment variable, default **20**. Admins are exempt from the limit.
- Every AI call is logged with: model name, prompt tokens, completion tokens, total cost estimate, and response time.

## Testing

| Scope | Tool |
|-------|------|
| Unit tests (`apps/api`, `packages/shared`) | Vitest |
| Component tests (`apps/web`) | Vitest + React Testing Library |
| API integration tests | Supertest |
| End-to-end tests (`apps/e2e`) | Playwright |

## Local Infrastructure

- Docker is used **only for PostgreSQL** in local development (see `structure.md`). Apps are not containerized during development.

## Deployment

- Deployment platform is not decided and is out of scope until the deployment stage.
- Do not add any platform-specific configuration or dependencies.

## Dependency Versions

Use the latest stable versions of all libraries at the time of code generation. Pin exact versions in `package.json` (no `^` or `~` ranges in production dependencies).