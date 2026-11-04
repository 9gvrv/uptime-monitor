import {
  pgTable,
  serial,
  integer,
  varchar,
  doublePrecision,
  timestamp,
  index,
  boolean
} from 'drizzle-orm/pg-core'

import { users } from '../users/schema.js'


export const monitors = pgTable(
  'monitors',
  {
    id: serial('id').primaryKey(),

    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 100 }).notNull(),
    url: varchar('url', { length: 2048 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

  },
  (table) => [
    index('ix_monitors_user_id').on(table.userId),
  ],
)

export const healthChecks = pgTable(
  'health_checks',
  {
    id: serial('id').primaryKey(),

    monitorId: integer('monitor_id')
      .notNull()
      .references(() => monitors.id, { onDelete: 'cascade' }),

    statusCode: integer('status_code'),

    latencyMs: doublePrecision('latency_ms'),

    isUp: boolean('is_up').notNull(),

    errorMessage: varchar('error_message', { length: 2048 }),

    checkedAt: timestamp('checked_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

  },
  (table) => [
    index('ix_health_checks_monitor_id').on(table.monitorId, table.checkedAt),
  ],
)
