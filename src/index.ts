import { serve } from '@hono/node-server';
import config from './config.js';
import { logger } from './lib/logger.js';
import createApp from './app.js';
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

const app = createApp()

const server = serve(
  {
    fetch: app.fetch,
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

export default app;
