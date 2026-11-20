import type { Context } from "hono";
import { ApiError } from "./apiError.js";

export const CHECK_STATUSES = ["up", "down", "degraded"] as const;

export type CheckStatus = (typeof CHECK_STATUSES)[number];

export type HealthCheckFilter = {
  status: CheckStatus | undefined;
  from: Date | undefined;
  to: Date | undefined;
};

function isCheckStatus(value: string): value is CheckStatus {
  return (CHECK_STATUSES as readonly string[]).includes(value);
}

function parseDate(raw: string | undefined, name: "from" | "to"): Date | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError({
      statusCode: 400,
      message: `${name} must be a valid ISO date`,
    });
  }

  return date;
}

/**
 * Parses the optional health-check history filters.
 *
 * Each parameter is independent: `from` and `to` work with or without a
 * `status` filter. Invalid values are rejected here rather than being passed
 * to Postgres as an Invalid Date or an arbitrary string.
 */
export function getHealthCheckFilter(c: Context): HealthCheckFilter {
  const rawStatus = c.req.query("status");
  let status: CheckStatus | undefined;

  if (rawStatus !== undefined && rawStatus !== "") {
    if (!isCheckStatus(rawStatus)) {
      throw new ApiError({
        statusCode: 400,
        message: `status must be one of: ${CHECK_STATUSES.join(", ")}`,
      });
    }
    status = rawStatus;
  }

  const from = parseDate(c.req.query("from"), "from");
  const to = parseDate(c.req.query("to"), "to");

  if (from !== undefined && to !== undefined && from > to) {
    throw new ApiError({ statusCode: 400, message: "from must be before to" });
  }

  return { status, from, to };
}
