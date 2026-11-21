import { eq, sql } from "drizzle-orm";
import type { Database } from "../db/connection.js";
import { withRetry } from "../db/dbUtils.js";
import { healthChecks, monitors } from "../modules/monitors/schema.js";
import { ReturnHealthCheck } from "../modules/monitors/validationSchema.js";
import { ApiError } from "./apiError.js";
import { checkWebsite } from "./checkWebsite.js";

export type Monitor = typeof monitors.$inferSelect;
export type HealthCheck = typeof healthChecks.$inferSelect;

interface RunMonitorCheckOptions {
  // Injected by the caller: both the HTTP route and the cron handler already
  // have a Drizzle client for loading the monitor, so they reuse it here.
  db: Database;
  region?: string;
}

/**
 * Run a single monitor check end to end:
 *   fetch -> validate result -> insert health_checks -> schedule next check.
 *
 * This is the one place that performs a check. The authenticated route and the
 * scheduled cron handler both call it, so a manual check and a cron check have
 * identical behaviour (including rescheduling).
 */
export async function runMonitorCheck(
  monitor: Monitor,
  { db, region }: RunMonitorCheckOptions,
): Promise<HealthCheck> {
  // Use the per-monitor timeout stored on the row.
  const websiteCheckResult = await checkWebsite(monitor.url, {
    timeoutMs: monitor.timeoutMs,
  });
  if (!websiteCheckResult) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to check website",
    });
  }

  const { status, statusCode, finalUrl, redirectCount, timings, error } =
    websiteCheckResult;

  const [healthCheck] = await withRetry(() =>
    db
      .insert(healthChecks)
      .values({
        monitorId: monitor.id,
        status,
        statusCode,
        finalUrl,
        redirectCount,
        ttfbMs: timings.ttfbMs,
        totalMs: timings.totalMs,
        errorType: error?.type ?? null,
        errorMessage: error?.message ?? null,
        region: region ?? null,
      })
      .returning(),
  );

  if (!healthCheck) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to save health check",
    });
  }

  // Advance the schedule based on this check, not on a later cron tick. This
  // is done for manual checks too, otherwise cron would immediately re-check
  // a monitor that was just checked through the API.
  await withRetry(() =>
    db
      .update(monitors)
      .set({
        lastCheckedAt: sql`now()`,
        nextCheckAt: sql`now() + (${monitors.intervalSeconds} * interval '1 second')`,
      })
      .where(eq(monitors.id, monitor.id)),
  );

  const parsed = ReturnHealthCheck.safeParse(healthCheck);
  if (!parsed.success) {
    throw new ApiError({
      statusCode: 500,
      message: "Failed to parse health check",
    });
  }

  return parsed.data;
}
