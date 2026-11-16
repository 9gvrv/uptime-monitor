import { Hono } from "hono";
import { logger } from "../../lib/logger.js";
import checkWebsite from "../../lib/checkWebsite.js";
import { ApiResponse } from "../../lib/apiResponse.js";
import { requireAuth, type AppEnv } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";

import { getDb } from "../../db/connection.js";
import { getConfig } from "../../config.js";
import { readJson } from "../../lib/readJson.js";
import { registerMonitorSchema, freeHealthCheckSchema, ReturnHealthCheck } from "./validationSchema.js";
import { ApiError } from "../../lib/apiError.js";
import { isUniqueViolation, withRetry } from "../../db/dbUtils.js";
import { eq, and } from "drizzle-orm";
import { monitors, healthChecks } from "./schema.js";

const router = new Hono<AppEnv>();

router.get("/", requireAuth, async (c) => {
  logger.info("GET /monitors")
  const db = getDb(getConfig(c.env).database_url);
  const { id } = c.get("user");
  const { page, limit } = c.req.query();
  const parsedPage = Number(page) || 1;
  const parsedLimit = Number(limit) || 10;

  const monitor = await withRetry(() =>
    db.select({
      id: monitors.id,
      name: monitors.name,
      url: monitors.url,
      createdAt: monitors.createdAt,
      updatedAt: monitors.updatedAt,
    }).from(monitors).where(eq(monitors.userId, id))
    .offset((parsedPage - 1) * parsedLimit)
    .limit(parsedLimit)
  )

  return c.json(new ApiResponse({
    statusCode: 200,
    message: "Monitors",
    data: [monitor],
  }))
});

router.get("/:id", requireAuth, async (c) => {
  const db = getDb(getConfig(c.env).database_url);
  const id = Number(c.req.param("id"));

  if (!id) throw new ApiError({ statusCode: 400, message: "Missing id" });

  const [monitor] = await withRetry(() =>
    db.select()
      .from(monitors)
      .where(and(
        eq(monitors.id, id),
        eq(monitors.userId, c.get("user").id)
      ))
      .limit(1)
  )

  if (!monitor) throw new ApiError({ statusCode: 404, message: "Monitor not found" });


  return c.json(new ApiResponse({
    statusCode: 200,
    message: "Monitor",
    data: monitor,
  }))
})

router.post("/", requireAuth, async (c) => {
  logger.info("POST /monitors");
  const db = getDb(getConfig(c.env).database_url);
  const { id } = c.get("user");

  const body = await readJson(c);

  const parsed = registerMonitorSchema.safeParse(body);
  if (!parsed.success) throw new ApiError({ statusCode: 400, message: parsed.error.message });

  const { name, url } = parsed.data;

  const [existingMonitor] = await withRetry(() => db.select().from(monitors).where(and(eq(monitors.url, url), eq(monitors.userId, id))).limit(1));
  if (existingMonitor) {
    throw new ApiError({
      statusCode: 409,
      message: "Monitor already exists",
    })
  }

  try {
    const [monitor] = await withRetry(() =>
      db.insert(monitors).values({ userId: id, name, url }).returning()
    )

    const result = registerMonitorSchema.parse(monitor);
    if (!result) throw new ApiError({ statusCode: 500, message: "Failed to create monitor" });
    return c.json(new ApiResponse({
      statusCode: 201,
      message: "Monitor created",
      data: result,
    }))
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError({ statusCode: 409, message: "Monitor already exists" });
    }
    throw error;
  }
})

router.delete("/:id", requireAuth, async (c) => {
  const db = getDb(getConfig(c.env).database_url);
  const id = Number(c.req.param("id"));

  if (!id) throw new ApiError({ statusCode: 400, message: "Missing id" });

  const [result] = await withRetry(() =>
    db.delete(monitors).
      where(and(
        eq(monitors.id, id),
        eq(monitors.userId, c.get("user").id),
    )).returning()
  )

  if (!result) throw new ApiError({ statusCode: 404, message: "Monitor not found" });

  return c.json(new ApiResponse({
    statusCode: 200,
    message: "Monitor deleted",
    data: result,
  }))
})

router.put("/:id", requireAuth, async (c) => {
  const db = getDb(getConfig(c.env).database_url);
  const id = Number(c.req.param("id"));
  const body = await readJson(c);

  if (!id) throw new ApiError({ statusCode: 400, message: "Missing id" });

  const [result] = await withRetry(() =>
    db.update(monitors)
      .set(body)
      .where(and(
        eq(monitors.id, id),
        eq(monitors.userId, c.get("user").id),
      ))
      .returning()
  )

  if (!result) throw new ApiError({ statusCode: 404, message: "Monitor not found" });

  return c.json(new ApiResponse({
    statusCode: 200,
    message: "Monitor updated",
    data: result,
  }))
})

router.post("/check/try", rateLimit(), async (c) => {
  const body = await readJson(c);

  const parsed = freeHealthCheckSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({ statusCode: 400, message: "Invalid health check data" });
  }
  const { url } = parsed.data;
  logger.info(`Creating health check: url=${url}`)

  const websiteCheckResult = await checkWebsite(url);
  if (!websiteCheckResult) {
    throw new ApiError({ statusCode: 500, message: "Failed to check website" });
  }

  return c.json(new ApiResponse({
    statusCode: 201,
    message: "Health check completed",
    data: websiteCheckResult,
  }))
})

router.post("/:id/check", requireAuth, rateLimit(20, 60000), async (c) => {
  const db = getDb(getConfig(c.env).database_url);
  const id = Number(c.req.param("id"));

  if (!id) {
    throw new ApiError({ statusCode: 400, message: "Invalid monitor ID" });
  }

  const [monitor] = await withRetry(() => db
    .select()
    .from(monitors)
    .where(
      and(
        eq(monitors.id, id),
        eq(monitors.userId, c.get("user").id)
      )
    )
    .limit(1))

  if (!monitor) {
    throw new ApiError({ statusCode: 404, message: "Monitor not found" });
  }

  const websiteCheckResult = await withRetry(() => checkWebsite(monitor.url))
  if (!websiteCheckResult) {
    throw new ApiError({ statusCode: 500, message: "Failed to check website" });
  }

  const { statusCode, latencyMs, isUp, errorMessage } = websiteCheckResult;

  const [healthCheck] = await withRetry(() => db
    .insert(healthChecks)
    .values({
      monitorId: id,
      statusCode,
      latencyMs,
      isUp,
      errorMessage,
    }).returning())

  if (!healthCheck) {
    throw new ApiError({ statusCode: 500, message: "Failed to save health check" });
  }
  const parsed = ReturnHealthCheck.safeParse(healthCheck);
  if (!parsed.success) {
    throw new ApiError({ statusCode: 500, message: "Failed to parse health check" });
  }


  return c.json(new ApiResponse({
    statusCode: 200,
    message: "Health check completed",
    data: parsed.data,
  }))
})


export default router;
