import {
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "../users/schema.js";

export const groups = pgTable(
  "groups",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 255 }),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_groups_user_id").on(table.userId)],
);
