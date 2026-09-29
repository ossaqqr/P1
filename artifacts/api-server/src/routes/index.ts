import { Router, type IRouter } from "express";
import healthRouter from "./health";
import plannerRouter from "./planner";
import missionRouter from "./mission";
import rolesRouter from "./roles";
import weeklyPlanRouter from "./weeklyPlan";

const router: IRouter = Router();

router.use(healthRouter);
router.use(plannerRouter);
router.use(missionRouter);
router.use(rolesRouter);
router.use(weeklyPlanRouter);

export default router;
