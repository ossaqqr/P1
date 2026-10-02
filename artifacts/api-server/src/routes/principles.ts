import { randomUUID } from "node:crypto";
import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import {
  ListPrinciplesResponse,
  CreatePrincipleBody,
  CreatePrincipleResponse,
  UpdatePrincipleBody,
  UpdatePrincipleResponse,
} from "@workspace/api-zod";
import { db, principlesTable } from "@workspace/db";
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

router.get("/principles", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const rows = await db
    .select()
    .from(principlesTable)
    .where(eq(principlesTable.userId, userId))
    .orderBy(asc(principlesTable.sortOrder));

  res.json(ListPrinciplesResponse.parse(rows));
});

router.post("/principles", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const input = CreatePrincipleBody.parse(req.body);

  const existing = await db
    .select({ sortOrder: principlesTable.sortOrder })
    .from(principlesTable)
    .where(eq(principlesTable.userId, userId))
    .orderBy(asc(principlesTable.sortOrder));
  const nextSortOrder = existing.length > 0 ? existing[existing.length - 1].sortOrder + 1 : 0;

  const [created] = await db
    .insert(principlesTable)
    .values({ id: randomUUID(), userId, text: input.text, sortOrder: nextSortOrder })
    .returning();

  res.json(CreatePrincipleResponse.parse(created));
});

router.patch("/principles/:principleId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const principleId = String(req.params.principleId);
  const input = UpdatePrincipleBody.parse(req.body);

  const [updated] = await db
    .update(principlesTable)
    .set(input)
    .where(and(eq(principlesTable.id, principleId), eq(principlesTable.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Principle not found" });
    return;
  }

  res.json(UpdatePrincipleResponse.parse(updated));
});

router.delete("/principles/:principleId", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const principleId = String(req.params.principleId);

  const [deleted] = await db
    .delete(principlesTable)
    .where(and(eq(principlesTable.id, principleId), eq(principlesTable.userId, userId)))
    .returning({ id: principlesTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Principle not found" });
    return;
  }

  res.status(204).end();
});

export default router;
