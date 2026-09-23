import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { GetMissionResponse, SaveMissionBody, SaveMissionResponse } from "@workspace/api-zod";
import { db, missionTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

router.get("/mission", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const [existing] = await db
    .select()
    .from(missionTable)
    .where(eq(missionTable.userId, userId));

  const data = GetMissionResponse.parse({
    missionStatement: existing?.missionStatement ?? "",
    principles: existing?.principles ?? "",
  });
  res.json(data);
});

router.put("/mission", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const input = SaveMissionBody.parse(req.body);

  await db
    .insert(missionTable)
    .values({
      userId,
      missionStatement: input.missionStatement,
      principles: input.principles,
    })
    .onConflictDoUpdate({
      target: missionTable.userId,
      set: {
        missionStatement: input.missionStatement,
        principles: input.principles,
      },
    });

  res.json(SaveMissionResponse.parse(input));
});

export default router;
