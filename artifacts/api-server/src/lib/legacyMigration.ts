import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Logger } from "pino";
import {
  db,
  plannerDataTable,
  rolesTable,
  weeklyGoalsTable,
  timeBlocksTable,
  weeklyReviewsTable,
} from "@workspace/db";

// Matches the old flat JSON blob shape. Kept loose on purpose: this is
// historical data written by an earlier version of the app, so we validate
// defensively rather than with a strict schema that could block migration
// over a minor shape drift.
interface LegacyRole {
  id?: unknown;
  name?: unknown;
  goal1?: unknown;
  goal2?: unknown;
}

interface LegacyReviewEntry {
  roleId?: unknown;
  roleName?: unknown;
  goalField?: unknown;
  goalText?: unknown;
  statusVal?: unknown;
  reason?: unknown;
  advice?: unknown;
  concept?: unknown;
}

interface LegacyReview {
  entries?: unknown;
  message?: unknown;
  completedAt?: unknown;
}

interface LegacyPlannerData {
  weekEndDate?: unknown;
  roles?: unknown;
  schedule?: unknown;
  review?: unknown;
}

const DAY_ORDER = [
  "السبت",
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The Saturday on/before `d`, matching the app's Sat->Fri week convention. */
function saturdayOnOrBefore(d: Date): Date {
  const day = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const diff = (day + 1) % 7; // days since the most recent Saturday
  const result = new Date(d);
  result.setUTCDate(result.getUTCDate() - diff);
  return result;
}

function resolveWeekStartDate(weekEndDateRaw: unknown): string {
  if (isNonEmptyString(weekEndDateRaw)) {
    const parsed = new Date(`${weekEndDateRaw}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      const start = new Date(parsed);
      start.setUTCDate(start.getUTCDate() - 6);
      return toDateOnly(start);
    }
  }
  // No usable weekEndDate on the legacy record — anchor to the current week
  // so the migrated data still lands somewhere the user can find it.
  return toDateOnly(saturdayOnOrBefore(new Date()));
}

/**
 * Migrates one user's legacy JSON-blob planner data into the new relational
 * tables (roles, weekly_goals, time_blocks, weekly_reviews).
 *
 * Safe to call on every request:
 * - No-ops immediately if there's no legacy row, or it's already migrated.
 * - Runs entirely inside one transaction: either every row is inserted and
 *   validated and the legacy row is marked migrated, or nothing happens.
 * - Never deletes or modifies the legacy row's `data` — only sets
 *   `migratedAt` once migration is confirmed correct.
 */
export async function migrateLegacyPlannerData(
  userId: string,
  logger: Logger,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const [legacyRow] = await tx
        .select()
        .from(plannerDataTable)
        .where(eq(plannerDataTable.userId, userId))
        .for("update");

      if (!legacyRow || legacyRow.migratedAt) {
        return; // nothing to do — not present, or already migrated
      }

      const legacy = legacyRow.data as LegacyPlannerData;
      const weekStartDate = resolveWeekStartDate(legacy.weekEndDate);

      const legacyRoles: LegacyRole[] = Array.isArray(legacy.roles)
        ? (legacy.roles as LegacyRole[])
        : [];

      let expectedRoleCount = 0;
      let expectedGoalCount = 0;

      for (const [index, role] of legacyRoles.entries()) {
        if (!isNonEmptyString(role.name)) continue;
        const roleId = isNonEmptyString(role.id) ? role.id : randomUUID();

        await tx.insert(rolesTable).values({
          id: roleId,
          userId,
          name: role.name.trim(),
          description: null,
          direction: null,
          isActive: true,
          sortOrder: index,
        });
        expectedRoleCount += 1;

        for (const goalField of ["goal1", "goal2"] as const) {
          const goalText = role[goalField];
          if (!isNonEmptyString(goalText)) continue;
          await tx.insert(weeklyGoalsTable).values({
            id: randomUUID(),
            userId,
            roleId,
            weekStartDate,
            title: goalText.trim(),
            description: null,
            quadrant: null,
            status: "not_started",
          });
          expectedGoalCount += 1;
        }
      }

      const legacySchedule =
        legacy.schedule && typeof legacy.schedule === "object"
          ? (legacy.schedule as Record<string, unknown>)
          : {};

      let expectedTimeBlockCount = 0;
      const weekStart = new Date(`${weekStartDate}T00:00:00Z`);

      for (const [dayIndex, dayName] of DAY_ORDER.entries()) {
        const dayText = legacySchedule[dayName];
        if (!isNonEmptyString(dayText)) continue;
        const blockDate = new Date(weekStart);
        blockDate.setUTCDate(blockDate.getUTCDate() + dayIndex);

        await tx.insert(timeBlocksTable).values({
          id: randomUUID(),
          userId,
          date: toDateOnly(blockDate),
          startTime: null,
          endTime: null,
          title: dayText.trim(),
          roleId: null,
          goalId: null,
          taskId: null,
          quadrant: null,
          isFixed: false,
          isDone: false,
          notes: null,
        });
        expectedTimeBlockCount += 1;
      }

      let expectedReviewCount = 0;
      const legacyReview = legacy.review as LegacyReview | null | undefined;
      if (legacyReview && Array.isArray(legacyReview.entries)) {
        const completedAt = isNonEmptyString(legacyReview.completedAt)
          ? new Date(legacyReview.completedAt)
          : new Date();
        await tx.insert(weeklyReviewsTable).values({
          id: randomUUID(),
          userId,
          weekStartDate,
          entries: legacyReview.entries as LegacyReviewEntry[],
          message: isNonEmptyString(legacyReview.message)
            ? legacyReview.message
            : "",
          completedAt: Number.isNaN(completedAt.getTime())
            ? new Date()
            : completedAt,
        });
        expectedReviewCount = 1;
      }

      // --- Validation: re-count what actually landed in this transaction ---
      const [{ count: actualRoleCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(rolesTable)
        .where(eq(rolesTable.userId, userId));
      const [{ count: actualGoalCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(weeklyGoalsTable)
        .where(
          and(
            eq(weeklyGoalsTable.userId, userId),
            eq(weeklyGoalsTable.weekStartDate, weekStartDate),
          ),
        );
      const [{ count: actualTimeBlockCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(timeBlocksTable)
        .where(eq(timeBlocksTable.userId, userId));
      const [{ count: actualReviewCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(weeklyReviewsTable)
        .where(
          and(
            eq(weeklyReviewsTable.userId, userId),
            eq(weeklyReviewsTable.weekStartDate, weekStartDate),
          ),
        );

      if (
        actualRoleCount !== expectedRoleCount ||
        actualGoalCount !== expectedGoalCount ||
        actualTimeBlockCount !== expectedTimeBlockCount ||
        actualReviewCount !== expectedReviewCount
      ) {
        throw new Error(
          `Legacy migration validation failed for user ${userId}: ` +
            `roles ${actualRoleCount}/${expectedRoleCount}, ` +
            `goals ${actualGoalCount}/${expectedGoalCount}, ` +
            `timeBlocks ${actualTimeBlockCount}/${expectedTimeBlockCount}, ` +
            `review ${actualReviewCount}/${expectedReviewCount}`,
        );
      }

      await tx
        .update(plannerDataTable)
        .set({ migratedAt: new Date() })
        .where(eq(plannerDataTable.userId, userId));

      logger.info(
        {
          userId,
          weekStartDate,
          roles: actualRoleCount,
          goals: actualGoalCount,
          timeBlocks: actualTimeBlockCount,
          review: actualReviewCount,
        },
        "Legacy planner data migrated and validated",
      );
    });
  } catch (error) {
    // Never let a migration failure break the request the user is making.
    // The legacy row's migratedAt stays null, so this safely retries next
    // time this user hits the endpoint.
    logger.error(
      { err: error, userId },
      "Legacy planner data migration failed; will retry on next request",
    );
  }
}
