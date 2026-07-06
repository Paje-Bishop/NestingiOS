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
  // "active" | "pending" | "declined"
  invitationStatus: text("invitation_status").notNull().default("active"),
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
