import { date, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pregnanciesTable = pgTable("pregnancies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Calendar day only — stored as YYYY-MM-DD string to avoid timezone shifts
  dueDate: date("due_date", { mode: "string" }),
  // "exact" | "approximate_month" | "unknown"
  dueDatePrecision: text("due_date_precision").notNull().default("unknown"),
  // Canonical lifecycle state per the Lifecycle Transition Contract:
  // "active" | "in_labor" | "completed" | "ended_early". Archive is NOT a status
  // here — it lives on Membership. Transitions are gated by the lifecycle service.
  status: text("status").notNull().default("active"),
  // Birth details, populated only on the complete_pregnancy transition.
  birthDate: date("birth_date", { mode: "string" }),
  // Wall-clock local time "HH:MM" plus an IANA zone (e.g. "America/Chicago"), so
  // the recorded birth moment is unambiguous regardless of where it's read.
  birthTime: text("birth_time"),
  birthTimeZone: text("birth_time_zone"),
  babyName: text("baby_name"),
  // Short code anyone with the link may use to join
  joinCode: text("join_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPregnancySchema = createInsertSchema(pregnanciesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPregnancy = z.infer<typeof insertPregnancySchema>;
export type Pregnancy = typeof pregnanciesTable.$inferSelect;
