import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const plannerDataTable = pgTable("planner_data", {
  userId: text("user_id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type PlannerDataRecord = typeof plannerDataTable.$inferSelect;