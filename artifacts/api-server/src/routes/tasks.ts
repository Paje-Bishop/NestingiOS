import { CreateTaskBody, UpdateTaskBody } from "@workspace/api-zod";
import { db, membershipsTable, personsTable, tasksTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

interface TaskRow {
  id: number;
  pregnancyId: number;
  title: string;
  whyNow: string | null;
  whyItMatters: string | null;
  checklist: string | null;
  prompts: string | null;
  taskType: string;
  status: string;
  assignedMemberId: number | null;
  dueWeek: number | null;
  notes: string | null;
  isUserAdded: boolean;
  relatedSharedDecisionId: number | null;
  sortOrder: number;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

function shapeTask(row: TaskRow, assigneeNames: Map<number, string>) {
  return {
    id: row.id,
    pregnancyId: row.pregnancyId,
    title: row.title,
    whyNow: row.whyNow ?? null,
    whyItMatters: row.whyItMatters ?? null,
    checklist: row.checklist ? (JSON.parse(row.checklist) as ChecklistItem[]) : null,
    prompts: row.prompts ?? null,
    taskType: row.taskType,
    status: row.status,
    assignedMemberId: row.assignedMemberId ?? null,
    assignedMemberName: row.assignedMemberId ? assigneeNames.get(row.assignedMemberId) ?? null : null,
    dueWeek: row.dueWeek ?? null,
    notes: row.notes ?? null,
    isUserAdded: row.isUserAdded,
    relatedSharedDecisionId: row.relatedSharedDecisionId ?? null,
    sortOrder: row.sortOrder,
    completedAt: row.completedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Loads the viewer's active membership plus every active member of the pregnancy
// (used for assignee-name resolution and the "hasPregnantPerson" view rule).
async function loadMembers(pregnancyId: number, personId: number) {
  const members = await db
    .select({
      membershipId: membershipsTable.id,
      personName: personsTable.displayName,
      role: membershipsTable.role,
      personId: membershipsTable.personId,
    })
    .from(membershipsTable)
    .innerJoin(personsTable, eq(membershipsTable.personId, personsTable.id))
    .where(
      and(
        eq(membershipsTable.pregnancyId, pregnancyId),
        eq(membershipsTable.invitationStatus, "active"),
      ),
    );

  const viewer = members.find((m) => m.personId === personId) ?? null;
  const names = new Map(members.map((m) => [m.membershipId, m.personName]));
  return { members, viewer, names };
}

// GET /pregnancies/:pregnancyId/tasks
router.get(
  "/pregnancies/:pregnancyId/tasks",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    if (isNaN(pregnancyId)) {
      res.status(400).json({ error: "Invalid pregnancy ID" });
      return;
    }

    const { members, viewer, names } = await loadMembers(pregnancyId, req.personId);
    if (!viewer) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    const rows = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.pregnancyId, pregnancyId))
      .orderBy(asc(tasksTable.sortOrder), asc(tasksTable.id));

    res.json({
      viewerMembershipId: viewer.membershipId,
      viewerRole: viewer.role,
      hasPregnantPerson: members.some((m) => m.role === "pregnant_person"),
      members: members.map((m) => ({
        membershipId: m.membershipId,
        personName: m.personName,
        role: m.role,
      })),
      tasks: rows.map((r) => shapeTask(r, names)),
    });
  },
);

// POST /pregnancies/:pregnancyId/tasks — user-added task (isUserAdded always true)
router.post(
  "/pregnancies/:pregnancyId/tasks",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    if (isNaN(pregnancyId)) {
      res.status(400).json({ error: "Invalid pregnancy ID" });
      return;
    }

    const parsed = CreateTaskBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const body = parsed.data;

    const { members, viewer, names } = await loadMembers(pregnancyId, req.personId);
    if (!viewer) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    // An assignee, if given, must be an active member of this pregnancy.
    if (body.assignedMemberId != null && !names.has(body.assignedMemberId)) {
      res.status(400).json({ error: "Assignee is not an active member" });
      return;
    }

    const [created] = await db
      .insert(tasksTable)
      .values({
        pregnancyId,
        title: body.title,
        whyNow: body.whyNow ?? null,
        whyItMatters: body.whyItMatters ?? null,
        checklist: body.checklist ? JSON.stringify(body.checklist) : null,
        taskType: body.taskType ?? "together",
        status: "not_started",
        assignedMemberId: body.assignedMemberId ?? null,
        dueWeek: body.dueWeek ?? null,
        notes: body.notes ?? null,
        isUserAdded: true,
      })
      .returning();

    req.log.info(
      { taskId: created.id, pregnancyId, membershipId: viewer.membershipId },
      "User task created",
    );

    res.status(201).json(shapeTask(created, names));
  },
);

// GET /pregnancies/:pregnancyId/tasks/:taskId
router.get(
  "/pregnancies/:pregnancyId/tasks/:taskId",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    const taskId = parseInt(req.params.taskId as string, 10);
    if (isNaN(pregnancyId) || isNaN(taskId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const { viewer, names } = await loadMembers(pregnancyId, req.personId);
    if (!viewer) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    const [task] = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.id, taskId), eq(tasksTable.pregnancyId, pregnancyId)));

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json(shapeTask(task, names));
  },
);

// PATCH /pregnancies/:pregnancyId/tasks/:taskId — checklist / status / notes / reassign
router.patch(
  "/pregnancies/:pregnancyId/tasks/:taskId",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    const taskId = parseInt(req.params.taskId as string, 10);
    if (isNaN(pregnancyId) || isNaN(taskId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const parsed = UpdateTaskBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const body = parsed.data;

    const { viewer, names } = await loadMembers(pregnancyId, req.personId);
    if (!viewer) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    const [existing] = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.id, taskId), eq(tasksTable.pregnancyId, pregnancyId)));

    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Reassignment target must be an active member (null unassigns).
    if (body.assignedMemberId != null && !names.has(body.assignedMemberId)) {
      res.status(400).json({ error: "Assignee is not an active member" });
      return;
    }

    const updates: Partial<typeof tasksTable.$inferInsert> = {};
    if (body.checklist !== undefined) updates.checklist = JSON.stringify(body.checklist);
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.assignedMemberId !== undefined) updates.assignedMemberId = body.assignedMemberId;
    if (body.status !== undefined) {
      updates.status = body.status;
      // Explicit binary completion is allowed even with an incomplete checklist.
      updates.completedAt = body.status === "completed" ? new Date() : null;
    }

    const [updated] = await db
      .update(tasksTable)
      .set(updates)
      .where(and(eq(tasksTable.id, taskId), eq(tasksTable.pregnancyId, pregnancyId)))
      .returning();

    // Reassignment preserves notes/checklist/history — only the assignee changes.
    // ADR-007 "Task Reassigned" notification is a no-op until the notifications
    // subsystem lands (tracked as a gap, not built in FS-004).
    req.log.info(
      { taskId, pregnancyId, membershipId: viewer.membershipId, status: updated.status },
      "Task updated",
    );

    res.json(shapeTask(updated, names));
  },
);

export default router;
