import createApp from "./app.js";
import type { Bindings } from "./config.js";
import { runScheduledChecks } from "./cron.js";
import { logger } from "./lib/logger.js";

/**
 * Cloudflare Worker entry point.
 *
 * A Hono app's `fetch(request, env, ctx)` signature is exactly the Workers
 * `ExportedHandler.fetch` signature. It is wrapped here so the same module can
 * also export a `scheduled` handler for the cron triggers in `wrangler.jsonc`.
 * Bindings (vars + secrets) are read from `env` inside the app/cron code.
 */

const app = createApp();

export { app };

export default {
  fetch: (request: Request, env: Bindings, ctx: ExecutionContext) =>
    app.fetch(request, env, ctx),

  async scheduled(
    _controller: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext,
  ) {
    // ScheduledController only exposes cron/scheduledTime/noRetry — there is
    // no `colo`. Pass an optional REGION var through if you want to tag rows.
    ctx.waitUntil(
      runScheduledChecks(env, env.REGION).catch((error) => {
        logger.fatal(error, "Scheduled check run failed");
      }),
    );
  },
} satisfies ExportedHandler<Bindings>;
