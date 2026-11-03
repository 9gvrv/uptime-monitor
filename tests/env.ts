import type { Bindings } from '../src/config.js'

/**
 * Environment bindings used by the tests. The app now reads configuration
 * from `c.env` (Workers bindings style), so every `app.request(...)` passes
 * this object as the third argument.
 */
export const TEST_ENV: Bindings = {
  APP_NAME: 'uptime-monitor',
  APP_VERSION: '1.0.0',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'test-jwt-secret',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
}
