import { Router, type IRouter } from "express";

import analyticsRouter from "./analytics";
import authRouter from "./auth";
import healthRouter from "./health";
import invitationsRouter from "./invitations";
import personsRouter from "./persons";
import pregnanciesRouter from "./pregnancies";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(personsRouter);
router.use(pregnanciesRouter);
router.use(invitationsRouter);
router.use(analyticsRouter);

export default router;
