import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { membershipsTable } from "./memberships";
import { pregnanciesTable } from "./pregnancies";

// Append-only audit of every applied Pregnancy lifecycle transition. Recommended
// by the Lifecycle Transition Contract §10 for debugging and safe retries. It is
// NOT the source of truth — Pregnancy.status remains canonical. The partial unique
// index on (pregnancyId, idempotencyKey) is what makes retries idempotent: a
// repeated command with the same key can be detected and short-circuited.
export const pregnancyLifecycleEventsTable = pgTable(
  "pregnancy_lifecycle_events",
  {
    id: serial("id").primaryKey(),
    pregnancyId: integer("pregnancy_id")
      .notNull()
      .references(() => pregnanciesTable.id),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    command: text("command").notNull(),
    initiatedByMembershipId: integer("initiated_by_membership_id")
      .notNull()
      .references(() => membershipsTable.id),
    idempotencyKey: text("idempotency_key"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("pregnancy_lifecycle_events_idempotency_key")
      .on(table.pregnancyId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
  ],
);

export const insertPregnancyLifecycleEventSchema = createInsertSchema(pregnancyLifecycleEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPregnancyLifecycleEvent = z.infer<typeof insertPregnancyLifecycleEventSchema>;
export type PregnancyLifecycleEvent = typeof pregnancyLifecycleEventsTable.$inferSelect;
