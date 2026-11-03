# uptime-monitor

A simple uptime monitoring API built with Hono, Drizzle ORM and PostgreSQL (Neon).
Runs on Node for local development and deploys to **Cloudflare Workers**.

## Stack

- [Hono](https://hono.dev) — HTTP framework
- [Drizzle ORM](https://orm.drizzle.team) — schema + migrations
- [Neon serverless driver](https://neon.tech/docs/serverless/serverless-drivers) — HTTP Postgres, Worker-compatible
- [Zod](https://zod.dev) — env/config + request validation
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — pure-JS password hashing (the native `bcrypt` addon cannot run on Workers)
- TypeScript, run with `tsx` locally, bundled by Wrangler for deployment

## Requirements

- Node.js 24+
- pnpm
- A PostgreSQL database (Neon)
- A Cloudflare account (for deployment)

> **Note:** password hashing uses bcrypt cost 12. On Workers this needs a paid
> plan (the Free plan's 10 ms CPU limit is too small for bcrypt). Lower
> `SALT_ROUNDS` in `src/modules/auth/security.ts` if you must stay on Free.

## Setup (local, Node)

```bash
pnpm install
cp .env.example .env   # then fill in the values
pnpm db:migrate        # apply migrations
pnpm dev
```

The server runs on http://localhost:3000 by default.

## Setup (local, Workers runtime)

Use this to run the exact runtime that production uses (workerd):

```bash
pnpm install
cp .dev.vars.example .dev.vars   # then fill in the values
pnpm db:migrate                  # migrations run from Node, not the Worker
pnpm dev:worker                  # wrangler dev on http://localhost:8787
```

## Deploying to Cloudflare Workers

`wrangler.jsonc` is already configured (`main: src/worker.ts`, `nodejs_compat`).

1. Log in and set the two secrets (they are never written to the config file):

   ```bash
   pnpm wrangler login
   pnpm wrangler secret put DATABASE_URL
   pnpm wrangler secret put JWT_SECRET
   ```

2. Apply database migrations (from your machine, against the production DB):

   ```bash
   DATABASE_URL="postgresql://..." pnpm db:migrate
   ```

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

| Variable       | Required | Default       | Description                      |
| -------------- | -------- | ------------- | -------------------------------- |
| `APP_NAME`     | yes      | —             | App name returned by the API     |
| `APP_VERSION`  | yes      | —             | App version returned by the API  |
| `DATABASE_URL` | yes      | —             | PostgreSQL connection string     |
| `JWT_SECRET`   | yes      | —             | HMAC secret used to sign JWTs    |
| `PORT`         | no       | `3000`        | HTTP port (Node dev server only) |
| `NODE_ENV`     | no       | `development` | `development` / `test` / `production` |
| `LOG_LEVEL`    | no       | `info`        | `fatal` / `error` / `warn` / `info` / `debug` / `trace` / `silent` |

- On Node these come from `.env` (loaded with `dotenv`).
- On Workers they come from `wrangler.jsonc` `vars` + secrets (and `.dev.vars`
  locally). The Node entry point validates config at startup and exits; the
  Worker validates on the first request and returns a 500 if anything is
  missing.

## Scripts

| Script              | Description                                    |
| ------------------- | ---------------------------------------------- |
| `pnpm dev`          | Start the Node dev server with watch mode      |
| `pnpm dev:worker`   | Start the Worker locally with `wrangler dev`   |
| `pnpm deploy`       | Deploy to Cloudflare Workers                   |
| `pnpm deploy:dry-run` | Bundle the Worker without deploying          |
| `pnpm cf:types`     | Generate Worker binding types with `wrangler types` |
| `pnpm build`        | Compile TypeScript to `dist/` (Node)           |
| `pnpm start`        | Run the compiled Node build                    |
| `pnpm test`         | Run the test suite                             |
| `pnpm db:generate`  | Generate a migration from schema changes       |
| `pnpm db:migrate`   | Apply pending migrations                       |
| `pnpm db:studio`    | Open Drizzle Studio                            |

## Endpoints

- `GET /` — returns the app name and version
- `GET /health` — pings the database
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me` — requires `Authorization: Bearer <token>`

## Project structure

```
src/
  index.ts              Node entry point (@hono/node-server)
  worker.ts             Cloudflare Worker entry point
  app.ts                Hono app shared by both runtimes
  config.ts             env/bindings validation (zod)
  lib/logger.ts         runtime-agnostic JSON logger
  db/connection.ts      lazily-cached Drizzle client (Neon HTTP)
  db/migrate.ts         migration runner (Node only)
  modules/
    users/schema.ts     users table
    monitors/schema.ts  monitors table
drizzle/                generated SQL migrations
wrangler.jsonc          Worker config (entry, vars, compatibility flags)
.dev.vars.example       local Worker secrets template
```

### How the dual runtime works

`src/app.ts` builds one Hono app that reads configuration from `c.env`
(Workers bindings). The Node entry point passes `process.env` as those
bindings; `src/worker.ts` exports the same app so Wrangler can serve it. No
application code is duplicated per runtime.
