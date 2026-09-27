import { Router, type IRouter } from "express";
import healthRouter from "./health";
import plannerRouter from "./planner";
import missionRouter from "./mission";
import rolesRouter from "./roles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(plannerRouter);
router.use(missionRouter);
router.use(rolesRouter);

export default router;
