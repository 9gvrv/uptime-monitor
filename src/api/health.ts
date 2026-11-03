import { Hono } from "hono";
import { logger } from "../lib/logger.js";
import config from "../config.js";
import db from "../db/connection.js";
import { sql } from "drizzle-orm";
import { withRetry } from "../db/dbUtils.js";

const router = new Hono()

router.get("/", (c) => {
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
    // Retried so a single transient Neon/network blip doesn't flap the probe.
    await withRetry(() => db.execute(sql`SELECT 1`));
    return c.json({ message: "OK" });
  } catch (error) {
    logger.error(error);
    return c.json({ message: "DB error" }, 500);
  }
})

export default router;
