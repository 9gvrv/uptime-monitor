import { and, eq, lte, sql } from "drizzle-orm";
import { type Bindings, getConfig } from "./config.js";
import { getDb } from "./db/connection.js";
import { withRetry } from "./db/dbUtils.js";
import { logger } from "./lib/logger.js";
import { runMonitorCheck } from "./lib/runMonitorCheck.js";
import { monitors } from "./modules/monitors/schema.js";

/**
 * Maximum monitors handled in one scheduled tick. Every check advances that
 * monitor's next_check_at, so anything beyond the batch is simply picked up on
 * the next tick instead of being skipped.
 */
const BATCH_SIZE = 100;

/**
 * Cron entry point: load the active monitors that are due, then run each one
 * through the same runner used by POST /:id/check. No check logic lives here.
 */
export async function runScheduledChecks(env: Bindings): Promise<void> {
  const db = getDb(getConfig(env).database_url);

  const dueMonitors = await withRetry(() =>
    db
      .select()
      .from(monitors)
      .where(
        and(eq(monitors.isActive, true), lte(monitors.nextCheckAt, sql`now()`)),
      )
      .orderBy(monitors.nextCheckAt)
      .limit(BATCH_SIZE),
  );

  for (const monitor of dueMonitors) {
    try {
      await runMonitorCheck(monitor, { db });
      logger.info({ monitorId: monitor.id }, "Scheduled check completed");
    } catch (error) {
      // A single failed monitor must not stop the rest of the batch.
      logger.error({ monitorId: monitor.id, error }, "Scheduled check failed");
    }
  }
}
