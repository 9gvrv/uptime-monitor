import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// `.env` for development (the default) and `.env.production` for production
// ops. Select the file explicitly with ENV_FILE, e.g.
//   ENV_FILE=.env.production pnpm db:studio
loadEnv({ path: process.env.ENV_FILE ?? '.env', quiet: true })

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/modules/**/schema.ts'],
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
  migrations: { schema: 'drizzle', table: '__drizzle_migrations' },
  verbose: true,
})
