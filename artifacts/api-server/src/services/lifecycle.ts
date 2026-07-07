import {
  db,
  laborSessionsTable,
  memoriesTable,
  pregnanciesTable,
  pregnancyLifecycleEventsTable,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

// Canonical lifecycle model — see the Lifecycle Transition Contract (MVP).
export type LifecycleCommand =
  | "set_in_labor"
  | "revert_to_active"
  | "complete_pregnancy"
  | "end_pregnancy_early";

export type PregnancyStatus = "active" | "in_labor" | "completed" | "ended_early";

const ALLOWED_FROM: Record<LifecycleCommand, PregnancyStatus[]> = {
  set_in_labor: ["active"],
  revert_to_active: ["in_labor"],
  complete_pregnancy: ["active", "in_labor"],
  end_pregnancy_early: ["active", "in_labor"],
};

const TARGET_STATUS: Record<LifecycleCommand, PregnancyStatus> = {
  set_in_labor: "in_labor",
  revert_to_active: "active",
  complete_pregnancy: "completed",
  end_pregnancy_early: "ended_early",
};

export interface LifecycleInput {
  pregnancyId: number;
  membershipId: number;
  command: LifecycleCommand;
  idempotencyKey?: string | null;
  // complete_pregnancy
  birthDate?: string | null;
  birthTime?: string | null;
  birthTimeZone?: string | null;
  babyName?: string | null;
  firstMemoryText?: string | null;
  firstMemoryVisibility?: "public" | "private" | null;
  // end_pregnancy_early
  confirmation?: boolean;
}

interface LaborSessionRef {
  id: number;
  outcome: string | null;
  endedAt: Date | null;
}

export type LifecycleResult =
  | {
      ok: true;
      applied: boolean;
      from: PregnancyStatus;
      to: PregnancyStatus;
      pregnancy: typeof pregnanciesTable.$inferSelect;
      laborSession: LaborSessionRef | null;
      memoryId: number | null;
    }
  | {
      ok: false;
      httpStatus: number;
      code: string;
      error: string;
      currentStatus?: PregnancyStatus;
    };

// FS-008 side effects. There is no notifications subsystem yet, so these are
// documented no-ops (mirrors the ADR-007 pattern already used in tasks). When the
// scheduler lands, cancel/suppress here — inside the same transaction — so a
// lifecycle transition and its notification side effects commit atomically.
function suppressNonLaborNotifications(_pregnancyId: number): void {
  // no-op until FS-008 notifications exist
}
function cancelScheduledNotifications(_pregnancyId: number): void {
  // no-op until FS-008 notifications exist
}

export async function applyLifecycleTransition(input: LifecycleInput): Promise<LifecycleResult> {
  const { pregnancyId, membershipId, command } = input;
  const target = TARGET_STATUS[command];

  // Fast idempotency path: a prior application under the same key returns its
  // recorded result without re-running side effects.
  if (input.idempotencyKey) {
    const [prior] = await db
      .select()
      .from(pregnancyLifecycleEventsTable)
      .where(
        and(
          eq(pregnancyLifecycleEventsTable.pregnancyId, pregnancyId),
          eq(pregnancyLifecycleEventsTable.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (prior) {
      const [pregnancy] = await db
        .select()
        .from(pregnanciesTable)
        .where(eq(pregnanciesTable.id, pregnancyId));
      return {
        ok: true,
        applied: false,
        from: prior.fromStatus as PregnancyStatus,
        to: prior.toStatus as PregnancyStatus,
        pregnancy,
        laborSession: null,
        memoryId: null,
      };
    }
  }

  try {
    return await db.transaction(async (tx) => {
      // Lock the Pregnancy row so two racing transitions can't both apply.
      const [pregnancy] = await tx
        .select()
        .from(pregnanciesTable)
        .where(eq(pregnanciesTable.id, pregnancyId))
        .for("update");

      if (!pregnancy) {
        return { ok: false as const, httpStatus: 404, code: "NOT_FOUND", error: "Pregnancy not found" };
      }

      const current = pregnancy.status as PregnancyStatus;

      // Same-state request is idempotent: return current state, no new side effects.
      if (current === target) {
        let session: LaborSessionRef | null = null;
        if (current === "in_labor") {
          const [open] = await tx
            .select({ id: laborSessionsTable.id, outcome: laborSessionsTable.outcome, endedAt: laborSessionsTable.endedAt })
            .from(laborSessionsTable)
            .where(and(eq(laborSessionsTable.pregnancyId, pregnancyId), isNull(laborSessionsTable.endedAt)));
          session = open ?? null;
        }
        return {
          ok: true as const,
          applied: false,
          from: current,
          to: target,
          pregnancy,
          laborSession: session,
          memoryId: null,
        };
      }

      if (!ALLOWED_FROM[command].includes(current)) {
        return {
          ok: false as const,
          httpStatus: 409,
          code: "PREGNANCY_STATUS_CONFLICT",
          error: `Cannot ${command} from ${current}`,
          currentStatus: current,
        };
      }

      // Per-command validation.
      if (command === "complete_pregnancy" && !input.birthDate) {
        return { ok: false as const, httpStatus: 422, code: "BIRTH_DATE_REQUIRED", error: "birthDate is required" };
      }
      if (command === "end_pregnancy_early" && input.confirmation !== true) {
        return { ok: false as const, httpStatus: 422, code: "CONFIRMATION_REQUIRED", error: "confirmation must be true" };
      }

      const now = new Date();
      let laborSession: LaborSessionRef | null = null;
      let memoryId: number | null = null;

      const updates: Partial<typeof pregnanciesTable.$inferInsert> = { status: target };

      if (command === "set_in_labor") {
        const [created] = await tx
          .insert(laborSessionsTable)
          .values({ pregnancyId, startedAt: now, startedByMembershipId: membershipId })
          .returning({ id: laborSessionsTable.id, outcome: laborSessionsTable.outcome, endedAt: laborSessionsTable.endedAt });
        laborSession = created;
        suppressNonLaborNotifications(pregnancyId);
      } else if (command === "revert_to_active") {
        laborSession = await closeOpenSession(tx, pregnancyId, membershipId, "false_alarm", now);
      } else if (command === "complete_pregnancy") {
        updates.birthDate = input.birthDate;
        if (input.birthTime != null) updates.birthTime = input.birthTime;
        if (input.birthTimeZone != null) updates.birthTimeZone = input.birthTimeZone;
        if (input.babyName != null) updates.babyName = input.babyName;
        if (current === "in_labor") {
          laborSession = await closeOpenSession(tx, pregnancyId, membershipId, "completed", now);
        }
        if (input.firstMemoryText && input.firstMemoryText.trim().length > 0) {
          const [memory] = await tx
            .insert(memoriesTable)
            .values({
              pregnancyId,
              authorMembershipId: membershipId,
              sourceType: "birth_flow",
              text: input.firstMemoryText,
              visibility: input.firstMemoryVisibility ?? "private",
            })
            .returning({ id: memoriesTable.id });
          memoryId = memory.id;
        }
        cancelScheduledNotifications(pregnancyId);
      } else if (command === "end_pregnancy_early") {
        if (current === "in_labor") {
          laborSession = await closeOpenSession(tx, pregnancyId, membershipId, "ended_early", now);
        }
        cancelScheduledNotifications(pregnancyId);
      }

      const [updated] = await tx
        .update(pregnanciesTable)
        .set(updates)
        .where(eq(pregnanciesTable.id, pregnancyId))
        .returning();

      await tx.insert(pregnancyLifecycleEventsTable).values({
        pregnancyId,
        fromStatus: current,
        toStatus: target,
        command,
        initiatedByMembershipId: membershipId,
        idempotencyKey: input.idempotencyKey ?? null,
        metadata: memoryId != null ? { birthFlowMemoryId: memoryId } : null,
      });

      return {
        ok: true as const,
        applied: true,
        from: current,
        to: target,
        pregnancy: updated,
        laborSession,
        memoryId,
      };
    });
  } catch (err) {
    // Race on the same idempotency key: the unique index rejects the second
    // writer. Treat as an idempotent success and return the now-committed state.
    const pgCode =
      (err as { code?: string })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
    if (pgCode === "23505" && input.idempotencyKey) {
      const [pregnancy] = await db
        .select()
        .from(pregnanciesTable)
        .where(eq(pregnanciesTable.id, pregnancyId));
      return {
        ok: true,
        applied: false,
        from: pregnancy.status as PregnancyStatus,
        to: target,
        pregnancy,
        laborSession: null,
        memoryId: null,
      };
    }
    throw err;
  }
}

async function closeOpenSession(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  pregnancyId: number,
  membershipId: number,
  outcome: "false_alarm" | "completed" | "ended_early",
  now: Date,
): Promise<LaborSessionRef | null> {
  const [closed] = await tx
    .update(laborSessionsTable)
    .set({ endedAt: now, endedByMembershipId: membershipId, outcome })
    .where(and(eq(laborSessionsTable.pregnancyId, pregnancyId), isNull(laborSessionsTable.endedAt)))
    .returning({ id: laborSessionsTable.id, outcome: laborSessionsTable.outcome, endedAt: laborSessionsTable.endedAt });
  return closed ?? null;
}
