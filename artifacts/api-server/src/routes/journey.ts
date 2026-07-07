import {
  db,
  journeyWeeksTable,
  membershipsTable,
  memoriesTable,
  memoryPromptsTable,
  personsTable,
  pregnanciesTable,
} from "@workspace/db";
import { and, asc, eq, gte, lte, notInArray, or } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// EDD is the start of week 40. Given a due date, the current gestational week is
// 40 minus the number of whole weeks still remaining until the due date.
function weekFromDueDate(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = Math.round((due.getTime() - today.getTime()) / msPerDay);
  const week = 40 - Math.floor(daysUntilDue / 7);
  return Math.min(42, Math.max(1, week));
}

// GET /pregnancies/:pregnancyId/journey/current
router.get(
  "/pregnancies/:pregnancyId/journey/current",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    if (isNaN(pregnancyId)) {
      res.status(400).json({ error: "Invalid pregnancy ID" });
      return;
    }

    const [membership] = await db
      .select({
        id: membershipsTable.id,
        role: membershipsTable.role,
      })
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

    const [pregnancy] = await db
      .select({
        dueDate: pregnanciesTable.dueDate,
        dueDatePrecision: pregnanciesTable.dueDatePrecision,
      })
      .from(pregnanciesTable)
      .where(eq(pregnanciesTable.id, pregnancyId));

    if (!pregnancy?.dueDate || pregnancy.dueDatePrecision === "unknown") {
      res.json({ state: "needs_due_date", weekNumber: null, content: null, journal: null });
      return;
    }

    const weekNumber = weekFromDueDate(pregnancy.dueDate);
    const state = pregnancy.dueDatePrecision === "approximate_month" ? "approximate" : "ok";

    const [week] = await db
      .select()
      .from(journeyWeeksTable)
      .where(eq(journeyWeeksTable.weekNumber, weekNumber));

    const roleContent = week
      ? membership.role === "pregnant_person"
        ? week.pregnantPersonVariant
        : week.supporterVariant
      : null;

    // Only weeks 10-14 are seeded so far. For any other resolved week, fall back
    // to placeholder copy so the screen still has something warm to show.
    const content = week
      ? {
          weekNumber,
          yourBaby: week.sharedBabyDevelopment,
          milestones: week.sharedMilestones ?? null,
          commonExperiences: week.commonExperiences ?? null,
          roleContent: roleContent ?? null,
          isThisCommon: week.isThisCommonContent ?? null,
          role: membership.role,
        }
      : {
          weekNumber,
          yourBaby: `Week ${weekNumber} of your journey. Detailed week-by-week content is on its way — for now, this is a gentle placeholder.`,
          milestones: null,
          commonExperiences: null,
          roleContent: null,
          isThisCommon: null,
          role: membership.role,
        };

    // Journal slot: has this member already published their journal entry this week?
    const [published] = await db
      .select()
      .from(memoriesTable)
      .where(
        and(
          eq(memoriesTable.authorMembershipId, membership.id),
          eq(memoriesTable.pregnancyId, pregnancyId),
          eq(memoriesTable.journeyWeekNumber, weekNumber),
          eq(memoriesTable.sourceType, "journey_prompt"),
        ),
      );

    // Prompts this member has already used across all weeks are excluded from the pool.
    const usedRows = await db
      .select({ promptLibraryItemId: memoriesTable.promptLibraryItemId })
      .from(memoriesTable)
      .where(
        and(
          eq(memoriesTable.authorMembershipId, membership.id),
          eq(memoriesTable.pregnancyId, pregnancyId),
          eq(memoriesTable.sourceType, "journey_prompt"),
        ),
      );
    const usedIds = usedRows
      .map((r) => r.promptLibraryItemId)
      .filter((id): id is number => id != null);

    const poolConditions = [
      or(
        eq(memoryPromptsTable.roleTarget, membership.role),
        eq(memoryPromptsTable.roleTarget, "both"),
      ),
      lte(memoryPromptsTable.eligibleStartWeek, weekNumber),
      gte(memoryPromptsTable.eligibleEndWeek, weekNumber),
    ];
    if (usedIds.length > 0) {
      poolConditions.push(notInArray(memoryPromptsTable.id, usedIds));
    }

    const poolRows = await db
      .select({ id: memoryPromptsTable.id, promptText: memoryPromptsTable.promptText })
      .from(memoryPromptsTable)
      .where(and(...poolConditions))
      .orderBy(asc(memoryPromptsTable.id));

    let memory = null;
    if (published) {
      const [author] = await db
        .select({ displayName: personsTable.displayName })
        .from(membershipsTable)
        .innerJoin(personsTable, eq(membershipsTable.personId, personsTable.id))
        .where(eq(membershipsTable.id, published.authorMembershipId));
      memory = {
        id: published.id,
        pregnancyId: published.pregnancyId,
        authorMembershipId: published.authorMembershipId,
        authorName: author?.displayName ?? "",
        sourceType: published.sourceType,
        text: published.text ?? null,
        photoUrls: published.photoUrls ? (JSON.parse(published.photoUrls) as string[]) : null,
        journeyWeekNumber: published.journeyWeekNumber ?? null,
        promptLibraryItemId: published.promptLibraryItemId ?? null,
        visibility: published.visibility,
        createdAt: published.createdAt,
        updatedAt: published.updatedAt,
      };
    }

    res.json({
      state,
      weekNumber,
      content,
      journal: {
        published: Boolean(published),
        memory,
        defaultPrompt: poolRows[0] ?? null,
        eligiblePrompts: poolRows,
      },
    });
  },
);

export default router;
