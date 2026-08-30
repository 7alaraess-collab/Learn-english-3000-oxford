import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
  reviewDates: jsonb("review_dates")
    .$type<Record<string, string>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserProgress = typeof userProgressTable.$inferSelect;