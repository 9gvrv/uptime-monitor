/**
 * Minimal structured logger that works in both Node and Cloudflare Workers.
 *
 * The previous implementation used pino with a `pino-pretty` transport. Pino
 * relies on Node streams (and worker threads for transports), which are not
 * available in Workerd. This keeps the same call signatures the codebase
 * already uses (`logger.info(msg)`, `logger.error(err)`,
 * `logger.error(obj, msg)`) while emitting JSON lines that Cloudflare
 * observability / `wrangler tail` can parse.
 */

type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent'

const LEVEL_VALUES: Record<Level, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Number.POSITIVE_INFINITY,
}

const REDACTED_KEYS = /^(password|passwordhash|token|authorization|jwt_secret|database_url)$/i

function configuredLevel(): Level {
  // `process` only exists on Node (or in Workers when nodejs_compat is on).
  const raw =
    typeof process !== 'undefined' && process.env ? process.env.LOG_LEVEL : undefined
  return raw && raw in LEVEL_VALUES ? (raw as Level) : 'info'
}

let threshold = LEVEL_VALUES[configuredLevel()]

/**
 * Update the active log level at runtime (e.g. from the `LOG_LEVEL` binding,
 * which is only available per-request in Workers).
 */
export function setLogLevel(level: string) {
  if (level in LEVEL_VALUES) threshold = LEVEL_VALUES[level as Level]
}

/** Deep-ish clone that redacts sensitive keys and serializes errors. */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1))

  const result: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    result[key] = REDACTED_KEYS.test(key) ? '[REDACTED]' : sanitize(nested, depth + 1)
  }
  return result
}

type LogArgs =
  | [message: string]
  | [context: Record<string, unknown>, message?: string]
  | [error: unknown, message?: string]

function write(level: Exclude<Level, 'silent'>, args: LogArgs) {
  if (LEVEL_VALUES[level] < threshold) return

  const record: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
  }

  const [first, second] = args

  if (first instanceof Error) {
    record.err = sanitize(first)
    record.msg = second ?? first.message
  } else if (typeof first === 'string') {
    record.msg = first
  } else if (first !== null && typeof first === 'object') {
    Object.assign(record, sanitize(first))
    if (second !== undefined) record.msg = second
  } else if (first !== undefined) {
    record.msg = String(first)
  }

  if (second !== undefined && record.msg === undefined) record.msg = second

  const line = JSON.stringify(record)
  if (level === 'error' || level === 'fatal') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  trace: (...args: LogArgs) => write('trace', args),
  debug: (...args: LogArgs) => write('debug', args),
  info: (...args: LogArgs) => write('info', args),
  warn: (...args: LogArgs) => write('warn', args),
  error: (...args: LogArgs) => write('error', args),
  fatal: (...args: LogArgs) => write('fatal', args),
}
