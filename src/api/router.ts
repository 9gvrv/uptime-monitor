import { Hono } from "hono";
import { logger } from "../lib/logger.js";

const router = new Hono().basePath("/v1");

router.get("/", (c) => {
  logger.info("Hello");
  return c.json({ message: "Hello" });
});

export default router;
