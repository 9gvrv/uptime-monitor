import type { Context } from "hono";
import { ApiError } from "./apiError.js";

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/**
 * Turns the `page` / `limit` query params into safe SQL pagination values.
 *
 * `Number(query) || fallback` (the old approach) let `page=-5` through, which
 * produces a negative OFFSET and a Postgres error, and let an arbitrarily
 * large `limit` through. Both are rejected here before reaching the database.
 */
export function getPagination(c: Context): {
  page: number;
  limit: number;
  offset: number;
} {
  const parse = (
    raw: string | undefined,
    fallback: number,
    name: string,
    max?: number,
  ): number => {
    if (raw === undefined || raw === "") return fallback;

    const value = Number(raw);
    if (
      !Number.isInteger(value) ||
      value < 1 ||
      (max !== undefined && value > max)
    ) {
      throw new ApiError({
        statusCode: 400,
        message:
          max === undefined
            ? `${name} must be a positive integer`
            : `${name} must be an integer between 1 and ${max}`,
      });
    }

    return value;
  };

  const page = parse(c.req.query("page"), 1, "page");
  const limit = parse(
    c.req.query("limit"),
    DEFAULT_PAGE_SIZE,
    "limit",
    MAX_PAGE_SIZE,
  );

  return { page, limit, offset: (page - 1) * limit };
}
