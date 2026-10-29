import {
  pgTable,
  serial,
  integer,
  varchar,
  doublePrecision,
  timestamp,
  index,
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

    timeoutSeconds: doublePrecision('timeout_seconds')
      .notNull()
      .default(10.0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('ix_monitors_user_id').on(table.userId)],
)
