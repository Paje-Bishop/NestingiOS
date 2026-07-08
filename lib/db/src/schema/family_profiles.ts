import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { pregnanciesTable } from "./pregnancies";

// Pregnancy-owned personalization profile (DM-001 #13, FS-006). One per
// Pregnancy, shared by its members. Every preference is nullable — a null field
// means "unset", never a default answer, so the UI can drip-prompt for it. No
// field is required for core app use. Updates affect future recommendations
// only; historical data (purchases, status) is never rewritten.
export const familyProfilesTable = pgTable("family_profiles", {
  id: serial("id").primaryKey(),
  pregnancyId: integer("pregnancy_id")
    .notNull()
    .unique()
    .references(() => pregnanciesTable.id),
  // "breastfeeding" | "formula" | "combination" | "undecided" | "prefer_not_to_say"
  feedingPreference: text("feeding_preference"),
  // "house" | "apartment" | "other"
  homeType: text("home_type"),
  // The more actionable home signal (compact gear); null = unset, not false.
  limitedSpace: boolean("limited_space"),
  // Single overall budget goal in whole currency units. Category sub-goals are
  // deferred for MVP (owner-confirmed 2026-07-07). null = unset.
  budgetGoal: integer("budget_goal"),
  // Pregnancy-level notification defaults that seed a new Membership's prefs once
  // at join (FS-006 Story 6). Distinct from Membership.notificationPrefs (the
  // per-member live settings). JSON string mirroring that shape:
  // { enabled: boolean, milestones: boolean, reminders: boolean }
  notificationDefaults: text("notification_defaults"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertFamilyProfileSchema = createInsertSchema(familyProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFamilyProfile = z.infer<typeof insertFamilyProfileSchema>;
export type FamilyProfile = typeof familyProfilesTable.$inferSelect;
