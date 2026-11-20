# uptime-monitor

A simple uptime monitoring API built with Hono, Drizzle ORM and PostgreSQL
(Neon). Runs on **Cloudflare Workers** — locally through `wrangler dev` and in
production on Cloudflare.

## Stack

- [Hono](https://hono.dev) — HTTP framework
- [Drizzle ORM](https://orm.drizzle.team) — schema + migrations
- [Neon serverless driver](https://neon.tech/docs/serverless/serverless-drivers) — HTTP Postgres
- [Zod](https://zod.dev) — env/config + request validation
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — pure-JS password hashing
- TypeScript, bundled and served by Wrangler
- Vitest for tests

## Requirements

- Node.js 24+ — only to run the `pnpm`, Wrangler and Drizzle CLIs. The
  application itself runs on Workerd (`wrangler dev` locally, Cloudflare in
  production).
- pnpm
- A PostgreSQL database (Neon)
- A Cloudflare account (for deployment)

> **Note:** password hashing uses bcrypt cost 4 (`SALT_ROUNDS` in
> `src/modules/auth/security.ts`), which fits the Workers Free plan. Raising it
> to 10–12 gives stronger hashes but needs a paid plan (the Free plan's 10 ms
> CPU limit is too small).

## Setup (local)

```bash
pnpm install
pnpm cf:types                    # generate Worker binding types
cp .dev.vars.example .dev.vars   # then fill in the values
pnpm db:migrate                  # apply migrations
pnpm dev                         # wrangler dev on http://localhost:8787
```

`pnpm dev` runs the Worker in Workerd, the same runtime Cloudflare uses in
production. It reads local bindings from `.dev.vars`; non-secret values live in
the `vars` block of `wrangler.jsonc`.

`pnpm db:migrate` applies migrations with `drizzle-kit` and loads `.dev.vars`
by default, so there is only one local environment file to maintain.

## Deploying to Cloudflare Workers

`wrangler.jsonc` is already configured (`main: src/worker.ts`,
`nodejs_compat`).

1. Log in and set the two secrets (they are never written to the config file):

   ```bash
   pnpm wrangler login
   pnpm wrangler secret put DATABASE_URL
   pnpm wrangler secret put JWT_SECRET
   ```

2. Create a gitignored `.env.production` containing only the production
   connection string, then apply migrations:

   ```dotenv
   DATABASE_URL='postgresql://...'
   ```

   ```bash
   pnpm db:migrate:prod
   ```

   The migration tooling runs from the CLI (not from the Worker), so production
   migrations still require the `drizzle-kit` command. It prints the target
   database host before applying anything, so you can confirm it is the
   production branch.

3. Deploy:

   ```bash
   pnpm deploy
   ```

   Validate the bundle without publishing first:

   ```bash
   pnpm deploy:dry-run
   ```

Non-secret settings (`APP_NAME`, `APP_VERSION`, `NODE_ENV`, `LOG_LEVEL`) live in
the `vars` block of `wrangler.jsonc`. Logs are enabled through Workers
observability and can be streamed with `pnpm wrangler tail`.

## Environment variables

| Variable       | Required | Default       | Description                                                        |
| -------------- | -------- | ------------- | ------------------------------------------------------------------ |
| `APP_NAME`     | yes      | —             | App name returned by the API                                       |
| `APP_VERSION`  | yes      | —             | App version returned by the API                                    |
| `DATABASE_URL` | yes      | —             | PostgreSQL connection string                                       |
| `JWT_SECRET`   | yes      | —             | HMAC secret used to sign JWTs                                      |
| `NODE_ENV`     | no       | `development` | `development` / `test` / `production`                              |
| `LOG_LEVEL`    | no       | `info`        | `fatal` / `error` / `warn` / `info` / `debug` / `trace` / `silent` |

- Locally these come from `.dev.vars` (secrets) and `wrangler.jsonc` `vars`
  (non-secrets). `wrangler dev` loads them into `c.env`.
- In production they come from Cloudflare secrets and `wrangler.jsonc` `vars`.
- The migration and Studio commands load `.dev.vars` by default, or
  `.env.production` when `ENV_FILE=.env.production` is set.

## Environments and migrations

Do not comment database URLs in and out of one file. Use one file per target:

| File               | Used by                                           | Contents                                 |
| ------------------ | ------------------------------------------------- | ---------------------------------------- |
| `.dev.vars`        | `pnpm dev`, `pnpm db:migrate`, `pnpm db:studio`   | Local DB + app secrets                   |
| `.env.production`  | `pnpm db:migrate:prod`, `pnpm db:studio:prod`     | Production DB only (gitignored)          |
| Cloudflare secrets | the deployed Worker                               | Production `DATABASE_URL` + `JWT_SECRET` |
| `wrangler.jsonc`   | local Worker (`wrangler dev`) and deployed Worker | Non-secret `vars`                        |

Typical flow after changing a schema:

```bash
pnpm db:generate      # write the SQL migration from src/modules/**/schema.ts
pnpm db:migrate       # apply it to the local/dev branch
pnpm db:migrate:prod  # apply it to the production branch
pnpm deploy           # deploy the Worker
```

### Troubleshooting: `relation "..." already exists`

Drizzle decides what to run from `drizzle.__drizzle_migrations` (it matches the
migration **folder name**). If a database already has the tables but that table
is empty, Drizzle tries to re-run the first migration and hits
`relation "monitors" already exists`.

This usually means the schema was created by something other than
`drizzle-kit migrate` (for example `drizzle-kit push`, or a Neon branch whose
schema came from a database without migration history). The fix is to
**baseline**: insert a row for the migration that already matches the existing
schema, then run migrate normally so only the pending migrations are applied.
Never drop/recreate production tables to work around this.

## Scripts

| Script                 | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `pnpm dev`             | Start the Worker locally with `wrangler dev`        |
| `pnpm deploy`          | Deploy to Cloudflare Workers                        |
| `pnpm deploy:dry-run`  | Bundle the Worker without deploying                 |
| `pnpm cf:types`        | Generate Worker binding types with `wrangler types` |
| `pnpm build`           | Type-check the source with `tsc --noEmit`           |
| `pnpm test`            | Run the test suite                                  |
| `pnpm db:generate`     | Generate a migration from schema changes            |
| `pnpm db:migrate`      | Apply pending migrations to the local/dev database  |
| `pnpm db:migrate:prod` | Apply pending migrations to production              |
| `pnpm db:studio`       | Open Drizzle Studio for the local/dev database      |
| `pnpm db:studio:prod`  | Open Drizzle Studio for production                  |

## Endpoints

- `GET /` — returns the app name and version
- `GET /health` — pings the database
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me` — requires `Authorization: Bearer <token>`

## Project structure

```
src/
  worker.ts             Cloudflare Worker entry point
  app.ts                Hono app (middleware + routes)
  config.ts             env/bindings validation (zod)
  lib/logger.ts         Worker-compatible JSON logger
  db/connection.ts      lazily-cached Drizzle client (Neon HTTP)
  db/dbUtils.ts         retry/error helpers
  middleware/rateLimit.ts  Cloudflare rate-limiting binding middleware
  modules/
    users/schema.ts     users table
    monitors/schema.ts  monitors table
drizzle/                generated SQL migrations
wrangler.jsonc          Worker config (entry, vars, rate limiting, compatibility)
.dev.vars.example       local Worker secrets template
```

### Runtime

`src/worker.ts` is the only entry point. It exports the Hono app, and Wrangler
serves it through Workerd both locally and in production. Configuration and
bindings are read from `c.env`, and the rate limiter uses the
`FREE_RATE_LIMITER` binding from `wrangler.jsonc`.
