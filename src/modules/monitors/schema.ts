import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  index,
  boolean,
  doublePrecision,
  text,
} from 'drizzle-orm/pg-core'

import { users } from '../users/schema.js';
import { groups } from '../groups/schema.js';


export const monitors = pgTable(
  'monitors',
  {
    id: serial('id').primaryKey(),

    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    groupId: integer('group_id')
      .references(() => groups.id, { onDelete: 'set null' }),

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
    index('ix_monitors_group_id').on(table.groupId),
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

    errorMessage: text('error_message'),

    checkedAt: timestamp('checked_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

  },
  (table) => [
    index('ix_health_checks_monitor_id').on(table.monitorId, table.checkedAt),
  ],
)
