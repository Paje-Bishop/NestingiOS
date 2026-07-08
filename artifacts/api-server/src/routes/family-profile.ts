import { UpdateFamilyProfileBody } from "@workspace/api-zod";
import { db, familyProfilesTable, membershipsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

interface FamilyProfileRow {
  id: number;
  pregnancyId: number;
  feedingPreference: string | null;
  homeType: string | null;
  limitedSpace: boolean | null;
  budgetGoal: number | null;
  notificationDefaults: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function shapeProfile(row: FamilyProfileRow) {
  return {
    id: row.id,
    pregnancyId: row.pregnancyId,
    feedingPreference: row.feedingPreference ?? null,
    homeType: row.homeType ?? null,
    limitedSpace: row.limitedSpace ?? null,
    budgetGoal: row.budgetGoal ?? null,
    notificationDefaults: row.notificationDefaults
      ? (JSON.parse(row.notificationDefaults) as Record<string, boolean>)
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Confirms the caller is an active member of the pregnancy. FamilyProfile is
// Pregnancy-scoped and shared, so any active member may read and edit it.
async function loadMember(pregnancyId: number, personId: number) {
  const [membership] = await db
    .select({ id: membershipsTable.id })
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.pregnancyId, pregnancyId),
        eq(membershipsTable.personId, personId),
        eq(membershipsTable.invitationStatus, "active"),
      ),
    );
  return membership ?? null;
}

// Returns the pregnancy's profile row, creating an empty one on first access so
// callers always get a stable shape (all fields null = "unset").
async function getOrCreateProfile(pregnancyId: number): Promise<FamilyProfileRow> {
  const [existing] = await db
    .select()
    .from(familyProfilesTable)
    .where(eq(familyProfilesTable.pregnancyId, pregnancyId));
  if (existing) return existing;

  // onConflictDoNothing guards the race where two first-reads insert at once;
  // the follow-up select then returns whichever row won.
  await db
    .insert(familyProfilesTable)
    .values({ pregnancyId })
    .onConflictDoNothing({ target: familyProfilesTable.pregnancyId });
  const [created] = await db
    .select()
    .from(familyProfilesTable)
    .where(eq(familyProfilesTable.pregnancyId, pregnancyId));
  return created;
}

// GET /pregnancies/:pregnancyId/family-profile
router.get(
  "/pregnancies/:pregnancyId/family-profile",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    if (isNaN(pregnancyId)) {
      res.status(400).json({ error: "Invalid pregnancy ID" });
      return;
    }

    const member = await loadMember(pregnancyId, req.personId);
    if (!member) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    const profile = await getOrCreateProfile(pregnancyId);
    res.json(shapeProfile(profile));
  },
);

// PATCH /pregnancies/:pregnancyId/family-profile
router.patch(
  "/pregnancies/:pregnancyId/family-profile",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    if (isNaN(pregnancyId)) {
      res.status(400).json({ error: "Invalid pregnancy ID" });
      return;
    }

    const parsed = UpdateFamilyProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const body = parsed.data;

    const member = await loadMember(pregnancyId, req.personId);
    if (!member) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    // Ensure a row exists, then apply only the fields present in the body. An
    // explicit null clears a field back to "unset"; omitted fields are untouched.
    await getOrCreateProfile(pregnancyId);

    const updates: Partial<typeof familyProfilesTable.$inferInsert> = {};
    if ("feedingPreference" in body) updates.feedingPreference = body.feedingPreference ?? null;
    if ("homeType" in body) updates.homeType = body.homeType ?? null;
    if ("limitedSpace" in body) updates.limitedSpace = body.limitedSpace ?? null;
    if ("budgetGoal" in body) updates.budgetGoal = body.budgetGoal ?? null;
    if ("notificationDefaults" in body) {
      updates.notificationDefaults = body.notificationDefaults
        ? JSON.stringify(body.notificationDefaults)
        : null;
    }

    let row: FamilyProfileRow;
    if (Object.keys(updates).length > 0) {
      const [updated] = await db
        .update(familyProfilesTable)
        .set(updates)
        .where(eq(familyProfilesTable.pregnancyId, pregnancyId))
        .returning();
      row = updated;
    } else {
      row = await getOrCreateProfile(pregnancyId);
    }

    req.log.info(
      { pregnancyId, membershipId: member.id, fields: Object.keys(updates) },
      "Family profile updated",
    );

    res.json(shapeProfile(row));
  },
);

export default router;
