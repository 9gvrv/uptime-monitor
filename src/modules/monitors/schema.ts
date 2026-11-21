import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { ErrorType } from "../../lib/checkWebsite.js";
import { groups } from "../groups/schema.js";
import { users } from "../users/schema.js";

export const checkStatus = pgEnum("check_status", ["up", "down", "degraded"]);

export const monitors = pgTable(
  "monitors",
  {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    groupId: integer("group_id").references(() => groups.id, {
      onDelete: "set null",
    }),

    name: varchar("name", { length: 100 }).notNull(),
    url: varchar("url", { length: 2048 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    // camelCase in TypeScript/JSON, snake_case in Postgres — matches the
    // convention used by every other column in this schema.
    intervalSeconds: integer("interval_seconds").default(300).notNull(),
    timeoutMs: integer("timeout_ms").default(5000).notNull(),

    // Scheduling state used by the cron handler. New monitors are due right
    // away; after every check the runner pushes nextCheckAt out by one
    // interval and records when the check actually happened.
    nextCheckAt: timestamp("next_check_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ix_monitors_user_id").on(table.userId),
    index("ix_monitors_group_id").on(table.groupId),
    // The cron query filters on next_check_at <= now() and orders by it.
    index("ix_monitors_next_check_at").on(table.nextCheckAt),
    // Enforce one monitor per URL per user at the database level. The
    // SELECT-then-INSERT check in the POST route is only a friendly pre-check;
    // this constraint is what actually prevents duplicates under concurrency.
    uniqueIndex("uq_monitors_user_id_url").on(table.userId, table.url),
  ],
);

export const healthChecks = pgTable(
  "health_checks",
  {
    id: serial("id").primaryKey(),

    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),

    status: checkStatus("status").notNull(),

    statusCode: smallint("status_code"),
    finalUrl: text("final_url"),
    redirectCount: smallint("redirect_count").notNull().default(0),

    ttfbMs: integer("ttfb_ms"),
    totalMs: integer("total_ms").notNull(),

    errorType: text("error_type").$type<ErrorType>(),
    errorMessage: text("error_message"),

    region: text("region"),

    checkedAt: timestamp("checked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ix_health_checks_monitor_id").on(table.monitorId, table.checkedAt),
  ],
);
