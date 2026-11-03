import type { Context } from "hono";
import { ApiError } from "./apiError.js";

/**
 * Safely parses the request body as JSON.
 * Throws a 400 ApiError for malformed JSON, empty bodies, or wrong content types
 * instead of letting a raw SyntaxError escape to the generic 500 handler.
 */
export async function readJson(c: Context) {
  try {
    return await c.req.json();
  } catch {
    throw new ApiError({ statusCode: 400, message: "Invalid or missing JSON Body" });
  }
}
