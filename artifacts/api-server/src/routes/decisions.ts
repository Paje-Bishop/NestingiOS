import {
  AddContributionBody,
  CloseDecisionBody,
  CreateDecisionBody,
  UpdateDecisionVisibilityBody,
} from "@workspace/api-zod";
import {
  db,
  decisionContributionsTable,
  membershipsTable,
  personsTable,
  sharedDecisionsTable,
} from "@workspace/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

interface DecisionRow {
  id: number;
  pregnancyId: number;
  title: string;
  prompt: string | null;
  status: string;
  visibility: string;
  finalDecision: string | null;
  finalRationale: string | null;
  closedByMembershipId: number | null;
  closedAt: Date | null;
  relatedTaskId: number | null;
  createdByMembershipId: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ContributionShape {
  id: number;
  sharedDecisionId: number;
  authorMembershipId: number;
  authorName: string;
  body: string;
  createdAt: Date;
}

function shapeDecision(
  row: DecisionRow,
  viewerMembershipId: number,
  contributions: ContributionShape[],
) {
  return {
    id: row.id,
    pregnancyId: row.pregnancyId,
    title: row.title,
    prompt: row.prompt ?? null,
    status: row.status,
    visibility: row.visibility,
    finalDecision: row.finalDecision ?? null,
    finalRationale: row.finalRationale ?? null,
    closedByMembershipId: row.closedByMembershipId ?? null,
    closedAt: row.closedAt ?? null,
    relatedTaskId: row.relatedTaskId ?? null,
    createdByMembershipId: row.createdByMembershipId,
    contributionCount: contributions.length,
    viewerIsContributor: contributions.some((c) => c.authorMembershipId === viewerMembershipId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    contributions,
  };
}

async function loadViewer(pregnancyId: number, personId: number) {
  const [viewer] = await db
    .select({ membershipId: membershipsTable.id, role: membershipsTable.role })
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.pregnancyId, pregnancyId),
        eq(membershipsTable.personId, personId),
        eq(membershipsTable.invitationStatus, "active"),
      ),
    );
  return viewer ?? null;
}

// Of the given decision ids, returns the set the viewer has contributed to.
async function viewerContributedDecisionIds(
  decisionIds: number[],
  membershipId: number,
): Promise<Set<number>> {
  if (decisionIds.length === 0) return new Set();
  const rows = await db
    .select({ sharedDecisionId: decisionContributionsTable.sharedDecisionId })
    .from(decisionContributionsTable)
    .where(
      and(
        inArray(decisionContributionsTable.sharedDecisionId, decisionIds),
        eq(decisionContributionsTable.authorMembershipId, membershipId),
      ),
    );
  return new Set(rows.map((r) => r.sharedDecisionId));
}

// Fetches every contribution for the given decision ids, shaped with author name,
// chronological — returns a map of decisionId -> contributions.
async function loadContributions(decisionIds: number[]): Promise<Map<number, ContributionShape[]>> {
  const byDecision = new Map<number, ContributionShape[]>();
  if (decisionIds.length === 0) return byDecision;

  const rows = await db
    .select({
      contribution: decisionContributionsTable,
      authorName: personsTable.displayName,
    })
    .from(decisionContributionsTable)
    .innerJoin(membershipsTable, eq(decisionContributionsTable.authorMembershipId, membershipsTable.id))
    .innerJoin(personsTable, eq(membershipsTable.personId, personsTable.id))
    .where(inArray(decisionContributionsTable.sharedDecisionId, decisionIds))
    .orderBy(asc(decisionContributionsTable.createdAt), asc(decisionContributionsTable.id));

  for (const r of rows) {
    const shaped: ContributionShape = {
      id: r.contribution.id,
      sharedDecisionId: r.contribution.sharedDecisionId,
      authorMembershipId: r.contribution.authorMembershipId,
      authorName: r.authorName,
      body: r.contribution.body,
      createdAt: r.contribution.createdAt,
    };
    const list = byDecision.get(shaped.sharedDecisionId) ?? [];
    list.push(shaped);
    byDecision.set(shaped.sharedDecisionId, list);
  }
  return byDecision;
}

// GET /pregnancies/:pregnancyId/decisions
router.get(
  "/pregnancies/:pregnancyId/decisions",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    if (isNaN(pregnancyId)) {
      res.status(400).json({ error: "Invalid pregnancy ID" });
      return;
    }

    const viewer = await loadViewer(pregnancyId, req.personId);
    if (!viewer) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    const all = await db
      .select()
      .from(sharedDecisionsTable)
      .where(eq(sharedDecisionsTable.pregnancyId, pregnancyId))
      .orderBy(asc(sharedDecisionsTable.createdAt));

    // Public decisions are visible to everyone in the pregnancy; a private one is
    // visible to its creator and to any member who has contributed to it.
    const privateIds = all.filter((d) => d.visibility === "private").map((d) => d.id);
    const contributedIds = await viewerContributedDecisionIds(privateIds, viewer.membershipId);
    const visible = all.filter(
      (d) =>
        d.visibility === "public" ||
        d.createdByMembershipId === viewer.membershipId ||
        contributedIds.has(d.id),
    );
    const contributions = await loadContributions(visible.map((d) => d.id));

    res.json(
      visible.map((d) => shapeDecision(d, viewer.membershipId, contributions.get(d.id) ?? [])),
    );
  },
);

// POST /pregnancies/:pregnancyId/decisions — open a new decision (defaults Public)
router.post(
  "/pregnancies/:pregnancyId/decisions",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    if (isNaN(pregnancyId)) {
      res.status(400).json({ error: "Invalid pregnancy ID" });
      return;
    }

    const parsed = CreateDecisionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const body = parsed.data;

    const viewer = await loadViewer(pregnancyId, req.personId);
    if (!viewer) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    const [created] = await db
      .insert(sharedDecisionsTable)
      .values({
        pregnancyId,
        title: body.title,
        prompt: body.prompt ?? null,
        status: "open",
        visibility: body.visibility ?? "public",
        relatedTaskId: body.relatedTaskId ?? null,
        createdByMembershipId: viewer.membershipId,
      })
      .returning();

    req.log.info(
      { decisionId: created.id, pregnancyId, membershipId: viewer.membershipId },
      "Shared decision created",
    );

    res.status(201).json(shapeDecision(created, viewer.membershipId, []));
  },
);

// Loads a decision scoped to the pregnancy and enforces private-visibility.
// A private decision is visible to its creator and to any member who has
// contributed to it (owner rule 2026-07-07) — not creator-only.
async function loadVisibleDecision(
  pregnancyId: number,
  decisionId: number,
  viewerMembershipId: number,
): Promise<{ decision: DecisionRow | null; forbidden: boolean }> {
  const [decision] = await db
    .select()
    .from(sharedDecisionsTable)
    .where(
      and(eq(sharedDecisionsTable.id, decisionId), eq(sharedDecisionsTable.pregnancyId, pregnancyId)),
    );
  if (!decision) return { decision: null, forbidden: false };
  if (decision.visibility === "private" && decision.createdByMembershipId !== viewerMembershipId) {
    if (!(await viewerIsContributor(decisionId, viewerMembershipId))) {
      return { decision: null, forbidden: true };
    }
  }
  return { decision, forbidden: false };
}

// GET /pregnancies/:pregnancyId/decisions/:decisionId
router.get(
  "/pregnancies/:pregnancyId/decisions/:decisionId",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    const decisionId = parseInt(req.params.decisionId as string, 10);
    if (isNaN(pregnancyId) || isNaN(decisionId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const viewer = await loadViewer(pregnancyId, req.personId);
    if (!viewer) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    const { decision, forbidden } = await loadVisibleDecision(pregnancyId, decisionId, viewer.membershipId);
    if (forbidden) {
      res.status(403).json({ error: "Not visible to this member" });
      return;
    }
    if (!decision) {
      res.status(404).json({ error: "Decision not found" });
      return;
    }

    const contributions = await loadContributions([decisionId]);
    res.json(shapeDecision(decision, viewer.membershipId, contributions.get(decisionId) ?? []));
  },
);

// PATCH /pregnancies/:pregnancyId/decisions/:decisionId — change visibility.
// Any active member who can see the decision may flip it public<->private
// (owner rule 2026-07-07); it is not restricted to the creator.
router.patch(
  "/pregnancies/:pregnancyId/decisions/:decisionId",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    const decisionId = parseInt(req.params.decisionId as string, 10);
    if (isNaN(pregnancyId) || isNaN(decisionId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const parsed = UpdateDecisionVisibilityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const viewer = await loadViewer(pregnancyId, req.personId);
    if (!viewer) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    const { decision, forbidden } = await loadVisibleDecision(pregnancyId, decisionId, viewer.membershipId);
    if (forbidden) {
      res.status(403).json({ error: "Not visible to this member" });
      return;
    }
    if (!decision) {
      res.status(404).json({ error: "Decision not found" });
      return;
    }

    const [updated] = await db
      .update(sharedDecisionsTable)
      .set({ visibility: parsed.data.visibility, updatedAt: new Date() })
      .where(eq(sharedDecisionsTable.id, decisionId))
      .returning();

    req.log.info(
      { decisionId, pregnancyId, membershipId: viewer.membershipId, visibility: parsed.data.visibility },
      "Shared decision visibility changed",
    );

    const contributions = await loadContributions([decisionId]);
    res.json(shapeDecision(updated, viewer.membershipId, contributions.get(decisionId) ?? []));
  },
);

// POST /pregnancies/:pregnancyId/decisions/:decisionId/contributions
router.post(
  "/pregnancies/:pregnancyId/decisions/:decisionId/contributions",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    const decisionId = parseInt(req.params.decisionId as string, 10);
    if (isNaN(pregnancyId) || isNaN(decisionId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const parsed = AddContributionBody.safeParse(req.body);
    if (!parsed.success || parsed.data.body.trim().length === 0) {
      res.status(400).json({ error: "A contribution needs some text" });
      return;
    }

    const viewer = await loadViewer(pregnancyId, req.personId);
    if (!viewer) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    const { decision, forbidden } = await loadVisibleDecision(pregnancyId, decisionId, viewer.membershipId);
    if (forbidden) {
      res.status(403).json({ error: "Not visible to this member" });
      return;
    }
    if (!decision) {
      res.status(404).json({ error: "Decision not found" });
      return;
    }

    await db.insert(decisionContributionsTable).values({
      sharedDecisionId: decisionId,
      authorMembershipId: viewer.membershipId,
      body: parsed.data.body,
    });

    // Touch the decision so updatedAt reflects the new activity.
    const [updated] = await db
      .update(sharedDecisionsTable)
      .set({ updatedAt: new Date() })
      .where(eq(sharedDecisionsTable.id, decisionId))
      .returning();

    const contributions = await loadContributions([decisionId]);
    res.status(201).json(shapeDecision(updated, viewer.membershipId, contributions.get(decisionId) ?? []));
  },
);

// Only a member who has authored at least one contribution may close/reopen.
async function viewerIsContributor(decisionId: number, membershipId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: decisionContributionsTable.id })
    .from(decisionContributionsTable)
    .where(
      and(
        eq(decisionContributionsTable.sharedDecisionId, decisionId),
        eq(decisionContributionsTable.authorMembershipId, membershipId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

// POST /pregnancies/:pregnancyId/decisions/:decisionId/close
router.post(
  "/pregnancies/:pregnancyId/decisions/:decisionId/close",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    const decisionId = parseInt(req.params.decisionId as string, 10);
    if (isNaN(pregnancyId) || isNaN(decisionId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const parsed = CloseDecisionBody.safeParse(req.body);
    if (!parsed.success || parsed.data.finalDecision.trim().length === 0) {
      res.status(400).json({ error: "A final decision is required" });
      return;
    }

    const viewer = await loadViewer(pregnancyId, req.personId);
    if (!viewer) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    const { decision, forbidden } = await loadVisibleDecision(pregnancyId, decisionId, viewer.membershipId);
    if (forbidden) {
      res.status(403).json({ error: "Not visible to this member" });
      return;
    }
    if (!decision) {
      res.status(404).json({ error: "Decision not found" });
      return;
    }

    if (!(await viewerIsContributor(decisionId, viewer.membershipId))) {
      res.status(403).json({ error: "Only a contributor can close this decision" });
      return;
    }

    const [updated] = await db
      .update(sharedDecisionsTable)
      .set({
        status: "closed",
        finalDecision: parsed.data.finalDecision,
        finalRationale: parsed.data.finalRationale ?? null,
        closedByMembershipId: viewer.membershipId,
        closedAt: new Date(),
      })
      .where(eq(sharedDecisionsTable.id, decisionId))
      .returning();

    const contributions = await loadContributions([decisionId]);
    res.json(shapeDecision(updated, viewer.membershipId, contributions.get(decisionId) ?? []));
  },
);

// POST /pregnancies/:pregnancyId/decisions/:decisionId/reopen — history preserved
router.post(
  "/pregnancies/:pregnancyId/decisions/:decisionId/reopen",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    const decisionId = parseInt(req.params.decisionId as string, 10);
    if (isNaN(pregnancyId) || isNaN(decisionId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const viewer = await loadViewer(pregnancyId, req.personId);
    if (!viewer) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    const { decision, forbidden } = await loadVisibleDecision(pregnancyId, decisionId, viewer.membershipId);
    if (forbidden) {
      res.status(403).json({ error: "Not visible to this member" });
      return;
    }
    if (!decision) {
      res.status(404).json({ error: "Decision not found" });
      return;
    }

    if (!(await viewerIsContributor(decisionId, viewer.membershipId))) {
      res.status(403).json({ error: "Only a contributor can reopen this decision" });
      return;
    }

    // Reopening clears the recorded outcome but preserves all contributions.
    const [updated] = await db
      .update(sharedDecisionsTable)
      .set({
        status: "open",
        finalDecision: null,
        finalRationale: null,
        closedByMembershipId: null,
        closedAt: null,
      })
      .where(eq(sharedDecisionsTable.id, decisionId))
      .returning();

    const contributions = await loadContributions([decisionId]);
    res.json(shapeDecision(updated, viewer.membershipId, contributions.get(decisionId) ?? []));
  },
);

export default router;
