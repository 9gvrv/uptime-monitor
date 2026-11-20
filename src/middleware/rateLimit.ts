import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "./auth.js";
import { ApiError } from "../lib/apiError.js";

/** Rate limiter bindings declared in `wrangler.jsonc`. */
export type RateLimitBinding = "DEV_RATE_LIMITER" | "AUTH_RATE_LIMITER";

/** A fixed key, or one derived from the request (e.g. the authenticated user id). */
type RateLimitKey = string | ((c: Context<AppEnv>) => string);

/**
 * Rate limiting via Cloudflare's Rate Limiting API binding.
 *
 * The limit and window are configured on the binding in `wrangler.jsonc`
 * (`simple.limit` / `simple.period`), so they cannot be overridden per route.
 * `key` identifies whose allowance is used: Cloudflare recommends a stable
 * identifier such as a route name or user id, and explicitly advises against
 * raw IP addresses (many users can share one).
 */
export const rateLimit = (
  binding: RateLimitBinding,
  key: RateLimitKey,
): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const resolvedKey = typeof key === "function" ? key(c) : key;

    const { success } = await c.env[binding].limit({ key: resolvedKey });
    if (!success) {
      // ApiError is handled by app.onError; an HTTPException would fall through
      // to the generic 500 handler.
      throw new ApiError({
        statusCode: 429,
        message: "Rate limit exceeded",
      });
    }

    await next();
  };
};
