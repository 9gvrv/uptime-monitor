import { Hono } from "hono";
import { logger } from "../lib/logger.js";
import authRouter from "../modules/auth/router.js";
import groupRouter from "../modules/groups/router.js";
import monitorsRouter from "../modules/monitors/router.js";

const router = new Hono().basePath("/v1");

router.get("/", (c) => {
  logger.info("Hello");
  return c.json({ message: "Hello" });
});
router.route("/auth", authRouter);
router.route("/monitors", monitorsRouter);
router.route("/groups", groupRouter);

export default router;
