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
  // "active" | "archived"
  status: text("status").notNull().default("active"),
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
