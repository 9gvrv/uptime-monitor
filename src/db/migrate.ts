import dns from 'node:dns'

// Neon resolves to both IPv4 and IPv6. On networks without working IPv6 the
// driver spends its connection timeout on unreachable addresses, so prefer IPv4.
dns.setDefaultResultOrder('ipv4first')

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import { errorText, isRetryable } from './dbUtils.js'

/**
 * Migration runner for `pnpm db:migrate`. Not part of the running server —
 * applies the SQL in ./drizzle to Neon, wrapped in a retry loop because the
 * serverless driver is exposed to the same transient network failures as the app.
 */

const databaseUrl = getDatabaseUrl()

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }
  return url
}

const MAX_ATTEMPTS = 5

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const db = drizzle(databaseUrl)

    try {
      await migrate(db, {
        migrationsFolder: './drizzle',
        migrationsSchema: 'drizzle',
        migrationsTable: '__drizzle_migrations',
      })
      console.log('Migrations applied successfully.')
      return
    } catch (error) {
      const text = errorText(error)
      const canRetry = attempt < MAX_ATTEMPTS && isRetryable(error)

      if (!canRetry) {
        console.error(`Migration failed: ${text}`)
        process.exitCode = 1
        return
      }

      const delay = attempt * 1000
      console.warn(
        `Connection to the database failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${delay}ms...`,
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

await main()
