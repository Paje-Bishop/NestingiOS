import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { membershipsTable } from "./memberships";
import { pregnanciesTable } from "./pregnancies";

// Pregnancy-owned shared decision (DM-001 #7). A decision gathers authored
// DecisionContribution records (never a free-text notes field). New decisions
// default Public. Any contributor may record the final decision + rationale to
// close it; reopening preserves history. Closed decisions surface in
// Memories → Decisions We Made; Public + Closed are eligible for Our Journey.
export const sharedDecisionsTable = pgTable("shared_decisions", {
  id: serial("id").primaryKey(),
  pregnancyId: integer("pregnancy_id")
    .notNull()
    .references(() => pregnanciesTable.id),
  title: text("title").notNull(),
  // Framing prompt for the decision
  prompt: text("prompt"),
  // "open" | "decision_recorded" | "closed"
  status: text("status").notNull().default("open"),
  // "public" | "private" (Public = visible within the Pregnancy)
  visibility: text("visibility").notNull().default("public"),
  finalDecision: text("final_decision"),
  finalRationale: text("final_rationale"),
  closedByMembershipId: integer("closed_by_membership_id").references(() => membershipsTable.id),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  relatedTaskId: integer("related_task_id"),
  createdByMembershipId: integer("created_by_membership_id")
    .notNull()
    .references(() => membershipsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSharedDecisionSchema = createInsertSchema(sharedDecisionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSharedDecision = z.infer<typeof insertSharedDecisionSchema>;
export type SharedDecision = typeof sharedDecisionsTable.$inferSelect;
