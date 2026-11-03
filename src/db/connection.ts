import { drizzle } from 'drizzle-orm/neon-http'

/**
 * Drizzle client for the Neon HTTP driver.
 *
 * On Workers there is no long-lived process to hold a single client, and the
 * connection string arrives per-request via `c.env`. Calling `drizzle()` is
 * cheap (the Neon HTTP driver is fetch-based and opens no sockets), but we
 * still cache by URL so reuse within an isolate is free.
 *
 * Note: the previous `dns.setDefaultResultOrder('ipv4first')` workaround was
 * Node-only (`node:dns` does not exist in Workerd). It now lives in the Node
 * entry point (`src/index.ts`) where it is actually relevant.
 */

export type Database = ReturnType<typeof drizzle>

const clients = new Map<string, Database>()

export function getDb(databaseUrl: string): Database {
  const existing = clients.get(databaseUrl)
  if (existing) return existing

  const db = drizzle(databaseUrl)
  clients.set(databaseUrl, db)
  return db
}

export default getDb
