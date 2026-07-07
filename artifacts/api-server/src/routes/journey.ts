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

// How many weeks ahead a member may preview (headline only). Beyond this the
// future stays fully locked so members aren't pulled into content that isn't
// theirs yet (FS-003 Story 4).
const FUTURE_PREVIEW_WEEKS = 2;

// GET /pregnancies/:pregnancyId/journey/week/:weekNumber
// Browse a specific week relative to the resolved current week. Past weeks show
// condensed shared content plus the viewer's own memories and others' public
// memories. Future weeks (within the preview window) show only the "Your Baby"
// headline; everything else stays locked until the week is current.
router.get(
  "/pregnancies/:pregnancyId/journey/week/:weekNumber",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    const requestedWeek = parseInt(req.params.weekNumber as string, 10);
    if (isNaN(pregnancyId)) {
      res.status(400).json({ error: "Invalid pregnancy ID" });
      return;
    }
    if (isNaN(requestedWeek) || requestedWeek < 1 || requestedWeek > 42) {
      res.status(400).json({ error: "Invalid week number" });
      return;
    }

    const [membership] = await db
      .select({ id: membershipsTable.id, role: membershipsTable.role })
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
      res.status(400).json({ error: "Add a due date to browse your weeks" });
      return;
    }

    const currentWeek = weekFromDueDate(pregnancy.dueDate);
    const relation =
      requestedWeek < currentWeek ? "past" : requestedWeek === currentWeek ? "current" : "future";

    // Future beyond the preview window stays fully locked — no content, no memories.
    if (relation === "future" && requestedWeek > currentWeek + FUTURE_PREVIEW_WEEKS) {
      res.json({
        weekNumber: requestedWeek,
        currentWeek,
        relation,
        locked: true,
        content: null,
        memories: [],
      });
      return;
    }

    const [week] = await db
      .select()
      .from(journeyWeeksTable)
      .where(eq(journeyWeeksTable.weekNumber, requestedWeek));

    const placeholderBaby = `Week ${requestedWeek} of your journey. Detailed week-by-week content is on its way — for now, this is a gentle placeholder.`;

    // Future preview: only the shared headline; role content, common experiences,
    // reassurance, and prompts stay locked until the week is current.
    if (relation === "future") {
      res.json({
        weekNumber: requestedWeek,
        currentWeek,
        relation,
        locked: true,
        content: {
          weekNumber: requestedWeek,
          yourBaby: week ? week.sharedBabyDevelopment : placeholderBaby,
          milestones: null,
          commonExperiences: null,
          roleContent: null,
          isThisCommon: null,
          role: membership.role,
        },
        memories: [],
      });
      return;
    }

    // Past weeks are condensed: shared development + milestones only. The current
    // week returns its full role-aware content (the /current endpoint owns the
    // journal composer, so this view stays read-only).
    const roleContent =
      relation === "current" && week
        ? membership.role === "pregnant_person"
          ? week.pregnantPersonVariant
          : week.supporterVariant
        : null;

    const content = week
      ? {
          weekNumber: requestedWeek,
          yourBaby: week.sharedBabyDevelopment,
          milestones: week.sharedMilestones ?? null,
          commonExperiences: relation === "current" ? week.commonExperiences ?? null : null,
          roleContent: roleContent ?? null,
          isThisCommon: relation === "current" ? week.isThisCommonContent ?? null : null,
          role: membership.role,
        }
      : {
          weekNumber: requestedWeek,
          yourBaby: placeholderBaby,
          milestones: null,
          commonExperiences: null,
          roleContent: null,
          isThisCommon: null,
          role: membership.role,
        };

    // Memories for this week: the viewer's own (any visibility) plus other
    // members' public entries. Another member's private memory never appears.
    const rows = await db
      .select({
        id: memoriesTable.id,
        pregnancyId: memoriesTable.pregnancyId,
        authorMembershipId: memoriesTable.authorMembershipId,
        authorName: personsTable.displayName,
        sourceType: memoriesTable.sourceType,
        text: memoriesTable.text,
        photoUrls: memoriesTable.photoUrls,
        journeyWeekNumber: memoriesTable.journeyWeekNumber,
        promptLibraryItemId: memoriesTable.promptLibraryItemId,
        visibility: memoriesTable.visibility,
        createdAt: memoriesTable.createdAt,
        updatedAt: memoriesTable.updatedAt,
      })
      .from(memoriesTable)
      .innerJoin(membershipsTable, eq(memoriesTable.authorMembershipId, membershipsTable.id))
      .innerJoin(personsTable, eq(membershipsTable.personId, personsTable.id))
      .where(
        and(
          eq(memoriesTable.pregnancyId, pregnancyId),
          eq(memoriesTable.journeyWeekNumber, requestedWeek),
          or(
            eq(memoriesTable.authorMembershipId, membership.id),
            eq(memoriesTable.visibility, "public"),
          ),
        ),
      )
      .orderBy(asc(memoriesTable.createdAt));

    const memories = rows.map((r) => ({
      id: r.id,
      pregnancyId: r.pregnancyId,
      authorMembershipId: r.authorMembershipId,
      authorName: r.authorName ?? "",
      sourceType: r.sourceType,
      text: r.text ?? null,
      photoUrls: r.photoUrls ? (JSON.parse(r.photoUrls) as string[]) : null,
      journeyWeekNumber: r.journeyWeekNumber ?? null,
      promptLibraryItemId: r.promptLibraryItemId ?? null,
      visibility: r.visibility,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.json({
      weekNumber: requestedWeek,
      currentWeek,
      relation,
      locked: false,
      content,
      memories,
    });
  },
);

export default router;
