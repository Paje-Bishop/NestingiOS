import { CreateMemoryBody } from "@workspace/api-zod";
import { db, membershipsTable, memoriesTable, personsTable } from "@workspace/db";
import { and, desc, eq, or } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

interface MemoryRow {
  id: number;
  pregnancyId: number;
  authorMembershipId: number;
  sourceType: string;
  text: string | null;
  photoUrls: string | null;
  journeyWeekNumber: number | null;
  promptLibraryItemId: number | null;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
}

function shapeMemory(row: MemoryRow, authorName: string) {
  return {
    id: row.id,
    pregnancyId: row.pregnancyId,
    authorMembershipId: row.authorMembershipId,
    authorName,
    sourceType: row.sourceType,
    text: row.text ?? null,
    photoUrls: row.photoUrls ? (JSON.parse(row.photoUrls) as string[]) : null,
    journeyWeekNumber: row.journeyWeekNumber ?? null,
    promptLibraryItemId: row.promptLibraryItemId ?? null,
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// GET /pregnancies/:pregnancyId/memories
router.get(
  "/pregnancies/:pregnancyId/memories",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    if (isNaN(pregnancyId)) {
      res.status(400).json({ error: "Invalid pregnancy ID" });
      return;
    }

    const [membership] = await db
      .select({ id: membershipsTable.id })
      .from(membershipsTable)
      .where(
        and(
          eq(membershipsTable.pregnancyId, pregnancyId),
          eq(membershipsTable.personId, req.personId),
          eq(membershipsTable.invitationStatus, "active"),
        ),
      );

    if (!membership) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    const rows = await db
      .select({
        memory: memoriesTable,
        authorName: personsTable.displayName,
      })
      .from(memoriesTable)
      .innerJoin(membershipsTable, eq(memoriesTable.authorMembershipId, membershipsTable.id))
      .innerJoin(personsTable, eq(membershipsTable.personId, personsTable.id))
      .where(
        and(
          eq(memoriesTable.pregnancyId, pregnancyId),
          // Own memories at any visibility, plus everyone else's public ones
          or(
            eq(memoriesTable.authorMembershipId, membership.id),
            eq(memoriesTable.visibility, "public"),
          ),
        ),
      )
      .orderBy(desc(memoriesTable.createdAt));

    res.json(rows.map((r) => shapeMemory(r.memory, r.authorName)));
  },
);

// POST /pregnancies/:pregnancyId/memories
router.post(
  "/pregnancies/:pregnancyId/memories",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    if (isNaN(pregnancyId)) {
      res.status(400).json({ error: "Invalid pregnancy ID" });
      return;
    }

    const parsed = CreateMemoryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const body = parsed.data;

    // A Memory requires text, at least one photo, or both (DM-001 #12)
    const hasText = Boolean(body.text && body.text.trim().length > 0);
    const hasPhoto = Boolean(body.photoUrls && body.photoUrls.length > 0);
    if (!hasText && !hasPhoto) {
      res.status(400).json({ error: "A memory needs text, a photo, or both" });
      return;
    }

    if (body.sourceType === "journey_prompt" && body.journeyWeekNumber == null) {
      res.status(400).json({ error: "journeyWeekNumber is required for a journal entry" });
      return;
    }

    const [membership] = await db
      .select({ id: membershipsTable.id, displayName: personsTable.displayName })
      .from(membershipsTable)
      .innerJoin(personsTable, eq(membershipsTable.personId, personsTable.id))
      .where(
        and(
          eq(membershipsTable.pregnancyId, pregnancyId),
          eq(membershipsTable.personId, req.personId),
          eq(membershipsTable.invitationStatus, "active"),
        ),
      );

    if (!membership) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    // Default visibility by source: journal reflections are private, standalone photos public
    const visibility = body.visibility ?? (body.sourceType === "journey_prompt" ? "private" : "public");

    try {
      const [created] = await db
        .insert(memoriesTable)
        .values({
          pregnancyId,
          authorMembershipId: membership.id,
          sourceType: body.sourceType,
          text: hasText ? body.text : null,
          photoUrls: hasPhoto ? JSON.stringify(body.photoUrls) : null,
          journeyWeekNumber: body.journeyWeekNumber ?? null,
          promptLibraryItemId: body.promptLibraryItemId ?? null,
          visibility,
        })
        .returning();

      req.log.info(
        { memoryId: created.id, pregnancyId, membershipId: membership.id, sourceType: created.sourceType },
        "Memory published",
      );

      res.status(201).json(shapeMemory(created, membership.displayName));
    } catch (err) {
      // Partial unique index: one journal-prompt memory per member per week.
      // Drizzle wraps the pg driver error, so the SQLSTATE lives on err.cause.
      const pgCode =
        (err as { code?: string })?.code ??
        (err as { cause?: { code?: string } })?.cause?.code;
      if (pgCode === "23505") {
        res.status(409).json({ error: "You've already journaled for this week" });
        return;
      }
      throw err;
    }
  },
);

export default router;
