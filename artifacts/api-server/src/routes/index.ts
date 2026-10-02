import { Router, type IRouter } from "express";
import healthRouter from "./health";
import plannerRouter from "./planner";
import missionRouter from "./mission";
import rolesRouter from "./roles";
import weeklyPlanRouter from "./weeklyPlan";
import principlesRouter from "./principles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(plannerRouter);
router.use(missionRouter);
router.use(rolesRouter);
router.use(weeklyPlanRouter);
router.use(principlesRouter);

export default router;
