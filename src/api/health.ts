import { Hono } from "hono";
import { logger } from "../lib/logger.js";
import { getConfig } from "../config.js";
import { getDb } from "../db/connection.js";
import { sql } from "drizzle-orm";
import { withRetry } from "../db/dbUtils.js";
import type { AppEnv } from "../middleware/auth.js";

const router = new Hono<AppEnv>()

router.get("/", (c) => {
  const config = getConfig(c.env)
  logger.info('root endpoint')
  return c.json({
    message: {
      app: config.app_name,
      version: config.app_version,
    },
  })
})

router.get("/health", async (c) => {
  logger.info('health endpoint')
  try {
    const db = getDb(getConfig(c.env).database_url)
    // Retried so a single transient Neon/network blip doesn't flap the probe.
    await withRetry(() => db.execute(sql`SELECT 1`));
    return c.json({ message: "OK" });
  } catch (error) {
    logger.error(error);
    return c.json({ message: "DB error" }, 500);
  }
})

export default router
