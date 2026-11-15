import type { MiddlewareHandler } from "hono";
import { ApiError } from "../lib/apiError.js";
import type { AppEnv } from "./auth.js";

/**
 * Anonymous rate limiting backed by the Cloudflare Rate Limiting binding
 * declared as `FREE_RATE_LIMITER` in `wrangler.jsonc`.
 *
 * The binding is simulated locally by `wrangler dev`, so local behaviour
 * matches production without a Node-only connection-info shim.
 */
export const anonymousRateLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
  const limiter = c.env.FREE_RATE_LIMITER;

  if (limiter) {
    const key =
      c.req.header("CF-Connecting-IP") ??
      c.req.header("X-Forwarded-For") ??
      "anonymous";
    const { success } = await limiter.limit({ key });

    if (!success) {
      throw new ApiError({ statusCode: 429, message: "Too many requests" });
    }
  }

  await next();
};
