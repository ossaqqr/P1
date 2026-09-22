import { boolean, date, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Mission / Principles — one free-form record per user, no week scope.
// ---------------------------------------------------------------------------
export const missionTable = pgTable("mission", {
  userId: text("user_id").primaryKey(),
  missionStatement: text("mission_statement").notNull().default(""),
  principles: text("principles").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type MissionRecord = typeof missionTable.$inferSelect;

// ---------------------------------------------------------------------------
// Roles — timeless (not week-scoped). A role can be deactivated instead of
// deleted so historical goals/time blocks that reference it stay meaningful.
// ---------------------------------------------------------------------------
export const rolesTable = pgTable("roles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  direction: text("direction"), // long-term purpose for this role
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type RoleRecord = typeof rolesTable.$inferSelect;

// ---------------------------------------------------------------------------
// Weekly Goals — the result wanted this week, tied to one role.
// weekStartDate anchors which week a goal belongs to (the Saturday of that
// week, matching the app's existing Sat->Fri week convention).
// ---------------------------------------------------------------------------
export const weeklyGoalsTable = pgTable("weekly_goals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull(),
  weekStartDate: date("week_start_date").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  quadrant: text("quadrant"), // 'Q1' | 'Q2' | 'Q3' | 'Q4' | null — optional, not forced
  status: text("status").notNull().default("not_started"), // not_started | in_progress | done | partial
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type WeeklyGoalRecord = typeof weeklyGoalsTable.$inferSelect;

// ---------------------------------------------------------------------------
// Tasks — a concrete action toward a goal. Distinct from the goal (the
// result) and from a time block (when it's actually done).
// ---------------------------------------------------------------------------
export const tasksTable = pgTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  goalId: text("goal_id"), // nullable: a task can exist without a goal yet
  title: text("title").notNull(),
  quadrant: text("quadrant"), // 'Q1' | 'Q2' | 'Q3' | 'Q4' | null
  isDone: boolean("is_done").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type TaskRecord = typeof tasksTable.$inferSelect;

// ---------------------------------------------------------------------------
// Time Blocks — an actual reserved slot on a specific calendar date.
// ---------------------------------------------------------------------------
export const timeBlocksTable = pgTable("time_blocks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: date("date").notNull(),
  startTime: text("start_time"), // "HH:MM" 24h, nullable for unspecified-time blocks
  endTime: text("end_time"),
  title: text("title").notNull(),
  roleId: text("role_id"),
  goalId: text("goal_id"),
  taskId: text("task_id"),
  quadrant: text("quadrant"), // 'Q1' | 'Q2' | 'Q3' | 'Q4' | null
  isFixed: boolean("is_fixed").notNull().default(false),
  isDone: boolean("is_done").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type TimeBlockRecord = typeof timeBlocksTable.$inferSelect;

// ---------------------------------------------------------------------------
// Weekly Reviews — one per user per week. entries kept as jsonb since it's
// an AI-generated, read-mostly analysis shape rather than queryable data.
// ---------------------------------------------------------------------------
export const weeklyReviewsTable = pgTable("weekly_reviews", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  weekStartDate: date("week_start_date").notNull(),
  entries: jsonb("entries").notNull(),
  message: text("message").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WeeklyReviewRecord = typeof weeklyReviewsTable.$inferSelect;
