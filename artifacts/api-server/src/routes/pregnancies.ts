import { CreatePregnancyBody, UpdatePregnancyBody } from "@workspace/api-zod";
import { db, membershipsTable, personsTable, pregnanciesTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middleware/auth";
import { generateCode } from "../lib/codes";

const router: IRouter = Router();

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

// GET /pregnancies/mine — must come before /:id
router.get("/pregnancies/mine", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      pregnancyId: pregnanciesTable.id,
      name: pregnanciesTable.name,
      dueDate: pregnanciesTable.dueDate,
      dueDatePrecision: pregnanciesTable.dueDatePrecision,
      status: pregnanciesTable.status,
      joinCode: pregnanciesTable.joinCode,
      createdAt: pregnanciesTable.createdAt,
      myRole: membershipsTable.role,
    })
    .from(membershipsTable)
    .innerJoin(pregnanciesTable, eq(membershipsTable.pregnancyId, pregnanciesTable.id))
    .where(
      and(
        eq(membershipsTable.personId, req.personId),
        eq(membershipsTable.invitationStatus, "active"),
      ),
    )
    .orderBy(desc(pregnanciesTable.createdAt));

  const pregnancies = await Promise.all(
    rows.map(async (row) => {
      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(membershipsTable)
        .where(
          and(
            eq(membershipsTable.pregnancyId, row.pregnancyId),
            eq(membershipsTable.invitationStatus, "active"),
          ),
        );
      return {
        id: row.pregnancyId,
        name: row.name,
        dueDate: row.dueDate ?? null,
        dueDatePrecision: row.dueDatePrecision,
        status: row.status,
        joinCode: row.joinCode,
        myRole: row.myRole,
        memberCount: countRow.count,
        createdAt: row.createdAt,
      };
    }),
  );

  res.json(pregnancies);
});

// POST /pregnancies
router.post("/pregnancies", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreatePregnancyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { name, dueDate, dueDatePrecision, role } = parsed.data;

  const joinCode = generateCode(8);
  const pregnancyName = name?.trim() || "Baby";

  // dueDate comes from zod.coerce.date() — convert to YYYY-MM-DD string for the date column
  const dueDateString = dueDate ? toDateString(dueDate) : null;

  const [pregnancy] = await db
    .insert(pregnanciesTable)
    .values({
      name: pregnancyName,
      dueDate: dueDateString,
      dueDatePrecision,
      joinCode,
    })
    .returning();

  const [membership] = await db
    .insert(membershipsTable)
    .values({
      personId: req.personId,
      pregnancyId: pregnancy.id,
      role,
      invitationStatus: "active",
    })
    .returning();

  req.log.info({ pregnancyId: pregnancy.id, personId: req.personId, role }, "Pregnancy created");

  res.status(201).json({
    pregnancy: {
      id: pregnancy.id,
      name: pregnancy.name,
      dueDate: pregnancy.dueDate ?? null,
      dueDatePrecision: pregnancy.dueDatePrecision,
      status: pregnancy.status,
      joinCode: pregnancy.joinCode,
      createdAt: pregnancy.createdAt,
      updatedAt: pregnancy.updatedAt,
    },
    membership: {
      id: membership.id,
      personId: membership.personId,
      pregnancyId: membership.pregnancyId,
      role: membership.role,
      invitationStatus: membership.invitationStatus,
      createdAt: membership.createdAt,
    },
  });
});

// GET /pregnancies/:id
router.get("/pregnancies/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid pregnancy ID" });
    return;
  }

  const [pregnancy] = await db
    .select()
    .from(pregnanciesTable)
    .where(eq(pregnanciesTable.id, id));

  if (!pregnancy) {
    res.status(404).json({ error: "Pregnancy not found" });
    return;
  }

  const [myMembership] = await db
    .select()
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.pregnancyId, id),
        eq(membershipsTable.personId, req.personId),
        eq(membershipsTable.invitationStatus, "active"),
      ),
    );

  if (!myMembership) {
    res.status(403).json({ error: "Not a member of this pregnancy" });
    return;
  }

  const memberRows = await db
    .select({
      personId: membershipsTable.personId,
      role: membershipsTable.role,
      displayName: personsTable.displayName,
    })
    .from(membershipsTable)
    .innerJoin(personsTable, eq(membershipsTable.personId, personsTable.id))
    .where(
      and(
        eq(membershipsTable.pregnancyId, id),
        eq(membershipsTable.invitationStatus, "active"),
      ),
    );

  res.json({
    pregnancy: {
      id: pregnancy.id,
      name: pregnancy.name,
      dueDate: pregnancy.dueDate ?? null,
      dueDatePrecision: pregnancy.dueDatePrecision,
      status: pregnancy.status,
      joinCode: pregnancy.joinCode,
      createdAt: pregnancy.createdAt,
      updatedAt: pregnancy.updatedAt,
    },
    members: memberRows.map((m) => ({
      id: m.personId,
      displayName: m.displayName,
      role: m.role,
    })),
    myMembership: {
      id: myMembership.id,
      personId: myMembership.personId,
      pregnancyId: myMembership.pregnancyId,
      role: myMembership.role,
      invitationStatus: myMembership.invitationStatus,
      createdAt: myMembership.createdAt,
    },
  });
});

// PATCH /pregnancies/:id
router.patch("/pregnancies/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid pregnancy ID" });
    return;
  }

  const parsed = UpdatePregnancyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [myMembership] = await db
    .select()
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.pregnancyId, id),
        eq(membershipsTable.personId, req.personId),
        eq(membershipsTable.invitationStatus, "active"),
      ),
    );

  if (!myMembership) {
    res.status(403).json({ error: "Not a member of this pregnancy" });
    return;
  }

  const { name, dueDate, dueDatePrecision } = parsed.data;
  const updates: Partial<{
    name: string;
    dueDate: string;
    dueDatePrecision: string;
  }> = {};

  if (name !== undefined) updates.name = name;
  // dueDate comes from zod.coerce.date() — convert to YYYY-MM-DD
  if (dueDate !== undefined) updates.dueDate = toDateString(dueDate);
  if (dueDatePrecision !== undefined) updates.dueDatePrecision = dueDatePrecision;

  const [pregnancy] = await db
    .update(pregnanciesTable)
    .set(updates)
    .where(eq(pregnanciesTable.id, id))
    .returning();

  res.json({
    id: pregnancy.id,
    name: pregnancy.name,
    dueDate: pregnancy.dueDate ?? null,
    dueDatePrecision: pregnancy.dueDatePrecision,
    status: pregnancy.status,
    joinCode: pregnancy.joinCode,
    createdAt: pregnancy.createdAt,
    updatedAt: pregnancy.updatedAt,
  });
});

export default router;
