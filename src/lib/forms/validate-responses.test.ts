import { describe, expect, it } from "vitest";
import { validateFieldResponse, validateFormResponses } from "./validate-responses";
import type { FormFieldDefinition } from "./templates";

const fields: FormFieldDefinition[] = [
  { id: "name", label: "Name", type: "text", required: true },
  { id: "notes", label: "Notes", type: "textarea" },
  { id: "age", label: "Age", type: "number", required: true },
  { id: "when", label: "When", type: "date", required: true },
  {
    id: "cabin",
    label: "Cabin",
    type: "select",
    required: true,
    options: ["Pine", "Maple"],
  },
  {
    id: "gear",
    label: "Gear",
    type: "multiselect",
    required: true,
    options: ["Hat", "Water"],
  },
  { id: "photo", label: "Photo ok", type: "yesno", required: true },
  { id: "ack", label: "Ack", type: "checkbox", required: true },
  { id: "signature", label: "Sign", type: "signature", required: true },
];

describe("validateFormResponses", () => {
  it("accepts a complete custom payload", () => {
    const error = validateFormResponses(
      fields,
      {
        name: "Jordan",
        notes: "Hello",
        age: "12",
        when: "2026-06-20",
        cabin: "Pine",
        gear: ["Hat"],
        photo: "yes",
        ack: true,
      },
      "data:image/png;base64,abc",
    );
    expect(error).toBeNull();
  });

  it("rejects invalid date and number", () => {
    expect(
      validateFieldResponse(
        { id: "when", label: "When", type: "date" },
        "06/20/2026",
      ),
    ).toMatch(/valid date/);
    expect(
      validateFieldResponse({ id: "age", label: "Age", type: "number" }, "twelve"),
    ).toMatch(/number/);
  });

  it("requires signature when configured", () => {
    const error = validateFormResponses(
      fields,
      {
        name: "Jordan",
        age: "12",
        when: "2026-06-20",
        cabin: "Pine",
        gear: ["Hat"],
        photo: "yes",
        ack: true,
      },
      null,
    );
    expect(error).toMatch(/Sign/);
  });
});
