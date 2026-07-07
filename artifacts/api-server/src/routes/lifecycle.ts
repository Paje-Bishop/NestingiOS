import { TransitionLifecycleBody } from "@workspace/api-zod";
import { db, membershipsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";

import { requireAuth } from "../middleware/auth";
import { applyLifecycleTransition, type LifecycleCommand } from "../services/lifecycle";

const router: IRouter = Router();

// Loads the caller's membership for a pregnancy. Only an active membership
// (joined AND not archived/left/removed) may drive Pregnancy lifecycle.
async function loadMembership(pregnancyId: number, personId: number) {
  const [m] = await db
    .select({
      id: membershipsTable.id,
      invitationStatus: membershipsTable.invitationStatus,
      status: membershipsTable.status,
    })
    .from(membershipsTable)
    .where(
      and(eq(membershipsTable.pregnancyId, pregnancyId), eq(membershipsTable.personId, personId)),
    );
  return m ?? null;
}

// POST /pregnancies/:pregnancyId/lifecycle-transitions
router.post(
  "/pregnancies/:pregnancyId/lifecycle-transitions",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    if (isNaN(pregnancyId)) {
      res.status(400).json({ error: "Invalid pregnancy ID" });
      return;
    }

    const parsed = TransitionLifecycleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const body = parsed.data;

    const membership = await loadMembership(pregnancyId, req.personId);
    if (!membership || membership.invitationStatus !== "active") {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }
    // Archived / Left / Removed memberships may not initiate lifecycle changes.
    if (membership.status !== "active") {
      res.status(403).json({ error: "Only an active membership may change the pregnancy lifecycle" });
      return;
    }

    const result = await applyLifecycleTransition({
      pregnancyId,
      membershipId: membership.id,
      command: body.command as LifecycleCommand,
      idempotencyKey: body.idempotencyKey ?? null,
      // Orval coerces `format: date` to a Date; the date column stores YYYY-MM-DD.
      birthDate: body.birthDate ? body.birthDate.toISOString().split("T")[0] : null,
      birthTime: body.birthTime ?? null,
      birthTimeZone: body.birthTimeZone ?? null,
      babyName: body.babyName ?? null,
      firstMemoryText: body.firstMemoryText ?? null,
      firstMemoryVisibility: body.firstMemoryVisibility ?? null,
      confirmation: body.confirmation ?? undefined,
    });

    if (!result.ok) {
      res.status(result.httpStatus).json({
        error: result.error,
        code: result.code,
        ...(result.currentStatus ? { currentStatus: result.currentStatus } : {}),
      });
      return;
    }

    req.log.info(
      {
        pregnancyId,
        membershipId: membership.id,
        command: body.command,
        from: result.from,
        to: result.to,
        applied: result.applied,
      },
      "Lifecycle transition",
    );

    res.json({
      pregnancy: {
        id: result.pregnancy.id,
        status: result.pregnancy.status,
        birthDate: result.pregnancy.birthDate ?? null,
        birthTime: result.pregnancy.birthTime ?? null,
        birthTimeZone: result.pregnancy.birthTimeZone ?? null,
        babyName: result.pregnancy.babyName ?? null,
        updatedAt: result.pregnancy.updatedAt,
      },
      transition: { from: result.from, to: result.to, applied: result.applied },
      laborSession: result.laborSession ? { id: result.laborSession.id } : null,
      memoryId: result.memoryId,
    });
  },
);

// Membership archive/unarchive mutate the caller's own Membership, not the
// Pregnancy — kept as separate endpoints per the contract §9.
async function setArchive(req: Request, res: Response, archived: boolean): Promise<void> {
  const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
  if (isNaN(pregnancyId)) {
    res.status(400).json({ error: "Invalid pregnancy ID" });
    return;
  }

  const membership = await loadMembership(pregnancyId, req.personId);
  if (!membership || membership.invitationStatus !== "active") {
    res.status(403).json({ error: "Not a member of this pregnancy" });
    return;
  }
  // Left/removed members can't toggle archive; only active<->archived is allowed.
  if (membership.status !== "active" && membership.status !== "archived") {
    res.status(403).json({ error: "This membership can't be archived" });
    return;
  }

  const [updated] = await db
    .update(membershipsTable)
    .set({ status: archived ? "archived" : "active", archivedAt: archived ? new Date() : null })
    .where(eq(membershipsTable.id, membership.id))
    .returning({ id: membershipsTable.id, status: membershipsTable.status, archivedAt: membershipsTable.archivedAt });

  res.json({ membershipId: updated.id, status: updated.status, archivedAt: updated.archivedAt ?? null });
}

// POST /pregnancies/:pregnancyId/membership/archive
router.post("/pregnancies/:pregnancyId/membership/archive", requireAuth, (req, res) =>
  setArchive(req, res, true),
);

// POST /pregnancies/:pregnancyId/membership/unarchive
router.post("/pregnancies/:pregnancyId/membership/unarchive", requireAuth, (req, res) =>
  setArchive(req, res, false),
);

export default router;
