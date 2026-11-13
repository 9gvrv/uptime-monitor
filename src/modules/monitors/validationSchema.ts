import { z } from "zod";

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
  statusCode: z.number().positive().nullable(),
  latencyMs: z.number(),
  isUp: z.boolean(),
  errorMessage: z.string().nullable(),
  checkedAt: z.date(),
});
