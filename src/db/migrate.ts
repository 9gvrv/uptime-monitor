import dns from 'node:dns'

// Neon resolves to both IPv4 and IPv6. On networks without working IPv6 the
// driver spends its connection timeout on unreachable addresses, so prefer IPv4.
dns.setDefaultResultOrder('ipv4first')

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

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
const RETRYABLE =
  /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up/i

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = error.cause
  const causeText =
    cause instanceof Error
      ? `${cause.message} ${(cause as { code?: string }).code ?? ''}`
      : String(cause ?? '')
  return `${error.message} ${causeText}`
}

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
      const canRetry = attempt < MAX_ATTEMPTS && RETRYABLE.test(text)

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
