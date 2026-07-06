import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { personsTable } from "./persons";
import { pregnanciesTable } from "./pregnancies";

export const invitationsTable = pgTable("invitations", {
  id: serial("id").primaryKey(),
  pregnancyId: integer("pregnancy_id")
    .notNull()
    .references(() => pregnanciesTable.id),
  createdBy: integer("created_by")
    .notNull()
    .references(() => personsTable.id),
  inviteeName: text("invitee_name").notNull(),
  inviteePhone: text("invitee_phone"),
  // 8-char alphanumeric code embedded in the invite link
  inviteCode: text("invite_code").notNull().unique(),
  // "sent" | "accepted" | "declined"
  status: text("status").notNull().default("sent"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  declinedAt: timestamp("declined_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInvitationSchema = createInsertSchema(invitationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitationsTable.$inferSelect;
