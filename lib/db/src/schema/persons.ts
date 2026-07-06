import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const personsTable = pgTable("persons", {
  id: serial("id").primaryKey(),
  displayName: text("display_name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPersonSchema = createInsertSchema(personsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Person = typeof personsTable.$inferSelect;
