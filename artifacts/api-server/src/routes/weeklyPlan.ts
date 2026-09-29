import { randomUUID } from "node:crypto";
import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import {
  GetWeekPlanResponse,
  CreateGoalBody,
  CreateGoalResponse,
  UpdateGoalBody,
  UpdateGoalResponse,
  CreateTaskBody,
  CreateTaskResponse,
  UpdateTaskBody,
  UpdateTaskResponse,
} from "@workspace/api-zod";
import { db, rolesTable, weeklyGoalsTable, tasksTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

const requireAuth: RequestHandler = (req, res, next) => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.locals.userId = userId;
  next();
};

const WEEK_START_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/weeks/:weekStartDate/plan", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const weekStartDate = String(req.params.weekStartDate);
  if (!WEEK_START_DATE_RE.test(weekStartDate)) {
    res.status(400).json({ error: "Invalid date, expected YYYY-MM-DD" });
    return;
  }

  const goals = await db
    .select()
    .from(weeklyGoalsTable)
    .where(and(eq(weeklyGoalsTable.userId, userId), eq(weeklyGoalsTable.weekStartDate, weekStartDate)));

  const goalIds = goals.map((g) => g.id);
  const tasks = goalIds.length
    ? await db
        .select()
        .from(tasksTable)
        .where(and(eq(tasksTable.userId, userId), inArray(tasksTable.goalId, goalIds)))
    : [];

  res.json(GetWeekPlanResponse.parse({ goals, tasks }));
});

router.post("/goals", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const input = CreateGoalBody.parse(req.body);

  const [role] = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(and(eq(rolesTable.id, input.roleId), eq(rolesTable.userId, userId)));
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  const [created] = await db
    .insert(weeklyGoalsTable)
    .values({
      id: randomUUID(),
      userId,
      roleId: input.roleId,
      weekStartDate: input.weekStartDate,
      title: input.title,
      description: input.description ?? null,
      quadrant: null,
      status: "not_started",
    })
    .returning();

  res.json(CreateGoalResponse.parse(created));
});

router.patch("/goals/:goalId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const goalId = String(req.params.goalId);
  const input = UpdateGoalBody.parse(req.body);

  const [updated] = await db
    .update(weeklyGoalsTable)
    .set(input)
    .where(and(eq(weeklyGoalsTable.id, goalId), eq(weeklyGoalsTable.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.json(UpdateGoalResponse.parse(updated));
});

router.delete("/goals/:goalId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const goalId = String(req.params.goalId);

  const [deleted] = await db
    .delete(weeklyGoalsTable)
    .where(and(eq(weeklyGoalsTable.id, goalId), eq(weeklyGoalsTable.userId, userId)))
    .returning({ id: weeklyGoalsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  await db.delete(tasksTable).where(and(eq(tasksTable.goalId, goalId), eq(tasksTable.userId, userId)));

  res.status(204).end();
});

router.post("/tasks", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const input = CreateTaskBody.parse(req.body);

  const [goal] = await db
    .select({ id: weeklyGoalsTable.id })
    .from(weeklyGoalsTable)
    .where(and(eq(weeklyGoalsTable.id, input.goalId), eq(weeklyGoalsTable.userId, userId)));
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const [created] = await db
    .insert(tasksTable)
    .values({
      id: randomUUID(),
      userId,
      goalId: input.goalId,
      title: input.title,
      quadrant: null,
      isDone: false,
    })
    .returning();

  res.json(CreateTaskResponse.parse(created));
});

router.patch("/tasks/:taskId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const taskId = String(req.params.taskId);
  const input = UpdateTaskBody.parse(req.body);

  const [updated] = await db
    .update(tasksTable)
    .set(input)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(UpdateTaskResponse.parse(updated));
});

router.delete("/tasks/:taskId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const taskId = String(req.params.taskId);

  const [deleted] = await db
    .delete(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))
    .returning({ id: tasksTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.status(204).end();
});

export default router;
