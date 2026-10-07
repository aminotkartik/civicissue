# CivicIssue

**Report it. Track it. Resolve it.**

CivicIssue is a civic issue reporting and resolution platform for residents, municipal authorities, field workers, and administrators. Residents can file location-aware reports, follow updates, support existing issues, and give feedback on resolutions. Staff use department-scoped queues to verify, assign, work, and close reports with an auditable timeline.

## What is included

- Responsive Next.js App Router application with citizen, authority, worker, and admin experiences.
- Issue reporting with image uploads, location privacy, category suggestions, duplicate checks, configurable priority scoring, and SLA deadlines.
- Status history, comments, follows, confirmations, notifications, feedback, abuse reporting, and moderation audit records.
- Department-scoped authority queues and worker assignment checks enforced in server-side actions and route handlers.
- OpenStreetMap/Leaflet maps, local development storage, and optional AI/email provider abstractions with deterministic AI behavior when no provider is configured.
- A realistic Pune demo seed set: departments, categories, demo users, and 900 reports across multiple statuses and priorities.

## Requirements

- Node.js 20 or newer and npm.
- A working native build environment for `better-sqlite3` if your platform does not provide a prebuilt binary.
- SQLite for the local/demo setup. A PostgreSQL schema/configuration path is also present for production evaluation.

## Local setup

```bash
cp .env.example .env
```

Edit `.env` before running the app. At minimum, set a unique `AUTH_SECRET` (for example, generate one with `openssl rand -base64 32`) and choose a private `DEMO_SEED_PASSWORD` for the local demo accounts. The example values are for development only; never deploy them unchanged.

Install dependencies, create the schema, and seed the local database:

```bash
npm ci
npm run db:setup
npm run dev
```

The app runs at `http://localhost:3000`. `db:setup` creates the database schema and then populates it with sample data. Local database files and uploaded files live under `data/` and are ignored by Git. Re-run `npm run db:setup` to reset the seed contents; it clears and recreates the demo data.

### Demo accounts

The seed creates these accounts:

| Role | Email |
| --- | --- |
| Citizen | `citizen@example.com` |
| Authority | `authority@example.com` |
| Admin | `admin@example.com` |
| Field worker | `worker@example.com` |

All use the password set by `DEMO_SEED_PASSWORD` when the seed runs. Do not use the example password on a public instance.

## Configuration

See [`.env.example`](.env.example) for the full list. Key settings:

- `DATABASE_URL`: defaults to a local SQLite file. `drizzle.config.ts` selects the configured schema based on the URL.
- `AUTH_SECRET`: signing secret for HTTP-only session cookies.
- `DEMO_SEED_PASSWORD`: password assigned to seed accounts.
- `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`: optional AI integration. With `AI_PROVIDER=none`, deterministic local heuristics keep classification and priority previews available.
- `STORAGE_PROVIDER`: local storage for development; configure an S3-compatible provider and its credentials for durable deployment storage.
- `EMAIL_PROVIDER`: optional email notifications. In-app notifications do not depend on email delivery.
- `NOMINATIM_URL`: optional geocoding endpoint; maps use OpenStreetMap tiles.

Do not commit `.env`, production secrets, database files, or uploaded content.

## Useful commands

```bash
npm run dev          # Next.js development server
npm run lint         # ESLint flat-config checks
npm run typecheck    # TypeScript, no emit
npm test             # Vitest unit tests
npm run build        # Optimized production build
npm run db:generate  # Generate migrations from the configured Drizzle schema
npm run db:push      # Apply the configured Drizzle schema
npm run db:seed      # Recreate the local demo dataset
npm run db:setup     # Apply schema, then seed
npm run db:reset     # Delete the local SQLite DB, then rebuild and reseed (never PostgreSQL)
```

## Architecture notes

- **UI and routing:** `app/` contains App Router pages and API route handlers; `components/` contains reusable and role-specific UI.
- **Domain rules:** `lib/status/machine.ts`, `lib/priority/engine.ts`, `lib/sla/engine.ts`, `lib/permissions/matrix.ts`, and `lib/validation/` centralize transitions, scoring, service targets, access rules, and Zod validation.
- **Persistence:** Drizzle models live in `drizzle/sqlite/schema.ts` and `drizzle/pg/schema.ts`; `lib/queries/` owns server-side reads and writes. SQLite is the verified local/demo path. Run integration checks against your chosen PostgreSQL provider before production deployment.
- **AI and maps:** AI-backed suggestions are advisory; local deterministic fallbacks are used when an external provider is not configured. Maps use Leaflet and OpenStreetMap; approximate locations are obscured in public views.
- **Files and notifications:** storage and email are configured through provider settings. In-app notifications are persisted and available without an email provider.

## Quality checks

The repository includes unit coverage for priority bands and explainability, SLA defaults and deadlines, valid status transitions, role permissions, department-scope matching, and request validation. Before submitting changes, run:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Production deployment checklist

1. Provision a managed PostgreSQL database and configure `DATABASE_URL`; apply the PostgreSQL schema with `npm run db:push` and verify all application queries against that provider.
2. Set a strong, unique `AUTH_SECRET`; do not reuse development values or seed credentials.
3. Configure durable S3-compatible file storage. Local disk may be ephemeral on serverless hosting and should not be used for user uploads in production.
4. Configure an AI provider only if desired, and review its data-processing terms before sending report text or photos to it.
5. Configure email and a public `NEXT_PUBLIC_APP_URL` if email links should be sent.
6. Seed only non-production demo data. Use a private `DEMO_SEED_PASSWORD`, and disable or remove seeded accounts before opening a public service.
7. Run lint, typecheck, unit tests, production build, and end-to-end checks in a staging environment before promoting to production.

The PostgreSQL configuration is included as a production path, but the local automated checks use SQLite; provider-specific integration and operational testing remain the deployer's responsibility.
