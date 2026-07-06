import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const phoneVerificationsTable = pgTable("phone_verifications", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  // 6-digit OTP. In development any 6-digit code is accepted server-side.
  // Swap in a real SMS provider (Twilio, etc.) by implementing sendSms() in
  // artifacts/api-server/src/lib/sms.ts and calling it here.
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPhoneVerificationSchema = createInsertSchema(
  phoneVerificationsTable,
).omit({ id: true, createdAt: true });
export type InsertPhoneVerification = z.infer<typeof insertPhoneVerificationSchema>;
export type PhoneVerification = typeof phoneVerificationsTable.$inferSelect;
