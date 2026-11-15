import type { MiddlewareHandler, Context } from "hono";
import { HTTPException } from "hono/http-exception";

interface RateLimitData {
  count: number;
  windowStart: number;
}

const rateLimitCache = new Map<string, RateLimitData>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

export const rateLimit = (maxRequests: number = MAX_REQUESTS, windowMs: number = WINDOW_MS): MiddlewareHandler => {
  return async (c, next) => {
    const ip = c.req.raw.headers.get('CF-Connecting-IP');

    if (!ip) {
      throw new HTTPException(400, { message: 'IP not found' });
    }

    const now = Date.now();
    const data = rateLimitCache.get(ip);

    if (!data || now - data.windowStart >= windowMs) {
      rateLimitCache.set(ip, {
        count: 1,
        windowStart: now,
      });
    } else {
      if (data.count >= maxRequests) {
        throw new HTTPException(429, {
          message: 'Rate limit exceeded',
        });
      }

      data.count++;
    }

    await next();
  };
};
