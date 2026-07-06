import { TrackEventBody } from "@workspace/api-zod";
import { analyticsEventsTable, db } from "@workspace/db";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// POST /analytics
router.post("/analytics", requireAuth, async (req, res): Promise<void> => {
  const parsed = TrackEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { event, pregnancyId, properties } = parsed.data;

  await db.insert(analyticsEventsTable).values({
    event,
    personId: req.personId,
    pregnancyId: pregnancyId ?? null,
    properties: properties ? JSON.stringify(properties) : null,
  });

  res.status(204).end();
});

export default router;
