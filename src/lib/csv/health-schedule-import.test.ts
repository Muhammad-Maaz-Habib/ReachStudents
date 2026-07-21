import { describe, expect, it } from "vitest";
import {
  parseRecurrenceDays,
  parseScheduleCsv,
  parseStartTimeMinutes,
} from "./schedule-import";
import { parseHealthCsv } from "./health-import";

describe("parseHealthCsv", () => {
  it("accepts external_id-only identity", () => {
    const csv = `external_id,first_name,last_name,date_of_birth,allergies,medications,medical_conditions
REG-1,,,,Peanuts,,`;
    const result = parseHealthCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].external_id).toBe("REG-1");
    expect(result.rows[0].allergies).toBe("Peanuts");
  });

  it("requires name+DOB when external_id missing", () => {
    const csv = `external_id,first_name,last_name,date_of_birth,allergies,medications,medical_conditions
,Jordan,Lee,,Peanuts,,`;
    const result = parseHealthCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]).toMatch(/external_id/);
  });
});

describe("parseScheduleCsv helpers", () => {
  it("parses recurrence day aliases", () => {
    expect(parseRecurrenceDays("Mon,Wed,Fri")).toEqual([1, 3, 5]);
    expect(parseRecurrenceDays("monday; friday")).toEqual([1, 5]);
  });

  it("parses start times", () => {
    expect(parseStartTimeMinutes("14:00")).toBe(14 * 60);
    expect(parseStartTimeMinutes("2:30 PM")).toBe(14 * 60 + 30);
    expect(parseStartTimeMinutes("12:15 AM")).toBe(15);
  });

  it("parses schedule rows", () => {
    const csv = `activity_name,team,start_date,start_time,duration_minutes,recurrence_days,overdue_alert_minutes
Swim,Pine Cabin,2026-06-16,14:00,60,Mon,Wed,Fri,15`;
    // Note: Mon,Wed,Fri without quotes will break CSV — use quotes
    const quoted = `activity_name,team,start_date,start_time,duration_minutes,recurrence_days,overdue_alert_minutes
Swim,Pine Cabin,2026-06-16,14:00,60,"Mon,Wed,Fri",15`;
    const result = parseScheduleCsv(quoted);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].recurrence_days).toBe("Mon,Wed,Fri");
    expect(result.rows[0].team).toBe("Pine Cabin");
  });
});
