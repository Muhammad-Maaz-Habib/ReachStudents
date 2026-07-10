import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("normalizes US 10-digit numbers to E.164", () => {
    const result = normalizePhone("(555) 010-1000");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.normalized).toBe("+15550101000");
  });

  it("accepts empty phone", () => {
    const result = normalizePhone("");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.normalized).toBe("");
  });

  it("rejects too-short numbers", () => {
    const result = normalizePhone("12345");
    expect(result.ok).toBe(false);
  });

  it("preserves international plus prefix", () => {
    const result = normalizePhone("+44 20 7946 0958");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.normalized.startsWith("+")).toBe(true);
  });
});
