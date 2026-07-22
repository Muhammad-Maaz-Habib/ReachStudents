import { describe, expect, it } from "vitest";
import {
  GENERAL_LOCATION_KEY,
  resolveCampusZone,
} from "./location-distribution";

describe("resolveCampusZone", () => {
  it("prefers Activity.location when set", () => {
    expect(
      resolveCampusZone({
        id: "1",
        name: "Afternoon Swim",
        location: "Pool",
      }),
    ).toEqual({ key: "pool", label: "Pool" });
  });

  it("falls back to activity name when location is empty (matches donut/Who's Here)", () => {
    expect(
      resolveCampusZone({
        id: "2",
        name: "Classroom",
        location: null,
      }),
    ).toEqual({ key: "classroom", label: "Classroom" });
    expect(
      resolveCampusZone({
        id: "3",
        name: "Mentor Group",
        location: "  ",
      }),
    ).toEqual({ key: "mentor group", label: "Mentor Group" });
  });

  it("uses General campus when there is no activity", () => {
    expect(resolveCampusZone(null)).toEqual({
      key: GENERAL_LOCATION_KEY,
      label: "General campus",
    });
  });
});
