import { Hono } from "hono"
import healthRouter from "./api/health.js"
import router from "./api/router.js"

const createApp = () => {
  const app = new Hono()
  app.route("/", healthRouter);
  app.route("/api", router);

  return app
}

export default createApp;
