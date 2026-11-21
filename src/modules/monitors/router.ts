import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { getConfig } from "../../config.js";
import { getDb } from "../../db/connection.js";
import { isUniqueViolation, withRetry } from "../../db/dbUtils.js";
import { ApiError } from "../../lib/apiError.js";
import { ApiResponse } from "../../lib/apiResponse.js";
import { checkWebsite } from "../../lib/checkWebsite.js";
import { getHealthCheckFilter } from "../../lib/healthCheckFilter.js";
import { logger } from "../../lib/logger.js";
import { getPagination } from "../../lib/pagination.js";
import { readJson } from "../../lib/readJson.js";
import { runMonitorCheck } from "../../lib/runMonitorCheck.js";
import { type AppEnv, requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { groups } from "../groups/schema.js";
import { healthChecks, monitors } from "./schema.js";
import {
  freeHealthCheckSchema,
  ReturnMonitor,
  registerMonitorSchema,
  updateMonitorSchema,
} from "./validationSchema.js";

const router = new Hono<AppEnv>();

router.get("/", requireAuth, async (c) => {
  logger.info("GET /monitors");
  const db = getDb(getConfig(c.env).database_url);
  const { id } = c.get("user");
  const { limit, offset } = getPagination(c);

  const monitor = await withRetry(() =>
    db
      .select()
      .from(monitors)
      .where(eq(monitors.userId, id))
      .offset(offset)
      .limit(limit),
  );

  return c.json(
    new ApiResponse({
      statusCode: 200,
      message: "Monitors",
      data: monitor,
    }),
  );
});

router.get("/:id", requireAuth, async (c) => {
  const db = getDb(getConfig(c.env).database_url);
  const id = Number(c.req.param("id"));

  if (!id) throw new ApiError({ statusCode: 400, message: "Missing id" });

  const [monitor] = await withRetry(() =>
    db
      .select()
      .from(monitors)
      .where(and(eq(monitors.id, id), eq(monitors.userId, c.get("user").id)))
      .limit(1),
  );

  if (!monitor)
    throw new ApiError({ statusCode: 404, message: "Monitor not found" });

  return c.json(
    new ApiResponse({
      statusCode: 200,
      message: "Monitor",
      data: monitor,
    }),
  );
});

router.post("/", requireAuth, async (c) => {
  logger.info("POST /monitors");
  const db = getDb(getConfig(c.env).database_url);
  const { id } = c.get("user");

  const body = await readJson(c);

  const parsed = registerMonitorSchema.safeParse(body);
  if (!parsed.success)
    throw new ApiError({ statusCode: 400, message: parsed.error.message });

  const { name, url, intervalSeconds, timeoutMs } = parsed.data;

  const [existingMonitor] = await withRetry(() =>
    db
      .select()
      .from(monitors)
      .where(and(eq(monitors.url, url), eq(monitors.userId, id)))
      .limit(1),
  );
  if (existingMonitor) {
    throw new ApiError({
      statusCode: 409,
      message: "Monitor already exists",
    });
  }

  try {
    const [inserted] = await withRetry(() =>
      db
        .insert(monitors)
        .values({
          userId: id,
          name,
          url,
          // undefined lets the database default apply.
          ...(intervalSeconds !== undefined && { intervalSeconds }),
          ...(timeoutMs !== undefined && { timeoutMs }),
        })
        .returning(),
    );

    if (!inserted)
      throw new ApiError({
        statusCode: 500,
        message: "Failed to create monitor",
      });

    // Return the inserted row through the response schema so the generated
    // `id` and the DB defaults for interval/timeout are included.
    const result = ReturnMonitor.parse(inserted);
    return c.json(
      new ApiResponse({
        statusCode: 201,
        message: "Monitor created",
        data: result,
      }),
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError({
        statusCode: 409,
        message: "Monitor already exists",
      });
    }
    throw error;
  }
});

router.delete("/:id", requireAuth, async (c) => {
  const db = getDb(getConfig(c.env).database_url);
  const id = Number(c.req.param("id"));

  if (!id) throw new ApiError({ statusCode: 400, message: "Missing id" });

  const [result] = await withRetry(() =>
    db
      .delete(monitors)
      .where(and(eq(monitors.id, id), eq(monitors.userId, c.get("user").id)))
      .returning(),
  );

  if (!result)
    throw new ApiError({ statusCode: 404, message: "Monitor not found" });

  return c.json(
    new ApiResponse({
      statusCode: 200,
      message: "Monitor deleted",
      data: result,
    }),
  );
});

router.put("/:id", requireAuth, async (c) => {
  logger.info("PUT /monitors/:id");
  const db = getDb(getConfig(c.env).database_url);
  const id = Number(c.req.param("id"));

  if (!id) throw new ApiError({ statusCode: 400, message: "Missing id" });

  const body = await readJson(c);
  const parsed = updateMonitorSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      statusCode: 400,
      message: "Validation failed",
      errors: [parsed.error],
    });
  }

  // The schema drops unknown keys, so callers cannot change userId, id,
  // groupId or timestamps through this route. Only supplied fields are set.
  const { name, url, isActive, intervalSeconds, timeoutMs } = parsed.data;
  const updates: {
    name?: string;
    url?: string;
    isActive?: boolean;
    intervalSeconds?: number;
    timeoutMs?: number;
    updatedAt?: Date;
  } = {
    ...(name !== undefined && { name }),
    ...(url !== undefined && { url }),
    ...(isActive !== undefined && { isActive }),
    ...(intervalSeconds !== undefined && { intervalSeconds }),
    ...(timeoutMs !== undefined && { timeoutMs }),
  };

  if (Object.keys(updates).length === 0) {
    return c.json(
      new ApiResponse({
        statusCode: 200,
        message: "No updates",
        data: null,
      }),
    );
  }

  updates.updatedAt = new Date();

  let result: typeof monitors.$inferSelect | undefined;
  try {
    [result] = await withRetry(() =>
      db
        .update(monitors)
        .set(updates)
        .where(and(eq(monitors.id, id), eq(monitors.userId, c.get("user").id)))
        .returning(),
    );
  } catch (error) {
    // The unique (user_id, url) index reports a duplicate URL as 23505.
    // POST handles the same case; without this it becomes a generic 500.
    if (isUniqueViolation(error)) {
      throw new ApiError({
        statusCode: 409,
        message: "Monitor already exists",
      });
    }
    throw error;
  }

  if (!result)
    throw new ApiError({ statusCode: 404, message: "Monitor not found" });

  return c.json(
    new ApiResponse({
      statusCode: 200,
      message: "Monitor updated",
      data: result,
    }),
  );
});

/**
 * Update the group of a monitor.
 */
router.put("/:id/group", requireAuth, async (c) => {
  logger.info("PUT /monitors/:id/group");
  const db = getDb(getConfig(c.env).database_url);
  const id = Number(c.req.param("id"));
  const userId = c.get("user").id;

  if (!id) throw new ApiError({ statusCode: 400, message: "Missing id" });

  const body = await readJson(c);

  if (!body || !("groupId" in body)) {
    throw new ApiError({
      statusCode: 400,
      message: "groupId is required (use null to remove from all groups)",
    });
  }

  const groupId = body.groupId;

  if (groupId !== null && (!Number.isInteger(groupId) || groupId <= 0)) {
    throw new ApiError({
      statusCode: 400,
      message: "groupId must be a positive integer or null",
    });
  }

  const [monitor] = await withRetry(() =>
    db
      .select()
      .from(monitors)
      .where(and(eq(monitors.id, id), eq(monitors.userId, userId)))
      .limit(1),
  );

  if (!monitor)
    throw new ApiError({ statusCode: 404, message: "Monitor not found" });

  if (groupId !== null) {
    const [group] = await withRetry(() =>
      db
        .select()
        .from(groups)
        .where(and(eq(groups.id, groupId), eq(groups.userId, userId)))
        .limit(1),
    );

    if (!group)
      throw new ApiError({ statusCode: 404, message: "Group not found" });
  }

  const [result] = await withRetry(() =>
    db
      .update(monitors)
      .set({ groupId, updatedAt: new Date() })
      .where(and(eq(monitors.id, id), eq(monitors.userId, userId)))
      .returning(),
  );

  if (!result)
    throw new ApiError({ statusCode: 404, message: "Monitor not found" });

  return c.json(
    new ApiResponse({
      statusCode: 200,
      message:
        groupId === null
          ? "Monitor removed from group"
          : "Monitor moved to group",
      data: result,
    }),
  );
});

router.post(
  "/check/try",
  rateLimit("DEV_RATE_LIMITER", "monitor:check:try"),
  async (c) => {
    const body = await readJson(c);

    const parsed = freeHealthCheckSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError({
        statusCode: 400,
        message: "Invalid health check data",
      });
    }
    const { url } = parsed.data;
    logger.info(`Creating health check: url=${url}`);

    const websiteCheckResult = await checkWebsite(url);
    if (!websiteCheckResult) {
      throw new ApiError({
        statusCode: 500,
        message: "Failed to check website",
      });
    }

    return c.json(
      new ApiResponse({
        statusCode: 201,
        message: "Health check completed",
        data: websiteCheckResult,
      }),
    );
  },
);

router.post(
  "/:id/check",
  requireAuth,
  rateLimit(
    "AUTH_RATE_LIMITER",
    (c) => `monitor:check:user:${c.get("user").id}`,
  ),
  async (c) => {
    const db = getDb(getConfig(c.env).database_url);
    const id = Number(c.req.param("id"));

    if (!id) {
      throw new ApiError({ statusCode: 400, message: "Invalid monitor ID" });
    }

    const [monitor] = await withRetry(() =>
      db
        .select()
        .from(monitors)
        .where(and(eq(monitors.id, id), eq(monitors.userId, c.get("user").id)))
        .limit(1),
    );

    if (!monitor) {
      throw new ApiError({ statusCode: 404, message: "Monitor not found" });
    }

    // Fetch, persist and reschedule all happen in the shared runner, which
    // the cron handler uses as well.
    const healthCheck = await runMonitorCheck(monitor, { db });

    return c.json(
      new ApiResponse({
        statusCode: 200,
        message: "Health check completed",
        data: healthCheck,
      }),
    );
  },
);

router.get("/:id/check", requireAuth, async (c) => {
  logger.info("GET /monitors/:id/check");
  const db = getDb(getConfig(c.env).database_url);
  const id = Number(c.req.param("id"));

  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError({ statusCode: 400, message: "Invalid monitor ID" });
  }

  const { limit, offset } = getPagination(c);
  const { status, from, to } = getHealthCheckFilter(c);

  // A valid token is not enough — the monitor must belong to this user.
  const [monitor] = await withRetry(() =>
    db
      .select({ name: monitors.name })
      .from(monitors)
      .where(and(eq(monitors.id, id), eq(monitors.userId, c.get("user").id)))
      .limit(1),
  );

  if (!monitor)
    throw new ApiError({ statusCode: 404, message: "Monitor not found" });

  const healthChecksResult = await withRetry(() =>
    db
      .select()
      .from(healthChecks)
      .where(
        and(
          eq(healthChecks.monitorId, id),
          status !== undefined ? eq(healthChecks.status, status) : undefined,
          from !== undefined ? gte(healthChecks.checkedAt, from) : undefined,
          to !== undefined ? lte(healthChecks.checkedAt, to) : undefined,
        ),
      )
      .orderBy(desc(healthChecks.checkedAt), desc(healthChecks.id))
      .offset(offset)
      .limit(limit),
  );

  return c.json(
    new ApiResponse({
      statusCode: 200,
      message: "Health checks",
      data: {
        name: monitor.name,
        healthChecks: healthChecksResult,
      },
    }),
  );
});

router.get("/:id/summary", requireAuth, async (c) => {
  logger.info("GET /monitors/:id/summary");
  const db = getDb(getConfig(c.env).database_url);
  const id = Number(c.req.param("id"));

  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError({ statusCode: 400, message: "Invalid monitor ID" });
  }

  // Same ownership rule as every other monitor-scoped route.
  const [monitor] = await withRetry(() =>
    db
      .select({ id: monitors.id })
      .from(monitors)
      .where(and(eq(monitors.id, id), eq(monitors.userId, c.get("user").id)))
      .limit(1),
  );

  if (!monitor)
    throw new ApiError({ statusCode: 404, message: "Monitor not found" });

  const lastHealthCheckInfo = await withRetry(() =>
    db
      .select({
        status: healthChecks.status,
        statusCode: healthChecks.statusCode,
        checkedAt: healthChecks.checkedAt,
      })
      .from(healthChecks)
      .where(eq(healthChecks.monitorId, id))
      .orderBy(desc(healthChecks.checkedAt), desc(healthChecks.id))
      .limit(1),
  );

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const overallStatus = await withRetry(() =>
    db
      .select({
        averageTtfbMs: sql<number>`cast(avg(${healthChecks.ttfbMs}) as float8)`,
        averageTotalMs: sql<number>`cast(avg(${healthChecks.totalMs}) as float8)`,
      })
      .from(healthChecks)
      .where(
        and(
          eq(healthChecks.monitorId, id),
          gte(healthChecks.checkedAt, twentyFourHoursAgo),
        ),
      ),
  );

  const uptime24h = await withRetry(() =>
    db
      .select({
        totalChecks: sql<number>`count(*)::int`,
        upChecks: sql<number>`
        count(*) filter (where ${healthChecks.status} = 'up')::int
      `,
      })
      .from(healthChecks)
      .where(
        and(
          eq(healthChecks.monitorId, id),
          gte(healthChecks.checkedAt, twentyFourHoursAgo),
        ),
      ),
  );

  const { totalChecks, upChecks } = uptime24h[0] ?? {
    totalChecks: 0,
    upChecks: 0,
  };

  const uptimePercentage =
    totalChecks === 0 ? null : (upChecks / totalChecks) * 100;

  return c.json(
    new ApiResponse({
      statusCode: 200,
      message: "Overall status",
      data: {
        lastHealthCheckInfo: lastHealthCheckInfo[0] ?? null,
        overallStatus: overallStatus[0] ?? null,
        uptimePercentage,
      },
    }),
  );
});

export default router;
