import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { personsTable } from "./persons";
import { pregnanciesTable } from "./pregnancies";

export const analyticsEventsTable = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  event: text("event").notNull(),
  personId: integer("person_id").references(() => personsTable.id),
  pregnancyId: integer("pregnancy_id").references(() => pregnanciesTable.id),
  // JSON string of arbitrary properties
  properties: text("properties"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnalyticsEventSchema = createInsertSchema(
  analyticsEventsTable,
).omit({ id: true, createdAt: true });
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect;
