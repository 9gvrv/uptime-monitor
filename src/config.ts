import 'dotenv/config'
import { z } from 'zod'

const configSchema = z.object({
  app_name: z.string().min(1),
  app_version: z.string().min(1),
  database_url: z.string().min(1),
  port: z.coerce.number().int().positive().default(3000),
  node_env: z.enum(['development', 'test', 'production']).default('development'),
  log_level: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
})

const parsed = configSchema.safeParse({
  app_name: process.env.APP_NAME,
  app_version: process.env.APP_VERSION,
  database_url: process.env.DATABASE_URL,
  port: process.env.PORT,
  node_env: process.env.NODE_ENV,
  log_level: process.env.LOG_LEVEL,
})

if (!parsed.success) {
  console.error('Invalid environment configuration:')
  console.error(z.prettifyError(parsed.error))
  process.exit(1)
}

const config = parsed.data

export default config
