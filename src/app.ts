import { Hono } from "hono"
import healthRouter from "./api/health.js"
import router from "./api/router.js"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers";
import { requestId } from "hono/request-id";
import { ApiError } from "./lib/apiError.js";
import { logger, setLogLevel } from "./lib/logger.js";
import { getConfig } from "./config.js";
import type { AppEnv } from "./middleware/auth.js";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Creates the Hono app instance with middleware and routes.
 *
 * The app is runtime-agnostic: it reads configuration from `c.env` bindings,
 * so the exact same instance is served by `@hono/node-server` in development
 * and by the Cloudflare Worker entry point (`src/worker.ts`) in production.
 */
const createApp = () => {
  const app = new Hono<AppEnv>()

  // Validate the bindings on the first request and fail with a clear error
  // (instead of a confusing downstream failure) if anything is missing.
  app.use("*", async (c, next) => {
    const config = getConfig(c.env)
    setLogLevel(config.log_level)
    await next()
  })

  // Middlewares
  app.use("*", secureHeaders())
  app.use("*", requestId())
  app.use("/api/*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }))

  app.route("/", healthRouter);
  app.route("/api", router);


  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          message: err.message,
          errors: err.errors,
          data: null,
        },
        err.statusCode as ContentfulStatusCode
      );
    }
    logger.error(err);
    return c.json(
      {
        success: false,
        message: "Internal server error",
        errors: [],
        data: null,
      },
      500
    );
  });


  return app
}

export default createApp;
