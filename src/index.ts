import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import config from './config.js'
import { logger } from './lib/logger.js'

export function createApp() {
  const app = new Hono()

  app.get('/', (c) => {
    logger.info('root endpoint')
    return c.json({
      message: {
        app: config.app_name,
        version: config.app_version,
      },
    })
  })

  return app
}

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
