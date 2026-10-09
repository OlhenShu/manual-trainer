# Requirements Document

## Introduction

This feature covers the foundational layer of the Manual QA Trainer web application: monorepo scaffolding, local development startup, database setup, user authentication (register, login, logout, current user), role-based access control (user/admin), admin seeding, a unified API error format, rate limiting, and the web authentication pages.

All UI text is in Ukrainian. Code, variable names, and commit messages are in English.

Out of scope for this spec: scenarios, task submissions, AI review, statistics.

## Glossary

- **System**: The Manual QA Trainer application as a whole.
- **API**: The Express HTTP server running in `apps/api`.
- **Web**: The React client running in `apps/web`.
- **Shared**: The `packages/shared` package containing Zod schemas and shared TypeScript types.
- **DB**: The PostgreSQL database accessed via Prisma ORM.
- **User**: An authenticated person with role `user` or `admin`.
- **Admin**: A User whose role is `admin`.
- **JWT**: JSON Web Token encoding only the user's ID (`sub` claim), stored in an httpOnly cookie. The role is never stored in the token.
- **Auth_Middleware**: Server-side Express middleware that verifies the JWT from the httpOnly cookie on every protected route.
- **Role_Guard**: Client-side React component that prevents rendering protected routes unless the current user holds the required role.
- **Seed_Script**: A Node.js script located in `apps/api` that creates the initial Admin account via direct database access.
- **Error_Response**: A JSON object returned by the API on any error, with shape `{ error: { code: string, message: string, details?: { field: string, message: string }[] } }`. The `details` array is present only on 422 validation errors. Successful responses are NOT wrapped in any envelope — they return the resource directly.
- **Error_Code**: A string constant defined in `packages/shared` identifying the category of an error. Valid values: `VALIDATION_ERROR`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR`.

---

## Requirements

### Requirement 1: Monorepo Scaffold & Local Development Startup

**User Story:** As a developer, I want to start the entire local development environment with a single command, so that I can begin working without manual setup of individual services.

#### Acceptance Criteria

1. THE System SHALL provide a pnpm workspace containing `apps/web`, `apps/api`, `apps/e2e`, and `packages/shared` as separate workspace packages.
2. THE System SHALL provide a `docker-compose.yml` at the repository root that starts exactly two PostgreSQL databases: one for development and one for tests.
3. THE System SHALL provide a root `dev` script that starts the PostgreSQL databases via Docker Compose and concurrently runs `apps/web` and `apps/api` with hot reload, using a single terminal command.
4. THE System SHALL provide an `.env.example` file in `apps/api` listing every required environment variable with placeholder values and inline comments describing their purpose.
5. THE System SHALL provide a `tsconfig.base.json` at the repository root that all workspace `tsconfig.json` files extend.
6. THE System SHALL provide a single ESLint flat config (`eslint.config.js`) and a single Prettier config (`.prettierrc`) at the repository root covering all workspaces.
7. IF the `JWT_SECRET` environment variable is not set when the API process starts, THE API SHALL exit with a non-zero code and print a descriptive error message to stderr.
8. THE API SHALL read the JWT lifetime from the `JWT_EXPIRES_IN` environment variable, defaulting to 7 days when the variable is not set.
9. THE Web development server (Vite) SHALL proxy all requests under `/api` to the API server, so that the Web and the API share one origin in development and no CORS configuration is required.
10. THE System SHALL provide a root `test` script that applies Prisma migrations to the test database and then runs Vitest across all workspaces.
11. THE System SHALL provide a root `test:e2e` script that runs the Playwright test suite in `apps/e2e`.

---

### Requirement 2: Database Schema & Initial Migration

**User Story:** As a developer, I want a User model in the database with all required fields, so that the application can persist and retrieve user accounts.

#### Acceptance Criteria

1. THE DB SHALL contain a `users` table created by a Prisma migration with the following columns: `id` (UUID primary key), `email` (unique, non-nullable string, stored lowercase), `passwordHash` (non-nullable string), `role` (enum: `user` | `admin`, non-nullable, default `user`), `createdAt` (timestamp with timezone, default `now()`).
2. WHEN the Prisma migration is applied to a clean database, THE DB SHALL contain the `users` table with all columns and constraints defined in criterion 1.
3. THE Shared package SHALL define a public user Zod schema exposing only `id`, `email`, `role`, and `createdAt`. The `passwordHash` field MUST NOT be part of any shared schema, any API response body, or any client-side type.

---

### Requirement 3: User Registration

**User Story:** As a visitor, I want to register a new account with my email and password, so that I can access the application.

#### Acceptance Criteria

1. WHEN a `POST /api/auth/register` request is received with a valid email and a password of at least 8 characters whose UTF-8 encoding does not exceed 72 bytes, THE API SHALL normalise the email (trim and lowercase), create a new User with role `user`, store a bcrypt hash of the password, set a JWT httpOnly cookie following the general cookie security rule (Requirement 6, criterion 5), and return HTTP 201 with the user's public profile (id, email, role, createdAt).
2. WHEN a `POST /api/auth/register` request is received with an email that already exists in the DB (compared case-insensitively), THE API SHALL return HTTP 409 with an Error_Response using code `EMAIL_TAKEN`.
3. WHEN a `POST /api/auth/register` request is received with an invalid email format, a password shorter than 8 characters, or a password whose UTF-8 encoding exceeds 72 bytes, THE API SHALL return HTTP 422 with an Error_Response using code `VALIDATION_ERROR` and a `details` array listing each validation failure. The validation error for exceeding the upper bound SHALL use the key `PASSWORD_TOO_LONG`.
4. THE API SHALL validate the registration request body against the shared Zod schema from `packages/shared` before any database access.

---

### Requirement 4: User Login

**User Story:** As a registered user, I want to log in with my email and password, so that I receive an authenticated session.

#### Acceptance Criteria

1. WHEN a `POST /api/auth/login` request is received with a valid email and the correct password, THE API SHALL normalise the email (trim and lowercase), set a JWT httpOnly cookie following the general cookie security rule (Requirement 6, criterion 5), and return HTTP 200 with the user's public profile (id, email, role, createdAt).
2. WHEN a `POST /api/auth/login` request is received with an email that does not exist in the DB or an incorrect password, THE API SHALL return HTTP 401 with an Error_Response using code `INVALID_CREDENTIALS`. The response MUST NOT indicate which of the two values was wrong.
3. WHEN a `POST /api/auth/login` request is received with an invalid request body, THE API SHALL return HTTP 422 with an Error_Response using code `VALIDATION_ERROR`.

---

### Requirement 5: Logout & Current User

**User Story:** As an authenticated user, I want to log out and query my current session, so that I can manage my authentication state.

#### Acceptance Criteria

1. WHEN a `POST /api/auth/logout` request is received, THE API SHALL clear the JWT httpOnly cookie and return HTTP 200.
2. WHEN a `GET /api/auth/me` request is received with a valid JWT cookie, THE API SHALL return HTTP 200 with the current user's public profile (id, email, role, createdAt).
3. WHEN a `GET /api/auth/me` request is received without a JWT cookie or with an expired or invalid JWT, THE API SHALL return HTTP 401 with an Error_Response using code `UNAUTHORIZED`.
4. THE `GET /api/auth/me` endpoint is a protected route that passes through Auth_Middleware; WHEN the JWT is valid but the user ID encoded in the token no longer exists in the DB, THE Auth_Middleware SHALL return HTTP 401 with an Error_Response using code `UNAUTHORIZED`.

---

### Requirement 6: Server-Side Route Protection & API Error Conventions

**User Story:** As a system operator, I want every protected API endpoint to verify the caller's identity and role before processing the request, so that unauthorised access is prevented and the API surface behaves consistently.

#### Acceptance Criteria

1. THE Auth_Middleware SHALL extract the JWT from the httpOnly cookie on each request, verify its signature and expiry, load the user record from the DB by the ID encoded in the JWT, and attach the full DB user (id, email, role) to the request context. IF the user no longer exists in the DB, THE Auth_Middleware SHALL return HTTP 401 with an Error_Response using code `UNAUTHORIZED`. The role used for all subsequent authorisation checks comes from the DB record, not from the JWT payload.
2. WHEN a request reaches a protected route without a valid JWT, THE Auth_Middleware SHALL return HTTP 401 with an Error_Response using code `UNAUTHORIZED` before the route handler executes.
3. WHEN a request reaches an admin-only route from an authenticated user whose role in the DB is `user`, THE Auth_Middleware SHALL return HTTP 403 with an Error_Response using code `FORBIDDEN` before the route handler executes.
4. THE System SHALL expose at least one `GET /api/admin/ping` endpoint protected by the admin role check to verify admin-only route protection is working.
5. WHENEVER THE API sets a JWT cookie, THE API SHALL set the cookie attributes `httpOnly: true`, `sameSite: strict`, and `secure: true` in production environments.
6. WHEN a request is received for an API path that has no matching route handler, THE API SHALL return HTTP 404 with an Error_Response using code `NOT_FOUND`.
7. THE Shared package SHALL export the Error_Code constants (`VALIDATION_ERROR`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR`) so that both `apps/api` and `apps/web` reference the same values.

---

### Requirement 7: Client-Side Route Protection

**User Story:** As a developer, I want the React client to guard protected pages based on authentication state and role, so that unauthenticated or unauthorised users cannot access restricted views.

#### Acceptance Criteria

1. THE Role_Guard SHALL redirect unauthenticated users to the login page when they attempt to navigate to any route marked as requiring authentication.
2. THE Role_Guard SHALL redirect authenticated users with role `user` to a "not authorised" page when they attempt to navigate to any route marked as admin-only.
3. WHEN the Web application loads, THE Web SHALL call `GET /api/auth/me` to restore the current user's session state before rendering any protected route.
4. WHILE the `GET /api/auth/me` request is pending, THE Web SHALL display a loading indicator and SHALL NOT render the protected route content or redirect the user.

---

### Requirement 8: Web Authentication Pages

**User Story:** As a visitor or authenticated user, I want accessible registration and login pages with inline validation, so that I can create an account or sign in without confusion.

#### Acceptance Criteria

1. THE Web SHALL provide a registration page with a form containing fields for email and password, validated on the client using the same Zod schemas defined in `packages/shared`.
2. THE Web SHALL provide a login page with a form containing fields for email and password, validated on the client using the same Zod schemas defined in `packages/shared`.
3. WHEN a client-side validation error occurs on the registration or login form, THE Web SHALL display a Ukrainian error message next to the relevant field before submitting the request to the API.
4. WHEN the API returns an error response, THE Web SHALL display a Ukrainian user-facing message derived from the `code` field of the Error_Response above the form. The raw `message` field from the API MUST NOT be displayed to the user.
5. THE Web SHALL provide a logout control visible to authenticated users on every page that requires authentication. WHEN the control is activated, THE Web SHALL call `POST /api/auth/logout` and redirect the user to the login page.
6. WHEN an authenticated user navigates to the login page or the registration page, THE Web SHALL redirect the user to the home page.
7. WHEN a user is redirected to the login page because they attempted to access a protected route, THE Web SHALL store the original route and redirect the user back to that route after successful login.

---

### Requirement 9: Admin Seed Script

**User Story:** As a developer, I want to create the initial admin account via a seed script, so that the system is operable from day one without requiring manual DB access.

#### Acceptance Criteria

1. THE Seed_Script SHALL accept `ADMIN_EMAIL` and `ADMIN_PASSWORD` as environment variables, normalise `ADMIN_EMAIL` (trim and lowercase) before performing the lookup and before inserting into the DB, and create an account with role `admin` if none exists.
2. WHEN the Seed_Script is executed without `ADMIN_EMAIL` or `ADMIN_PASSWORD` set, THE Seed_Script SHALL exit with a non-zero code and print a descriptive error message to stderr.
3. THE Seed_Script SHALL validate `ADMIN_PASSWORD` against the same password rules as registration (minimum 8 characters; UTF-8 encoding must not exceed 72 bytes). IF the password fails validation, THE Seed_Script SHALL exit with a non-zero code and print the validation error to stderr.
4. IF a user with `ADMIN_EMAIL` already exists in the DB, THE Seed_Script SHALL make no changes and SHALL print a warning to stdout stating the existing user's role.

---

### Requirement 10: Unified API Error Format

**User Story:** As an API consumer, I want consistently shaped error responses, so that I can handle errors uniformly without inspecting response bodies case by case.

#### Acceptance Criteria

1. THE API SHALL return all error responses in the Error_Response format `{ error: { code: string, message: string, details?: { field: string, message: string }[] } }` for every 4xx and 5xx HTTP status code.
2. WHEN the API returns a 422 response, THE API SHALL include a `details` array in the Error_Response containing one entry per validation failure with `field` and `message`.
3. WHEN an unhandled exception occurs in the API, THE API SHALL log the full error server-side and return HTTP 500 with an Error_Response using code `INTERNAL_ERROR` without leaking internal stack traces or error messages to the client.
4. THE API SHALL use only Error_Code constants exported from `packages/shared` as the `code` value in every Error_Response.

---

### Requirement 11: Rate Limiting

**User Story:** As a system operator, I want login and registration endpoints to be rate-limited per IP address, so that brute-force and abuse attempts are mitigated.

#### Acceptance Criteria

1. THE API SHALL apply a rate limit to `POST /api/auth/login` per IP address. The limit and window duration SHALL be configurable via environment variables.
2. THE API SHALL apply a rate limit to `POST /api/auth/register` per IP address. The limit and window duration SHALL be configurable via environment variables.
3. WHEN a client exceeds the rate limit on either endpoint, THE API SHALL return HTTP 429 with an Error_Response using code `RATE_LIMITED`.

---

### Requirement 12: Web Placeholder Pages

**User Story:** As a developer, I want minimal placeholder pages for the protected home, admin, and not-authorised routes, so that the client-side route guards and role checks can be verified end-to-end.

#### Acceptance Criteria

1. THE Web SHALL provide a protected home page (accessible to users with role `user` or `admin`) that displays the current user's email and the logout control. All visible text is in Ukrainian.
2. THE Web SHALL provide an admin-only placeholder page that calls `GET /api/admin/ping` on load and displays the API response. All visible text is in Ukrainian.
3. THE Web SHALL provide a `"not authorised"` page shown to authenticated users who attempt to access an admin-only route without the `admin` role. All visible text is in Ukrainian.

---

## Correctness Properties

### Property 1: Authentication Integrity
A JWT cookie set by the API always corresponds to an existing user in the DB, encodes only the user's ID (`sub`), and is verifiable with the server's JWT_SECRET.

### Property 2: Password Security
No plaintext password is ever stored in the DB or returned in any API response. All password storage uses bcrypt with a work factor of at least 10.

### Property 3: Role Enforcement
A request from a User with role `user` never successfully reaches a handler designated for role `admin`. A request without a valid JWT never reaches any handler designated as requiring authentication. The role used for authorisation is always loaded from the DB on each request, not read from the JWT payload.

### Property 4: Error Format Consistency
Every API response with a 4xx or 5xx status code conforms to the Error_Response shape `{ error: { code: string, message: string, details?: { field: string, message: string }[] } }`. No 4xx or 5xx response body deviates from this format. The `details` field is present if and only if the status code is 422. Successful responses are never wrapped in an envelope.

### Property 5: Shared Schema Authority
The `packages/shared` Zod schemas are the only definitions of request/response shapes used by both `apps/api` and `apps/web`. No type alias, interface, or inline schema in either app duplicates or contradicts a shape already defined in `packages/shared`. The `passwordHash` field never appears in any shared schema, API response body, or client-side type.

### Property 6: Password Length Bounds
No user account is ever created in the DB with a password that, before hashing, was shorter than 8 characters or whose UTF-8 encoding exceeds 72 bytes. This applies to both the registration endpoint and the Seed_Script.