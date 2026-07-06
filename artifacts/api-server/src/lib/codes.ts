import crypto from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous I/O/0/1

/**
 * Generate a random alphanumeric code using unambiguous characters.
 * Uses crypto.randomBytes for uniform distribution.
 */
export function generateCode(length: number): string {
  let result = "";
  // Over-sample to handle modulo bias
  const bytes = crypto.randomBytes(length * 2);
  let idx = 0;
  while (result.length < length) {
    const b = bytes[idx++];
    if (b < 256 - (256 % ALPHABET.length)) {
      result += ALPHABET[b % ALPHABET.length];
    }
  }
  return result;
}

/**
 * Generate a random 6-digit OTP (string, zero-padded).
 */
export function generateOtp(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}
