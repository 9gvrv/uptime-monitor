import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/apiError.js";
import type { AppEnv } from "../src/middleware/auth.js";
import { rateLimit } from "../src/middleware/rateLimit.js";
import { TEST_ENV } from "./env.js";

const createApp = (
  middleware: ReturnType<typeof rateLimit>,
  env = TEST_ENV,
  withUser = false,
) => {
  const app = new Hono<AppEnv>();
  if (withUser) {
    app.use("*", (c, next) => {
      c.set("user", { id: 42, email: "user@example.com" });
      return next();
    });
  }
  app.use("*", middleware);
  app.get("/", (c) => c.json({ ok: true }));
  app.onError((err, c) =>
    c.json(
      { message: err.message },
      (err instanceof ApiError ? err.statusCode : 500) as ContentfulStatusCode,
    ),
  );
  return { app, env };
};

describe("rateLimit middleware", () => {
  it("calls the binding with a fixed key and allows the request", async () => {
    const limit = vi.fn(async () => ({ success: true }));
    const { app, env } = createApp(
      rateLimit("DEV_RATE_LIMITER", "monitor:check:try"),
      { ...TEST_ENV, DEV_RATE_LIMITER: { limit } },
    );

    const res = await app.request("/", undefined, env);

    expect(res.status).toBe(200);
    expect(limit).toHaveBeenCalledWith({ key: "monitor:check:try" });
  });

  it("returns a formatted 429 when the binding rejects the request", async () => {
    const { app, env } = createApp(
      rateLimit("DEV_RATE_LIMITER", "monitor:check:try"),
      {
        ...TEST_ENV,
        DEV_RATE_LIMITER: { limit: async () => ({ success: false }) },
      },
    );

    const res = await app.request("/", undefined, env);

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ message: "Rate limit exceeded" });
  });

  it("uses the authenticated user id in a derived key", async () => {
    const limit = vi.fn(async () => ({ success: true }));
    const { app, env } = createApp(
      rateLimit(
        "AUTH_RATE_LIMITER",
        (c) => `monitor:check:user:${c.get("user").id}`,
      ),
      { ...TEST_ENV, AUTH_RATE_LIMITER: { limit } },
      true,
    );

    await app.request("/", undefined, env);

    expect(limit).toHaveBeenCalledWith({ key: "monitor:check:user:42" });
  });
});
