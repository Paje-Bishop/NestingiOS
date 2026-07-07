import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { membershipsTable } from "./memberships";
import { pregnanciesTable } from "./pregnancies";

// Pregnancy-owned preparation task (DM-001 #6). System tasks are seeded/proactively
// surfaced; user-added tasks carry isUserAdded = true permanently (FS-004 Story 5).
// taskType drives which view a task belongs to:
//   "mine_only" — pregnant-person-only work (excluded from a supporter's For You)
//   "assigned"  — assigned to one member (appears in that member's For You)
//   "together"  — shared work, surfaced to everyone
export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  pregnancyId: integer("pregnancy_id")
    .notNull()
    .references(() => pregnanciesTable.id),
  title: text("title").notNull(),
  // "Why now" and "Why it matters" framing (Nest Content Bible, non-clinical)
  whyNow: text("why_now"),
  whyItMatters: text("why_it_matters"),
  // JSON string: Array<{ id: string; label: string; done: boolean }>
  checklist: text("checklist"),
  // Free-text prompts / provider questions shown on the detail view
  prompts: text("prompts"),
  // "mine_only" | "assigned" | "together"
  taskType: text("task_type").notNull(),
  // "not_started" | "in_progress" | "completed"
  status: text("status").notNull().default("not_started"),
  assignedMemberId: integer("assigned_member_id").references(() => membershipsTable.id),
  // Soft due timing — week number the task is oriented around (no hard blocking, MVP)
  dueWeek: integer("due_week"),
  notes: text("notes"),
  isUserAdded: boolean("is_user_added").notNull().default(false),
  relatedSharedDecisionId: integer("related_shared_decision_id"),
  // Manual ordering within a view; lower sorts first
  sortOrder: integer("sort_order").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
