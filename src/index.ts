import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import config from './config.js'
import { logger } from './lib/logger.js'
import createApp from './app.js'

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
