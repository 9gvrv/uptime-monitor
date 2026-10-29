# uptime-monitor

A simple uptime monitoring API built with Hono, Drizzle ORM and PostgreSQL (Neon).

## Stack

- [Hono](https://hono.dev) — HTTP framework
- [Drizzle ORM](https://orm.drizzle.team) — schema + migrations
- [Zod](https://zod.dev) — env/config validation
- [Pino](https://getpino.io) — logging
- TypeScript, run with `tsx`

## Requirements

- Node.js 24+
- pnpm
- A PostgreSQL database (Neon)

## Setup

```bash
pnpm install
cp .env.example .env   # then fill in the values
pnpm db:migrate        # apply migrations
pnpm dev
```

The server runs on http://localhost:3000 by default.

## Environment variables

| Variable       | Required | Default       | Description                      |
| -------------- | -------- | ------------- | -------------------------------- |
| `APP_NAME`     | yes      | —             | App name returned by the API     |
| `APP_VERSION`  | yes      | —             | App version returned by the API  |
| `DATABASE_URL` | yes      | —             | PostgreSQL connection string     |
| `PORT`         | no       | `3000`        | HTTP port                        |
| `NODE_ENV`     | no       | `development` | `development` / `test` / `production` |
| `LOG_LEVEL`    | no       | `info`        | `fatal` / `error` / `warn` / `info` / `debug` / `trace` |

Config is validated at startup; the process exits if anything is missing or invalid.

## Scripts

| Script            | Description                              |
| ----------------- | ---------------------------------------- |
| `pnpm dev`        | Start with watch mode                    |
| `pnpm build`      | Compile TypeScript to `dist/`            |
| `pnpm start`      | Run the compiled build                   |
| `pnpm db:generate`| Generate a migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations                 |
| `pnpm db:studio`  | Open Drizzle Studio                      |

## Endpoints

- `GET /` — returns the app name and version

## Project structure

```
src/
  index.ts              app entry point
  config.ts             env validation (zod)
  lib/logger.ts         pino logger
  db/connection.ts      drizzle client
  db/migrate.ts         migration runner
  modules/
    users/schema.ts     users table
    monitors/schema.ts  monitors table
drizzle/                generated SQL migrations
```
