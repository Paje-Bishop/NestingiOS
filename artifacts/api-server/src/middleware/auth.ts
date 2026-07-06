import { db, sessionsTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

/**
 * Validates the Bearer token in the Authorization header.
 * Attaches `req.personId` on success or returns 401.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = header.slice(7);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.token, token),
        gt(sessionsTable.expiresAt, new Date()),
      ),
    );

  if (!session) {
    res.status(401).json({ error: "Session expired or invalid" });
    return;
  }

  req.personId = session.personId;
  next();
}
