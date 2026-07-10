import { describe, expect, it } from "vitest";
import { buildActivityInstances } from "./recurrence";

describe("buildActivityInstances", () => {
  it("generates instances on selected weekdays", () => {
    const instances = buildActivityInstances({
      rangeStart: new Date("2026-06-15T00:00:00.000Z"), // Monday
      rangeEnd: new Date("2026-06-21T00:00:00.000Z"),
      recurrenceDays: [1, 3, 5], // Mon, Wed, Fri
      startTimeMinutes: 14 * 60,
      durationMinutes: 60,
    });

    expect(instances.length).toBe(3);
    expect(instances[0].startTime.getUTCHours()).toBe(14);
  });
});
