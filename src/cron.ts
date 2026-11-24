import { and, eq, lte, sql } from "drizzle-orm";
import { type Bindings, getConfig } from "./config.js";
import { getDb } from "./db/connection.js";
import { withRetry } from "./db/dbUtils.js";
import { logger } from "./lib/logger.js";
import { runMonitorCheck } from "./lib/runMonitorCheck.js";
import { monitors } from "./modules/monitors/schema.js";

/**
 * Maximum monitors handled in one scheduled tick. A check costs at least one
 * subrequest (plus DoH on failure and one per redirect), so keep this below
 * the Free plan's per-invocation subrequest budget. Everything beyond the
 * batch stays due and is picked up on the next tick.
 */
const BATCH_SIZE = 10;

/**
 * Short lease used to claim a monitor before checking it. Without this, two
 * overlapping ticks could both see the same due row and run it twice. The
 * runner overwrites next_check_at with the real schedule when it succeeds;
 * on failure the lease lets us retry after a couple of minutes.
 */
const CLAIM_LEASE = sql`now() + interval '2 minutes'`;

/**
 * Cron entry point: load the active monitors that are due, then run each one
 * through the same runner used by POST /:id/check. No check logic lives here.
 */
export async function runScheduledChecks(
  env: Bindings,
  region?: string,
): Promise<void> {
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
      // Conditional update = atomic claim. The WHERE clause is the same
      // "due" predicate as the SELECT, so only one tick can win the row.
      const [claimed] = await withRetry(() =>
        db
          .update(monitors)
          .set({ nextCheckAt: CLAIM_LEASE })
          .where(
            and(
              eq(monitors.id, monitor.id),
              lte(monitors.nextCheckAt, sql`now()`),
            ),
          )
          .returning({ id: monitors.id }),
      );

      // Another tick (or a manual check) already advanced this monitor.
      if (!claimed) continue;

      await runMonitorCheck(monitor, { db, region });
      logger.info({ monitorId: monitor.id }, "Scheduled check completed");
    } catch (error) {
      // A single failed monitor must not stop the rest of the batch. The
      // claim lease expires on its own, so a later tick can retry it.
      logger.error({ monitorId: monitor.id, error }, "Scheduled check failed");
    }
  }
}
