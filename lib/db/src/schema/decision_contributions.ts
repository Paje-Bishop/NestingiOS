import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { membershipsTable } from "./memberships";
import { sharedDecisionsTable } from "./shared_decisions";

// Authored contribution to a SharedDecision (DM-001 #15). Contributions are
// chronological and immutable — not editable or deletable by others. Recording a
// contribution makes a member a "contributor", which grants the ability to record
// the final decision and close/reopen (FS-004 Story 4).
export const decisionContributionsTable = pgTable("decision_contributions", {
  id: serial("id").primaryKey(),
  sharedDecisionId: integer("shared_decision_id")
    .notNull()
    .references(() => sharedDecisionsTable.id),
  authorMembershipId: integer("author_membership_id")
    .notNull()
    .references(() => membershipsTable.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecisionContributionSchema = createInsertSchema(decisionContributionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDecisionContribution = z.infer<typeof insertDecisionContributionSchema>;
export type DecisionContribution = typeof decisionContributionsTable.$inferSelect;
