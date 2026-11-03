import type { MiddlewareHandler } from "hono";
import { verify } from "hono/jwt";
import { getConfig, type Bindings } from "../config.js";
import { ApiError } from "../lib/apiError.js";

/** The authenticated principal injected into the Hono context. */
export type AuthUser = {
  id: number;
  email: string;
};

/**
 * Hono environment used across the app.
 *
 * - `Bindings` are the runtime env values (`c.env`): vars and secrets on
 *   Workers, `process.env` on the Node dev server.
 * - `Variables` make `c.get("user")` type-safe.
 */
export type AppEnv = {
  Bindings: Bindings;
  Variables: { user: AuthUser };
};

/**
 * Verifies the JWT from the `Authorization: Bearer <token>` header and stores
 * the decoded user in the context. Throws 401 ApiErrors for missing, malformed,
 * expired, or invalid tokens — never a raw error, so onError can format it.
 *
 * The secret is read from the request bindings (Workers) instead of a
 * module-level config so the same code works in every environment.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError({
      statusCode: 401,
      message: "Missing or malformed Authorization header. Expected: Bearer <token>",
    });
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new ApiError({ statusCode: 401, message: "Missing token" });
  }

  try {
    const payload = await verify(token, getConfig(c.env).jwt_secret, "HS256");
    c.set("user", {
      id: Number(payload.sub),
      email: String(payload.email ?? ""),
    });
    await next();
  } catch {
    throw new ApiError({
      statusCode: 401,
      message: "Invalid or expired token",
    });
  }
};
