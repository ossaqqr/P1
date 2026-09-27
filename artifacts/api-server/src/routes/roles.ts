import { randomUUID } from "node:crypto";
import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import {
  ListRolesResponse,
  CreateRoleBody,
  CreateRoleResponse,
  UpdateRoleBody,
  UpdateRoleResponse,
} from "@workspace/api-zod";
import { db, rolesTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";

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

router.get("/roles", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const rows = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.userId, userId))
    .orderBy(asc(rolesTable.sortOrder));

  res.json(ListRolesResponse.parse(rows));
});

router.post("/roles", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const input = CreateRoleBody.parse(req.body);

  const existing = await db
    .select({ sortOrder: rolesTable.sortOrder })
    .from(rolesTable)
    .where(eq(rolesTable.userId, userId))
    .orderBy(asc(rolesTable.sortOrder));
  const nextSortOrder = existing.length > 0 ? existing[existing.length - 1].sortOrder + 1 : 0;

  const [created] = await db
    .insert(rolesTable)
    .values({
      id: randomUUID(),
      userId,
      name: input.name,
      description: input.description ?? null,
      direction: input.direction ?? null,
      isActive: true,
      sortOrder: nextSortOrder,
    })
    .returning();

  res.json(CreateRoleResponse.parse(created));
});

router.patch("/roles/:roleId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const roleId = String(req.params.roleId);
  const input = UpdateRoleBody.parse(req.body);

  const [updated] = await db
    .update(rolesTable)
    .set(input)
    .where(and(eq(rolesTable.id, roleId), eq(rolesTable.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  res.json(UpdateRoleResponse.parse(updated));
});

export default router;
