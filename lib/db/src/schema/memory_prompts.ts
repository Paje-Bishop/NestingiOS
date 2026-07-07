import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Global product content: the pool of Journey journal prompts (FS-003). At render
// time the eligible pool for a member is filtered by role + week range +
// pregnancy-number target, minus prompts the member has already published this
// pregnancy. No priority field for MVP (2026-07-01 decision) — any eligible,
// unused prompt is equally valid.
export const memoryPromptsTable = pgTable("memory_prompts", {
  id: serial("id").primaryKey(),
  promptText: text("prompt_text").notNull(),
  // "pregnant_person" | "supporter" | "both"
  roleTarget: text("role_target").notNull().default("both"),
  eligibleStartWeek: integer("eligible_start_week").notNull(),
  eligibleEndWeek: integer("eligible_end_week").notNull(),
  // "any" | "first" | "second_plus"
  pregnancyNumberTarget: text("pregnancy_number_target").notNull().default("any"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMemoryPromptSchema = createInsertSchema(memoryPromptsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMemoryPrompt = z.infer<typeof insertMemoryPromptSchema>;
export type MemoryPrompt = typeof memoryPromptsTable.$inferSelect;
