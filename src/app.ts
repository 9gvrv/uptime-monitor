import { Hono } from "hono"
import healthRouter from "./api/health.js"
import router from "./api/router.js"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers";
import { requestId } from "hono/request-id";
import { ApiError } from "./lib/apiError.js";
import { logger } from "./lib/logger.js";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Creates the Hono app instance with middleware and routes.
 *
 * @returns Configured Hono application instance.
 */

const createApp = () => {
  const app = new Hono()

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
