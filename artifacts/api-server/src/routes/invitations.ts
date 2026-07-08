import { AcceptInvitationBody, CreateInvitationBody } from "@workspace/api-zod";
import {
  db,
  familyProfilesTable,
  invitationsTable,
  membershipsTable,
  personsTable,
  pregnanciesTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";

import { requireAuth } from "../middleware/auth";
import { generateCode } from "../lib/codes";

const router: IRouter = Router();

// POST /pregnancies/:pregnancyId/invitations
router.post(
  "/pregnancies/:pregnancyId/invitations",
  requireAuth,
  async (req, res): Promise<void> => {
    const pregnancyId = parseInt(req.params.pregnancyId as string, 10);
    if (isNaN(pregnancyId)) {
      res.status(400).json({ error: "Invalid pregnancy ID" });
      return;
    }

    const parsed = CreateInvitationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const [myMembership] = await db
      .select()
      .from(membershipsTable)
      .where(
        and(
          eq(membershipsTable.pregnancyId, pregnancyId),
          eq(membershipsTable.personId, req.personId),
          eq(membershipsTable.invitationStatus, "active"),
        ),
      );

    if (!myMembership) {
      res.status(403).json({ error: "Not a member of this pregnancy" });
      return;
    }

    const inviteCode = generateCode(8);
    const { inviteeName, inviteePhone } = parsed.data;

    const [invitation] = await db
      .insert(invitationsTable)
      .values({
        pregnancyId,
        createdBy: req.personId,
        inviteeName,
        inviteePhone: inviteePhone ?? null,
        inviteCode,
        status: "sent",
        sentAt: new Date(),
      })
      .returning();

    const domains = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost:80";
    const joinUrl = `https://${domains}/onboarding/join-code?code=${inviteCode}`;

    req.log.info({ invitationId: invitation.id, pregnancyId }, "Invitation created");

    res.status(201).json({
      invitation: {
        id: invitation.id,
        pregnancyId: invitation.pregnancyId,
        inviteeName: invitation.inviteeName,
        inviteePhone: invitation.inviteePhone ?? null,
        inviteCode: invitation.inviteCode,
        status: invitation.status,
        sentAt: invitation.sentAt,
        acceptedAt: invitation.acceptedAt ?? null,
        declinedAt: invitation.declinedAt ?? null,
        createdAt: invitation.createdAt,
      },
      joinUrl,
      joinCode: inviteCode,
    });
  },
);

// GET /invitations/:code
router.get("/invitations/:code", async (req, res): Promise<void> => {
  const code = req.params.code as string;

  const [invitation] = await db
    .select()
    .from(invitationsTable)
    .where(eq(invitationsTable.inviteCode, code));

  if (!invitation || invitation.status === "declined") {
    res.status(404).json({ error: "Invitation not found or no longer valid" });
    return;
  }

  const [pregnancy] = await db
    .select()
    .from(pregnanciesTable)
    .where(eq(pregnanciesTable.id, invitation.pregnancyId));

  const [inviter] = await db
    .select()
    .from(personsTable)
    .where(eq(personsTable.id, invitation.createdBy));

  const [existingPregnantMember] = await db
    .select()
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.pregnancyId, invitation.pregnancyId),
        eq(membershipsTable.role, "pregnant_person"),
        eq(membershipsTable.invitationStatus, "active"),
      ),
    );

  res.json({
    invitation: {
      id: invitation.id,
      pregnancyId: invitation.pregnancyId,
      inviteeName: invitation.inviteeName,
      inviteePhone: invitation.inviteePhone ?? null,
      inviteCode: invitation.inviteCode,
      status: invitation.status,
      sentAt: invitation.sentAt,
      acceptedAt: invitation.acceptedAt ?? null,
      declinedAt: invitation.declinedAt ?? null,
      createdAt: invitation.createdAt,
    },
    pregnancy: {
      id: pregnancy.id,
      name: pregnancy.name,
    },
    inviterName: inviter.displayName,
    existingPregnantPerson: !!existingPregnantMember,
  });
});

// POST /invitations/:code/accept
router.post("/invitations/:code/accept", requireAuth, async (req, res): Promise<void> => {
  const code = req.params.code as string;
  const forceConvert = req.query.forceConvert === "true";

  const parsed = AcceptInvitationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { role } = parsed.data;

  const [invitation] = await db
    .select()
    .from(invitationsTable)
    .where(eq(invitationsTable.inviteCode, code));

  if (!invitation || invitation.status !== "sent") {
    res.status(404).json({ error: "Invitation not found or already used" });
    return;
  }

  const [existing] = await db
    .select()
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.pregnancyId, invitation.pregnancyId),
        eq(membershipsTable.personId, req.personId),
      ),
    );

  if (existing) {
    res.status(400).json({ error: "Already a member of this pregnancy" });
    return;
  }

  let convertedPreviousRole = false;

  if (role === "pregnant_person") {
    const [existingPregnantMember] = await db
      .select()
      .from(membershipsTable)
      .where(
        and(
          eq(membershipsTable.pregnancyId, invitation.pregnancyId),
          eq(membershipsTable.role, "pregnant_person"),
          eq(membershipsTable.invitationStatus, "active"),
        ),
      );

    if (existingPregnantMember) {
      if (!forceConvert) {
        res.status(409).json({
          error:
            "This pregnancy already has a pregnant person. Use ?forceConvert=true to convert them to supporter.",
        });
        return;
      }
      await db
        .update(membershipsTable)
        .set({ role: "supporter" })
        .where(eq(membershipsTable.id, existingPregnantMember.id));
      convertedPreviousRole = true;
    }
  }

  // FS-006 Story 6: seed this new member's notification prefs from the
  // Pregnancy's FamilyProfile.notificationDefaults, once, at join. Existing
  // members are never touched. If no defaults are set, the member starts unset.
  const [familyProfile] = await db
    .select({ notificationDefaults: familyProfilesTable.notificationDefaults })
    .from(familyProfilesTable)
    .where(eq(familyProfilesTable.pregnancyId, invitation.pregnancyId));

  const [membership] = await db
    .insert(membershipsTable)
    .values({
      personId: req.personId,
      pregnancyId: invitation.pregnancyId,
      role,
      invitationStatus: "active",
      notificationPrefs: familyProfile?.notificationDefaults ?? null,
    })
    .returning();

  await db
    .update(invitationsTable)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(invitationsTable.id, invitation.id));

  const [pregnancy] = await db
    .select()
    .from(pregnanciesTable)
    .where(eq(pregnanciesTable.id, invitation.pregnancyId));

  req.log.info(
    { personId: req.personId, pregnancyId: invitation.pregnancyId, role, convertedPreviousRole },
    "Invitation accepted",
  );

  res.json({
    membership: {
      id: membership.id,
      personId: membership.personId,
      pregnancyId: membership.pregnancyId,
      role: membership.role,
      invitationStatus: membership.invitationStatus,
      createdAt: membership.createdAt,
    },
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
    convertedPreviousRole,
  });
});

// POST /invitations/:code/decline
router.post("/invitations/:code/decline", async (req, res): Promise<void> => {
  const code = req.params.code as string;

  const [invitation] = await db
    .select()
    .from(invitationsTable)
    .where(eq(invitationsTable.inviteCode, code));

  if (!invitation) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  await db
    .update(invitationsTable)
    .set({ status: "declined", declinedAt: new Date() })
    .where(eq(invitationsTable.id, invitation.id));

  res.json({ success: true });
});

export default router;
