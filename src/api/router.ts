import { Hono } from "hono";
import { logger } from "../lib/logger.js";
import authRouter from "../modules/auth/router.js";
const router = new Hono().basePath("/v1");

router.get("/", (c) => {
  logger.info("Hello");
  return c.json({ message: "Hello" });
});
router.route("/", authRouter)

export default router;
