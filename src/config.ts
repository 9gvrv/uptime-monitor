import { z } from 'zod'

/**
 * Environment bindings as provided by Cloudflare Workers (`c.env`). Every
 * value is a string because Workers vars/secrets are always strings; bindings
 * such as the rate limiter are runtime objects.
 */
export type Bindings = {
  APP_NAME?: string
  APP_VERSION?: string
  DATABASE_URL?: string
  JWT_SECRET?: string
  NODE_ENV?: string
  LOG_LEVEL?: string
  FREE_RATE_LIMITER?: RateLimit
}

const configSchema = z.object({
  app_name: z.string().min(1),
  app_version: z.string().min(1),
  database_url: z.string().min(1),
  node_env: z.enum(['development', 'test', 'production']).default('development'),
  log_level: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  jwt_secret: z.string().min(1),
})

export type Config = z.infer<typeof configSchema>

/**
 * Validates raw bindings into a typed config object.
 *
 * This never calls `process.exit`: inside Workerd a process exit would kill
 * the isolate on every request. The worker surfaces a 500 through the app's
 * error handler instead.
 */
export function parseConfig(env: Bindings): Config {
  const parsed = configSchema.safeParse({
    app_name: env.APP_NAME,
    app_version: env.APP_VERSION,
    database_url: env.DATABASE_URL,
    node_env: env.NODE_ENV,
    log_level: env.LOG_LEVEL,
    jwt_secret: env.JWT_SECRET,
  })

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(parsed.error)}`,
    )
  }

  return parsed.data
}

// Parsing on every request would be wasteful. The binding object has a stable
// identity for the lifetime of a Worker isolate, so caching by reference keeps
// this to a single parse per isolate.
const cache = new WeakMap<object, Config>()

export function getConfig(env: Bindings): Config {
  const cached = cache.get(env)
  if (cached) return cached

  const config = parseConfig(env)
  cache.set(env, config)
  return config
}

export default getConfig
