import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userProgressTable = pgTable("user_progress", {
  userId: text("user_id").primaryKey(),
  completedWordIds: integer("completed_word_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::integer[]`),
  completedDayNumbers: integer("completed_day_numbers")
    .array()
    .notNull()
    .default(sql`ARRAY[]::integer[]`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserProgress = typeof userProgressTable.$inferSelect;