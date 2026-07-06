import { SendVerificationCodeBody, VerifyCodeBody } from "@workspace/api-zod";
import { db, membershipsTable, personsTable, phoneVerificationsTable, pregnanciesTable, sessionsTable } from "@workspace/db";
import { and, desc, eq, gt } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";

import { requireAuth } from "../middleware/auth";
import { generateOtp } from "../lib/codes";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// POST /auth/send-code
router.post("/auth/send-code", async (req, res): Promise<void> => {
  const parsed = SendVerificationCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const phone = parsed.data.phone.replace(/\D/g, "");
  if (phone.length < 10) {
    res.status(400).json({ error: "Phone number must be at least 10 digits" });
    return;
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(phoneVerificationsTable).values({ phone, code, expiresAt });

  req.log.info({ phone }, "Verification code generated");

  res.json({ verificationId: randomUUID() });
});

// POST /auth/verify-code
router.post("/auth/verify-code", async (req, res): Promise<void> => {
  const parsed = VerifyCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { phone: rawPhone, code } = parsed.data;
  const phone = rawPhone.replace(/\D/g, "");

  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Code must be exactly 6 digits" });
    return;
  }

  if (process.env.NODE_ENV === "production") {
    const [verification] = await db
      .select()
      .from(phoneVerificationsTable)
      .where(
        and(
          eq(phoneVerificationsTable.phone, phone),
          eq(phoneVerificationsTable.code, code),
          gt(phoneVerificationsTable.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(phoneVerificationsTable.createdAt))
      .limit(1);

    if (!verification || verification.usedAt) {
      res.status(400).json({ error: "Invalid or expired code" });
      return;
    }

    await db
      .update(phoneVerificationsTable)
      .set({ usedAt: new Date() })
      .where(eq(phoneVerificationsTable.id, verification.id));
  }
  // In development any 6-digit code passes — no DB check needed.

  let [person] = await db
    .select()
    .from(personsTable)
    .where(eq(personsTable.phone, phone));

  let isNewUser = false;
  if (!person) {
    [person] = await db
      .insert(personsTable)
      .values({ displayName: "Friend", phone })
      .returning();
    isNewUser = true;
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sessionsTable).values({ personId: person.id, token, expiresAt });

  req.log.info({ personId: person.id, isNewUser }, "Session created");

  res.json({
    token,
    person: {
      id: person.id,
      displayName: person.displayName,
      phone: person.phone,
      email: person.email ?? null,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    },
    isNewUser,
  });
});

// GET /auth/me
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [person] = await db
    .select()
    .from(personsTable)
    .where(eq(personsTable.id, req.personId));

  if (!person) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

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

  res.json({
    person: {
      id: person.id,
      displayName: person.displayName,
      phone: person.phone,
      email: person.email ?? null,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    },
    pregnancies,
  });
});

export default router;
