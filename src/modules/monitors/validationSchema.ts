import { z } from "zod";
import { ERROR_TYPES } from "../../lib/checkWebsite.js";

export const registerMonitorSchema = z.object({
  name: z.string(),
  url: z.string().url(),
});

export const freeHealthCheckSchema = z.object({
  url: z.string().url(),
});

export const ReturnHealthCheck = z.object({
  id: z.number().positive(),
  monitorId: z.number().positive(),
  status: z.enum(["up", "down", "degraded"]),
  statusCode: z.number().positive().nullable(),
  finalUrl: z.string().nullable(),
  redirectCount: z.number().int().nonnegative(),
  ttfbMs: z.number().int().nonnegative().nullable(),
  totalMs: z.number().int().nonnegative(),
  errorType: z.enum(ERROR_TYPES).nullable(),
  errorMessage: z.string().nullable(),
  region: z.string().nullable(),
  checkedAt: z.date(),
});
