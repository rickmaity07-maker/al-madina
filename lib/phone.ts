import { isValidPhoneNumber } from "libphonenumber-js";

// Store is in Germany — a number typed without a country code (e.g. "0176...")
// is assumed local. Numbers with an explicit "+" prefix are checked as-is.
const DEFAULT_REGION = "DE";

/**
 * Format-only validation against the real ITU numbering plan (correct
 * country code, digit length, and prefix for that country) — this rejects
 * obviously fake input (too short, wrong length, bad country code, all
 * zeros) but can't prove the number is real or that the person owns it.
 * That requires an SMS OTP round trip through a provider (Twilio, Vonage,
 * etc.), which isn't configured in this project.
 */
export function isPlausiblePhoneNumber(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return false;
  try {
    return isValidPhoneNumber(trimmed, DEFAULT_REGION);
  } catch {
    return false;
  }
}
