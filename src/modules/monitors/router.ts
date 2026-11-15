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

  const monitor = await withRetry(() =>
    db.select({
      id: monitors.id,
      name: monitors.name,
      url: monitors.url,
      createdAt: monitors.createdAt,
      updatedAt: monitors.updatedAt,
    }).from(monitors).where(eq(monitors.userId, id))
  )

  return c.json(new ApiResponse({
    statusCode: 200,
    message: "Monitors",
    data: [monitor],
  }))
});

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

export default router;
