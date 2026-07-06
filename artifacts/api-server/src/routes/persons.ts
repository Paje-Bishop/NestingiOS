import { UpdateMeBody } from "@workspace/api-zod";
import { db, personsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// PATCH /persons/me
router.patch("/persons/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { displayName, email } = parsed.data;
  const updates: Partial<{ displayName: string; email: string }> = {};

  if (displayName !== undefined) updates.displayName = displayName;
  if (email !== undefined) updates.email = email;

  if (Object.keys(updates).length === 0) {
    const [person] = await db
      .select()
      .from(personsTable)
      .where(eq(personsTable.id, req.personId));
    res.json({
      id: person.id,
      displayName: person.displayName,
      phone: person.phone,
      email: person.email ?? null,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    });
    return;
  }

  const [person] = await db
    .update(personsTable)
    .set(updates)
    .where(eq(personsTable.id, req.personId))
    .returning();

  res.json({
    id: person.id,
    displayName: person.displayName,
    phone: person.phone,
    email: person.email ?? null,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  });
});

export default router;
