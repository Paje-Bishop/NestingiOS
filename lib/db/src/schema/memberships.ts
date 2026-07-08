import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { personsTable } from "./persons";
import { pregnanciesTable } from "./pregnancies";

export const membershipsTable = pgTable("memberships", {
  id: serial("id").primaryKey(),
  personId: integer("person_id")
    .notNull()
    .references(() => personsTable.id),
  pregnancyId: integer("pregnancy_id")
    .notNull()
    .references(() => pregnanciesTable.id),
  // "pregnant_person" | "supporter"
  role: text("role").notNull(),
  // "active" | "pending" | "declined" — the invite/join lifecycle.
  invitationStatus: text("invitation_status").notNull().default("active"),
  // Per-member placement/notification state, independent of the invite flow and
  // of Pregnancy.status: "active" | "archived" | "left" | "removed". Archived only
  // moves the pregnancy to the member's Archived switcher section and mutes their
  // notifications; it never changes Pregnancy.status or other members. Only an
  // "active" membership may initiate Pregnancy lifecycle transitions.
  status: text("status").notNull().default("active"),
  // Set when this member archives the pregnancy for themselves; cleared on unarchive.
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  // JSON string: { enabled: boolean, milestones: boolean, reminders: boolean }
  notificationPrefs: text("notification_prefs"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMembershipSchema = createInsertSchema(membershipsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Membership = typeof membershipsTable.$inferSelect;
