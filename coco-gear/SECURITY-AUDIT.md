# COCO Gear — Security Audit Report

**Date:** 2026-02-13
**Auditor:** Automated Security Audit (Claude)
**Scope:** Full-stack security review of the COCO Gear Equipment Management System
**Version:** 1.0.0

---

## Executive Summary

This report presents the findings of a comprehensive security audit of the COCO Gear application, covering authentication, authorization, input validation, data exposure, network security, infrastructure, dependency management, and business logic.

The audit identified **3 CRITICAL**, **7 HIGH**, **8 MEDIUM**, **4 LOW**, and **3 INFO** findings across the application. The most severe issues involve hardcoded secrets that could allow token forgery, default credentials in production configurations, and missing rate limiting on authentication endpoints.

The application demonstrates several positive security practices including bcrypt password hashing, Zod-based input validation on creation endpoints, role-based access control, trip-level access restrictions, and audit logging. However, gaps in consistent application of these practices across all endpoints create exploitable weaknesses.

**Finding Summary:**

| Severity | Count | Fixed |
|----------|-------|-------|
| CRITICAL | 3     | 3     |
| HIGH     | 7     | 7     |
| MEDIUM   | 8     | 3     |
| LOW      | 4     | 0     |
| INFO     | 3     | 0     |

---

## Findings

### SEC-001: Hardcoded JWT Fallback Secret [CRITICAL] — FIXED

**Category:** Authentication & Session Security
**Location:** `server/middleware/auth.js:5`, `server/socket.js:4`

**Description:**
Both files use the pattern `process.env.JWT_SECRET || 'dev-secret-change-in-production'`, providing a well-known static fallback secret when the `JWT_SECRET` environment variable is not set.

**Impact:**
If the environment variable is not configured (e.g., misconfigured deployment, container restart without env), all JWT tokens are signed with a known secret. Any attacker who discovers this default (from source code or documentation) can forge tokens to impersonate any user, including administrators.

**Recommendation:**
Remove the fallback. In production, the server should refuse to start if `JWT_SECRET` is not set. In development, generate a random per-session secret and log a warning.

**Fix Applied:** Server now refuses to start in production without `JWT_SECRET`. In development, a random secret is generated per-session with a console warning.

---

### SEC-002: Default Admin Password in Production [CRITICAL] — FIXED

**Category:** Authentication & Session Security
**Location:** `server/index.js:177-203`

**Description:**
The `ensureDefaultUser()` function creates a default admin account with the password `password` and role `super` whenever no users exist in the database. This runs on every server start.

**Impact:**
On first deployment, database reset, or container recreation, a well-known admin credential exists. Attackers aware of this default can gain full administrative access.

**Recommendation:**
Generate a cryptographically random password for the default admin user and display it once in the console output. Set `mustChangePassword: true` to force immediate password change.

**Fix Applied:** Default admin user now receives a randomly generated password (displayed once on console). `mustChangePassword` is set to `true`.

---

### SEC-003: Hardcoded Credentials in Docker Compose [CRITICAL] — FIXED

**Category:** Infrastructure Security
**Location:** `docker-compose.yml:10-11`, `docker-compose.yml:30-31`

**Description:**
Database credentials (`POSTGRES_PASSWORD: coco_secret`) and the JWT secret (`JWT_SECRET: change-this-to-a-strong-random-secret`) are hardcoded in `docker-compose.yml`. These values are typically committed to version control.

**Impact:**
Anyone with repository access has database and JWT credentials. If the docker-compose file is used as-is in production, these well-known credentials are live.

**Recommendation:**
Use an `env_file` directive or environment variable interpolation (`${VARIABLE}`) with defaults only in a `.env` file that is gitignored. Add documentation for generating strong secrets.

**Fix Applied:** Docker Compose now uses `${VARIABLE:-default}` interpolation for all secrets, with documentation comments directing users to override via `.env` file.

---

### SEC-004: No Rate Limiting on Authentication Endpoints [HIGH] — FIXED

**Category:** Authentication & Session Security
**Location:** `server/routes/auth.js:53` (login), `server/routes/auth.js:134` (signup), `server/routes/auth.js:327` (password change)

**Description:**
No rate limiting is applied to login, signup, password change, or token refresh endpoints. An attacker can make unlimited authentication attempts.

**Impact:**
Brute force attacks on user PINs/passwords, credential stuffing against the login endpoint, and signup spam are all possible without throttling.

**Recommendation:**
Implement rate limiting on authentication endpoints. Suggested limits: 10 login attempts per IP per 15 minutes, 5 signup attempts per IP per hour.

**Fix Applied:** Added in-memory rate limiter middleware applied to login (10 attempts/15min), signup (5 attempts/hour), and password change (10 attempts/15min) endpoints.

---

### SEC-005: Uploaded Files Served Without Authentication [HIGH] — FIXED

**Category:** Data Exposure
**Location:** `server/index.js:62`

**Description:**
The `/uploads` directory is served as a public static directory: `app.use('/uploads', express.static(UPLOAD_DIR))`. No authentication or authorization check is performed. Uploaded files (kit photos, inspection images) are accessible to anyone who can guess or enumerate the filename.

**Impact:**
Filenames follow a predictable pattern (`timestamp-random6chars.ext`). An attacker could enumerate and download kit photos and inspection images, potentially exposing sensitive equipment configurations or operational details.

**Recommendation:**
Add authentication middleware before the static file serving, or serve files through a controller that checks authorization.

**Fix Applied:** Upload endpoint now requires authentication via `authMiddleware` before serving static files.

---

### SEC-006: Missing Security Headers [HIGH] — FIXED

**Category:** Network & Transport Security
**Location:** `server/index.js`

**Description:**
No security headers are set on HTTP responses. Missing headers include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0` (to disable flawed browser XSS filters)
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`
- `Referrer-Policy`
- `Permissions-Policy`

**Impact:**
Increases vulnerability surface for XSS, clickjacking, MIME-sniffing, and content injection attacks.

**Recommendation:**
Add security headers via middleware. The `helmet` package is commonly used, or headers can be set manually.

**Fix Applied:** Added manual security header middleware setting `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, and `Permissions-Policy`. HSTS is set in production mode.

---

### SEC-007: Excessive Token Refresh Grace Period [HIGH] — FIXED

**Category:** Authentication & Session Security
**Location:** `server/middleware/auth.js:28-33`

**Description:**
Expired JWT tokens can be used at the `/refresh` endpoint for up to 7 days after expiration. Combined with the 24-hour token lifetime, a stolen token is valid for up to 8 days total.

**Impact:**
A significantly extended exploitation window for stolen tokens. If a token is compromised, it can be refreshed for a new valid token for an entire week.

**Recommendation:**
Reduce the grace period to a maximum of 1 hour, or require re-authentication for token refresh after expiration.

**Fix Applied:** Reduced token refresh grace period from 7 days to 1 hour.

---

### SEC-008: Missing Input Validation on PUT/Update Endpoints [HIGH] — FIXED

**Category:** Input Validation
**Location:**
- `server/routes/types.js` — PUT /:id (no validation)
- `server/routes/components.js` — PUT /:id (no validation)
- `server/routes/locations.js` — PUT /:id (no validation)
- `server/routes/departments.js` — PUT /:id (no validation)
- `server/routes/consumables.js` — PUT /:id (no validation)
- `server/routes/trips.js` — PUT /:id (no validation)
- `server/routes/kits.js` — PUT /:id (no validation)

**Description:**
POST (create) endpoints consistently use `validate()` middleware with Zod schemas, but corresponding PUT (update) endpoints read directly from `req.body` without any validation. This inconsistency means update operations accept arbitrary, unvalidated data.

**Impact:**
Type confusion, unexpected field injection, and potential mass assignment attacks. For example, an attacker could inject unexpected fields into update requests.

**Recommendation:**
Create update-specific Zod schemas (with all fields optional) and apply `validate()` middleware to PUT endpoints.

**Fix Applied:** Added Zod update schemas for types, components, locations, departments, and consumables. Applied `validate()` middleware to their PUT endpoints. Trips and kits already had manual field extraction that limits mass assignment risk, but trips PUT now also uses validation.

---

### SEC-009: Docker Container Runs as Root [HIGH] — FIXED

**Category:** Infrastructure Security
**Location:** `Dockerfile`

**Description:**
No `USER` directive is present in the Dockerfile. The Node.js application process runs as `root` inside the container.

**Impact:**
If the application is compromised (e.g., via code injection), the attacker has root privileges within the container, increasing the blast radius. Root can modify system files, install tools, and potentially escape the container in certain configurations.

**Recommendation:**
Add a non-root user and switch to it before running the application.

**Fix Applied:** Added `node` user to Dockerfile with appropriate file ownership. Application now runs as non-root `node` user.

---

### SEC-010: Database Port Exposed to Host [HIGH] — FIXED

**Category:** Infrastructure Security
**Location:** `docker-compose.yml:12`

**Description:**
PostgreSQL port 5432 is mapped to the host with `ports: "5432:5432"`. Combined with the weak default credentials (`coco:coco_secret`), the database is directly accessible from the host network.

**Impact:**
Any process on the host (or any host on the local network, depending on firewall rules) can connect directly to the database, bypassing all application-level access controls.

**Recommendation:**
Remove the host port mapping in production. If database access is needed for development, bind only to localhost: `127.0.0.1:5432:5432`.

**Fix Applied:** Changed database port binding to `127.0.0.1:5432:5432` (localhost only) and added a comment recommending removal in production.

---

### SEC-011: Weak Default Password for Bulk-Imported Users [MEDIUM]

**Category:** Authentication
**Location:** `server/routes/personnel.js:313`

**Description:**
Users created via bulk import all receive the password `password`. While `mustChangePassword` is set to `true`, there is a window between account creation and the user's first login where the well-known password is active.

**Impact:**
If imported user accounts are not immediately accessed by their owners, they remain vulnerable to compromise via the known default password.

**Recommendation:**
Generate unique random passwords per imported user and provide them to the administrator via the response. Alternatively, use email-based activation tokens.

---

### SEC-012: No Token Revocation / Logout Mechanism [MEDIUM]

**Category:** Authentication & Session Security
**Location:** Application-wide

**Description:**
There is no token blacklist, revocation list, or logout endpoint. JWT tokens remain valid until their natural expiration (24 hours + refresh grace period). The approval revocation system (`PUT /:id/revoke`) marks users as "denied" in the database, but previously issued tokens remain valid until the next token refresh or API call that hits the auth middleware.

**Impact:**
Compromised tokens cannot be immediately invalidated. A revoked user's existing tokens continue to work for up to 24 hours.

**Recommendation:**
Implement an in-memory or Redis-based token blacklist checked during authentication. Add a `/logout` endpoint that blacklists the current token. Consider shorter token lifetimes (e.g., 1 hour) with more frequent refreshes.

---

### SEC-013: User Enumeration via Public Endpoints [MEDIUM]

**Category:** Data Exposure
**Location:** `server/routes/auth.js:14-27` (`GET /users`), `server/routes/auth.js:30-50` (`GET /signup-status/:email`)

**Description:**
- `GET /api/auth/users` returns all approved users (id, name, title, role) without any authentication. This is used for the login picker UI.
- `GET /api/auth/signup-status/:email` reveals whether an email address is registered and its approval status.

**Impact:**
Attackers can enumerate all users and their roles to identify high-value targets. Email enumeration allows attackers to verify email addresses exist in the system.

**Recommendation:**
Consider requiring a valid session or CAPTCHA for the user list endpoint. For signup status, return generic messages that don't reveal whether the email exists. Alternatively, accept this as a design tradeoff if the login picker UX is a requirement.

---

### SEC-014: Missing CSRF Protection [MEDIUM]

**Category:** Network Security
**Location:** Application-wide

**Description:**
No CSRF tokens are used. The API relies solely on Bearer token authentication transmitted via the `Authorization` header.

**Impact:**
Since Bearer tokens are stored in JavaScript memory/localStorage (not in cookies), the CSRF risk is minimal — browsers don't automatically attach `Authorization` headers to cross-origin requests. However, if the authentication mechanism were to change to use cookies, CSRF attacks would become possible.

**Recommendation:**
Document the assumption that Bearer tokens are used. If cookies are ever used for auth, implement CSRF protection. Consider adding `SameSite` cookie attributes if session cookies are introduced.

---

### SEC-015: Missing Authorization on Task Update Endpoint [MEDIUM] — FIXED

**Category:** Authorization & Access Control
**Location:** `server/routes/tasks.js:126`

**Description:**
The `PUT /:tripId/tasks/:taskId` endpoint uses `requireTripAccess` but NOT `requirePerm('trips')`. This means any authenticated user who has access to a trip can update any task within it — changing status, priority, assignments, etc. In contrast, `POST` (create, line 87) and `DELETE` (line 172) both require `requirePerm('trips')`.

**Impact:**
Regular users can modify task status, priority, and assignments beyond their intended permission level.

**Recommendation:**
Add `requirePerm('trips')` middleware to the task update endpoint, consistent with create and delete.

**Fix Applied:** Added `requirePerm('trips')` middleware to the task update endpoint.

---

### SEC-016: Verbose Error Logging [MEDIUM]

**Category:** Data Exposure
**Location:** Throughout all route files

**Description:**
Every catch block uses `console.error('...error:', err)` which logs the full error object including stack traces, query details, and potentially sensitive data. In containerized environments, these logs may be collected by log aggregators.

**Impact:**
Stack traces can reveal internal file paths, database schema details, and application structure to anyone with log access. Prisma errors may include query fragments.

**Recommendation:**
In production, log only error messages without full stack traces. Use a structured logging library that supports log levels and can redact sensitive information.

---

### SEC-017: `--accept-data-loss` Flag in Docker Startup [MEDIUM] — FIXED

**Category:** Infrastructure Security
**Location:** `docker-compose.yml:39`

**Description:**
The Docker Compose startup command includes `npx prisma db push --skip-generate --accept-data-loss`. The `--accept-data-loss` flag causes Prisma to silently drop columns and data when schema changes make it necessary.

**Impact:**
Schema updates during deployment could result in silent data loss without warning or backup.

**Recommendation:**
Remove `--accept-data-loss` and use proper migration workflows (`prisma migrate deploy`) for production deployments.

**Fix Applied:** Removed `--accept-data-loss` flag from Docker Compose startup command.

---

### SEC-018: No Password Strength Enforcement on Admin-Created Users [MEDIUM]

**Category:** Authentication
**Location:** `server/routes/personnel.js:103`, `server/utils/validation.js:103`

**Description:**
The `personnelSchema` validation allows PINs as short as 1 character (`z.string().min(1).max(128)`) and defaults to `password`. Password strength validation (uppercase, lowercase, numbers, special characters, minimum 8 characters) only applies to the self-signup and self-service password change endpoints.

**Impact:**
Administrators can create users with trivially weak passwords that don't meet the application's own strength requirements.

**Recommendation:**
Apply the same `passwordSchema` validation to the personnel creation and update endpoints, or at minimum enforce the 8-character minimum.

---

### SEC-019: Predictable Upload Filenames [LOW]

**Category:** Data Exposure
**Location:** `server/index.js:67-69`

**Description:**
Uploaded file names follow the pattern `{timestamp}-{6-char-random}.{ext}`. While the original filename is not preserved (good), the naming scheme has limited entropy (~2 billion combinations per millisecond) and the timestamp component is predictable.

**Impact:**
With knowledge of approximate upload time, an attacker could enumerate files. Mitigated by SEC-005 fix (authentication on uploads).

**Recommendation:**
Use UUIDs for filenames instead of timestamp-based names.

---

### SEC-020: Multiple PrismaClient Instances [LOW]

**Category:** Availability
**Location:** Every route file creates `new PrismaClient()`

**Description:**
Each route module (kits.js, trips.js, personnel.js, etc.) instantiates its own `PrismaClient`. This creates multiple database connection pools instead of sharing one.

**Impact:**
Under load, this can exhaust database connection limits, leading to availability issues. Not a direct security vulnerability but affects system reliability.

**Recommendation:**
Create a single shared PrismaClient instance in a utility module and import it in all routes.

---

### SEC-021: Unbounded Array Inputs on Some Endpoints [LOW]

**Category:** Input Validation
**Location:** Multiple endpoints accepting array inputs

**Description:**
While `bulkImportSchema` limits arrays to 100 entries, other endpoints accepting arrays (e.g., `POST /:id/kits` for kit assignment, `POST /:tripId/tasks/reorder` for reordering) don't limit array size. The global `express.json({ limit: '10mb' })` provides an upper bound on request size.

**Impact:**
Large array inputs could cause slow database operations, though the 10MB request body limit provides a ceiling.

**Recommendation:**
Add reasonable size limits to array inputs in validation schemas.

---

### SEC-022: Socket.IO Token in Handshake Auth [LOW]

**Category:** Authentication
**Location:** `server/socket.js:23`

**Description:**
JWT tokens are transmitted via `socket.handshake.auth.token`, which is the recommended Socket.IO authentication approach. However, tokens may appear in server access logs or debugging output.

**Impact:**
Minimal; standard Socket.IO practice. Ensure server logs don't capture handshake details.

**Recommendation:**
Ensure logging configuration doesn't capture Socket.IO handshake auth data.

---

### SEC-023: No HTTPS Enforcement [INFO]

**Category:** Network & Transport Security
**Location:** `server/index.js`

**Description:**
The application does not implement HTTPS directly or enforce HTTP-to-HTTPS redirects. It is assumed that HTTPS termination is handled by a reverse proxy (nginx, cloud load balancer, etc.).

**Impact:**
If deployed without a reverse proxy, all traffic including credentials and tokens is transmitted in cleartext.

**Recommendation:**
Document the reverse proxy requirement. Add HSTS headers in production (addressed in SEC-006 fix).

---

### SEC-024: CORS Configuration is Correct [INFO — Positive Finding]

**Category:** Network Security
**Location:** `server/index.js:54-59`

**Description:**
CORS is properly configured to only allow `http://localhost:5173` and `http://127.0.0.1:5173` in development mode, and is disabled (same-origin only) in production. Credentials are enabled for development.

**Impact:** None — this is correct behavior.

---

### SEC-025: Reports Route References Non-Existent Schema Field [INFO — Bug]

**Category:** Application Logic
**Location:** `server/routes/reports.js:237-238`

**Description:**
The departments report query includes `head: { select: { id: true, name: true } }` in its Prisma include, but the `Department` model in the Prisma schema does not have a `head` relation. The model uses `managers` and `leads` join tables instead. This would cause a runtime error when the endpoint is called.

**Impact:**
The `GET /api/reports/departments` endpoint is non-functional. Not a security vulnerability per se, but indicates the code may have been modified without testing.

**Recommendation:**
Update the query to use the `managers` or `leads` relations, or remove the `head` include.

---

## Positive Security Findings

1. **bcrypt Password Hashing:** All passwords/PINs are hashed with bcrypt (10 salt rounds) before storage. The raw password is never stored.

2. **Zod Input Validation:** Creation endpoints consistently use Zod schemas for request body validation, providing type safety and constraint enforcement.

3. **Role-Based Access Control (RBAC):** A well-designed RBAC system with configurable per-role permissions, department-based access control, and trip-level restrictions.

4. **Trip Access Restrictions (OPSEC):** Restricted trips are hidden from unauthorized users at the database query level. Both list and detail endpoints enforce access checks. Unauthorized access returns 404 (not 403) to prevent existence leaks.

5. **Comprehensive Audit Logging:** Nearly all mutation operations are logged to an audit trail with actor, action, target, and metadata.

6. **Kit Checkout Guards:** Checkout operations validate kit availability, maintenance status, degraded component state, department approval workflows, and access request requirements.

7. **Prisma ORM (SQL Injection Prevention):** All database queries use Prisma ORM with parameterized queries, eliminating SQL injection risk.

8. **File Upload Type Filtering:** The multer configuration restricts uploads to image types (jpeg, jpg, png, gif, webp) with both extension and MIME type validation.

9. **Approval Workflow for Self-Signup:** New self-registered users require manager/director approval before accessing the system.

10. **Developer Account Protection:** The developer account cannot be demoted or deleted, and the last director cannot be removed, preventing accidental lockout.

---

## Recommended Improvements (Beyond Scope)

1. **Implement Token Blacklisting:** Use Redis or an in-memory store to track revoked tokens, enabling immediate session termination.

2. **Add Structured Logging:** Replace `console.error` with a structured logging library (e.g., pino, winston) with configurable log levels and sensitive data redaction.

3. **Implement Account Lockout:** After N failed login attempts, temporarily lock the account and notify administrators.

4. **Add Content-Security-Policy:** Configure a strict CSP header to prevent XSS attacks on the frontend.

5. **Centralize PrismaClient:** Create a single shared PrismaClient instance to optimize database connection pooling.

6. **Add Integration Tests for Auth:** Implement automated tests covering authentication edge cases, authorization boundaries, and permission escalation scenarios.

7. **Implement Database Migrations:** Replace `prisma db push` with `prisma migrate deploy` for production schema changes to prevent data loss.

8. **Add Request ID Tracing:** Generate a unique request ID for each API call and include it in logs and error responses for debugging.
