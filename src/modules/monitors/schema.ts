import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  index,
  boolean,
  pgEnum,
  smallint,
  text,
} from 'drizzle-orm/pg-core'

import { users } from '../users/schema.js';
import { groups } from '../groups/schema.js';
import type { ErrorType } from '../../lib/checkWebsite.js';



export const checkStatus = pgEnum('check_status', ['up', 'down', 'degraded'])

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

    status: checkStatus('status').notNull(),

    statusCode: smallint('status_code'),
    finalUrl: text('final_url'),
    redirectCount: smallint('redirect_count').notNull().default(0),

    ttfbMs: integer('ttfb_ms'),
    totalMs: integer('total_ms').notNull(),

    errorType: text('error_type').$type<ErrorType>(),
    errorMessage: text('error_message'),

    region: text('region'),

    checkedAt: timestamp('checked_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('ix_health_checks_monitor_id').on(table.monitorId, table.checkedAt),
  ],
)
