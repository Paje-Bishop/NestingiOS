import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { membershipsTable } from "./memberships";
import { pregnanciesTable } from "./pregnancies";

// One LaborSession is opened when a Pregnancy transitions active -> in_labor and
// closed by the next lifecycle transition (revert_to_active, complete_pregnancy,
// or end_pregnancy_early). Only one session may be open (endedAt null) per
// Pregnancy at a time — enforced by the lifecycle service inside its transaction.
export const laborSessionsTable = pgTable("labor_sessions", {
  id: serial("id").primaryKey(),
  pregnancyId: integer("pregnancy_id")
    .notNull()
    .references(() => pregnanciesTable.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  startedByMembershipId: integer("started_by_membership_id")
    .notNull()
    .references(() => membershipsTable.id),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  endedByMembershipId: integer("ended_by_membership_id").references(() => membershipsTable.id),
  // Null while open. On close: "false_alarm" | "completed" | "ended_early".
  outcome: text("outcome"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLaborSessionSchema = createInsertSchema(laborSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLaborSession = z.infer<typeof insertLaborSessionSchema>;
export type LaborSession = typeof laborSessionsTable.$inferSelect;
