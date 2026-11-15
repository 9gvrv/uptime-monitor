import type { MiddlewareHandler, Context } from "hono";
import { HTTPException } from "hono/http-exception";

interface RateLimitData {
  count: number;
  windowStart: number;
}

const rateLimitCache = new Map<string, RateLimitData>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

export const anonymousRateLimit: MiddlewareHandler = async (c, next) => {
  const ip = c.req.raw.headers.get('CF-Connecting-IP');

  if (!ip) {
    throw new HTTPException(400, { message: 'IP not found' });
  }

  const now = Date.now();
  const data = rateLimitCache.get(ip);

  if (!data || now - data.windowStart >= WINDOW_MS) {
    rateLimitCache.set(ip, {
      count: 1,
      windowStart: now,
    });
  } else {
    if (data.count >= MAX_REQUESTS) {
      throw new HTTPException(429, {
        message: 'Rate limit exceeded',
      });
    }

    data.count++;
  }

  await next();
};
