import { sql } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { membershipsTable } from "./memberships";
import { memoryPromptsTable } from "./memory_prompts";
import { pregnanciesTable } from "./pregnancies";

// Pregnancy-owned member contribution (DM-001 #12). Journey journal entries
// (sourceType = "journey_prompt") and standalone photos (sourceType = "manual")
// are the two Journey producers. A Memory requires text, at least one photo, or
// both (enforced in the API layer).
export const memoriesTable = pgTable(
  "memories",
  {
    id: serial("id").primaryKey(),
    pregnancyId: integer("pregnancy_id")
      .notNull()
      .references(() => pregnanciesTable.id),
    authorMembershipId: integer("author_membership_id")
      .notNull()
      .references(() => membershipsTable.id),
    // "manual" | "journey_prompt" | "shared_decision" | "milestone"
    // | "task_completion" | "labor_update" | "birth_flow"
    sourceType: text("source_type").notNull(),
    text: text("text"),
    // JSON string array of photo URLs
    photoUrls: text("photo_urls"),
    // Required when sourceType = "journey_prompt"
    journeyWeekNumber: integer("journey_week_number"),
    // Which pool item the member published; used for pool-exclusion + analytics
    promptLibraryItemId: integer("prompt_library_item_id").references(() => memoryPromptsTable.id),
    // "private" | "public"
    visibility: text("visibility").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    // At most one journal-prompt Memory per member per week per pregnancy
    uniqueIndex("memories_one_journal_per_week")
      .on(table.authorMembershipId, table.pregnancyId, table.journeyWeekNumber)
      .where(sql`${table.sourceType} = 'journey_prompt'`),
  ],
);

export const insertMemorySchema = createInsertSchema(memoriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type Memory = typeof memoriesTable.$inferSelect;
