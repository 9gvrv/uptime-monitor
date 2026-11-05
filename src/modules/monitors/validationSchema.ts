import { z } from "zod";

export const registerMonitorSchema = z.object({
  name: z.string(),
  url: z.string().url(),
});
