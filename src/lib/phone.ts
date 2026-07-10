export type PhoneValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

/**
 * Strips formatting and validates a plausible phone number for SMS.
 * Accepts US 10-digit numbers and international E.164 (10–15 digits).
 */
export function normalizePhone(value?: string | null): PhoneValidationResult {
  if (!value?.trim()) {
    return { ok: true, normalized: "" };
  }

  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) {
    return {
      ok: false,
      reason: "Phone must contain 10–15 digits after removing formatting",
    };
  }

  if (hasPlus) {
    return { ok: true, normalized: `+${digits}` };
  }

  if (digits.length === 10) {
    return { ok: true, normalized: `+1${digits}` };
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return { ok: true, normalized: `+${digits}` };
  }

  return { ok: true, normalized: `+${digits}` };
}

export function formatPhoneDisplay(normalized: string) {
  if (!normalized) return "";
  const digits = normalized.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7, 11);
    return `(${area}) ${prefix}-${line}`;
  }
  return normalized;
}
