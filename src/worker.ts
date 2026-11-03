import createApp from './app.js'

/**
 * Cloudflare Worker entry point.
 *
 * A Hono app's `fetch(request, env, ctx)` signature is exactly the Workers
 * `ExportedHandler.fetch` signature, so exporting the instance is all that is
 * needed. Bindings (vars + secrets) are read from `c.env` inside the app.
 *
 * Wrangler bundles and deploys this file — see `wrangler.jsonc`.
 */

const app = createApp()

export { app }
export default app
