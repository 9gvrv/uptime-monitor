import type { MiddlewareHandler, Context } from "hono";
import { HTTPException } from "hono/http-exception";


export const anonymousRateLimit: MiddlewareHandler = async (c, next) => {
  const ip = c.env.incoming.socket.remoteAddress;
  console.log(`IP: ${ip}`)

  await next();
}
