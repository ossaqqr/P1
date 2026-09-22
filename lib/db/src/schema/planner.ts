import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const plannerDataTable = pgTable("planner_data", {
  userId: text("user_id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  // Set once this user's legacy blob has been migrated into the relational
  // tables below and validated. Never cleared, never used to delete the
  // legacy row — it only gates the migration from re-running.
  migratedAt: timestamp("migrated_at", { withTimezone: true }),
});

export type PlannerDataRecord = typeof plannerDataTable.$inferSelect;