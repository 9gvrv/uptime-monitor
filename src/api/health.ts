import { Hono } from "hono";
import { logger } from "../lib/logger.js";
import config from "../config.js";
import db from "../db/connection.js";
import { sql } from "drizzle-orm";

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
    await db.execute(sql`SELECT 1`);
    return c.json({ message: "OK" });
  } catch (error) {
    logger.error(error);
    return c.json({ message: "DB error" }, 500);
  }
})

export default router;
