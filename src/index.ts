import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import config from '@/config.js'
import {logger} from '@/lib/logger.js'


export function create_app() {
  const app = new Hono()

  app.get('/', (c) => {
    logger.info("Hello, World");
    return c.json({ message: `${config.database_url}` })
  })

  return app;
}

const app = create_app()

const server = serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

// graceful shutdown
process.on('SIGINT', () => {
  server.close()
  process.exit(0)
})
process.on('SIGTERM', () => {
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(0)
  })
})
