import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Global product content (DM-001 #5). One row per pregnancy week, reused across
// every Pregnancy. Role-specific framing lives in the *Variant fields; shared
// development facts are identical for all roles. Per FS-003 (2026-07-01) the weekly
// journal prompt is resolved from the memory_prompts pool at render time, so there
// is intentionally no fixed memoryPrompt column here.
export const journeyWeeksTable = pgTable("journey_weeks", {
  id: serial("id").primaryKey(),
  weekNumber: integer("week_number").notNull().unique(),
  // "Your Baby" — shared, identical for all roles
  sharedBabyDevelopment: text("shared_baby_development").notNull(),
  // Shown only in weeks with a meaningful milestone
  sharedMilestones: text("shared_milestones"),
  // Role-specific framing of Common Experiences
  pregnantPersonVariant: text("pregnant_person_variant"),
  supporterVariant: text("supporter_variant"),
  commonExperiences: text("common_experiences"),
  // "Is This Common?" — reassurance, uses "common" not "normal", never diagnoses
  isThisCommonContent: text("is_this_common_content"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertJourneyWeekSchema = createInsertSchema(journeyWeeksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJourneyWeek = z.infer<typeof insertJourneyWeekSchema>;
export type JourneyWeek = typeof journeyWeeksTable.$inferSelect;
