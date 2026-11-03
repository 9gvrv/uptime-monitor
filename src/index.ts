import 'dotenv/config'

import dns from 'node:dns'

// Neon resolves to both IPv4 and IPv6. On networks without working IPv6 the
// driver spends its connection timeout on unreachable addresses, so prefer
// IPv4. This is Node-only; the Worker runtime does not need (or support) it.
dns.setDefaultResultOrder('ipv4first')

import { serve } from '@hono/node-server'
import createApp from './app.js'
import { parseConfig, type Bindings, type Config } from './config.js'
import { logger, setLogLevel } from './lib/logger.js'

/**
 * Node dev/production entry point.
 *
 * Cloudflare Workers use `src/worker.ts` instead. Both serve the same
 * `createApp()` instance; the only difference is where the bindings come from.
 */

function loadConfig(): Config {
  try {
    return parseConfig(process.env as Bindings)
  } catch (error) {
    // Fail fast with a readable message (config is validated again lazily by
    // getConfig for the Worker runtime, which has no process to exit).
    logger.error(error)
    process.exit(1)
  }
}

const config = loadConfig()
setLogLevel(config.log_level)
const env = process.env as unknown as Bindings
const app = createApp()

const server = serve(
  {
    fetch: (request) => app.fetch(request, env),
    port: config.port,
  },
  (info) => {
    logger.info(`Server is running on http://localhost:${info.port}`)
  },
)

// Friendlier failure than an unhandled 'error' event stack trace (e.g. EADDRINUSE
// when a second instance is started while another one is already listening).
server.on('error', (error) => {
  if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    logger.error(
      `Port ${config.port} is already in use — another instance of this server is already running. ` +
        `Stop it first (pkill -f 'tsx watch src/index.ts') or use a different PORT.`,
    )
  } else {
    logger.error(error)
  }
  process.exit(1)
})

// graceful shutdown
process.on('SIGINT', () => {
  server.close()
  process.exit(0)
})
process.on('SIGTERM', () => {
  server.close((err) => {
    if (err) {
      logger.error(err)
      process.exit(1)
    }
    process.exit(0)
  })
})

export default app
