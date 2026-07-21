import type {
  FormFieldDefinition,
  FormResponseValue,
} from "@/lib/forms/templates";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isEmpty(value: FormResponseValue | undefined) {
  if (value === undefined || value === null) return true;
  if (typeof value === "boolean") return value === false;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Validates one field response. Returns an error message or null if valid.
 */
export function validateFieldResponse(
  field: FormFieldDefinition,
  value: FormResponseValue | undefined,
): string | null {
  if (field.type === "signature") return null;

  if (field.required && isEmpty(value)) {
    return `Missing required field: ${field.label}`;
  }

  if (isEmpty(value)) return null;

  switch (field.type) {
    case "number": {
      if (typeof value !== "string" && typeof value !== "number") {
        return `${field.label} must be a number`;
      }
      const asString = String(value).trim();
      if (asString === "" || Number.isNaN(Number(asString))) {
        return `${field.label} must be a valid number`;
      }
      return null;
    }
    case "date": {
      if (typeof value !== "string" || !ISO_DATE.test(value.trim())) {
        return `${field.label} must be a valid date (YYYY-MM-DD)`;
      }
      const parsed = new Date(`${value.trim()}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        return `${field.label} must be a valid date`;
      }
      return null;
    }
    case "select": {
      if (typeof value !== "string") {
        return `${field.label} must be a single choice`;
      }
      const options = field.options ?? [];
      if (options.length > 0 && !options.includes(value)) {
        return `${field.label} must be one of the allowed options`;
      }
      return null;
    }
    case "multiselect": {
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
        return `${field.label} must be a list of choices`;
      }
      const options = field.options ?? [];
      if (options.length > 0 && value.some((entry) => !options.includes(entry))) {
        return `${field.label} contains an invalid option`;
      }
      return null;
    }
    case "yesno": {
      if (value !== "yes" && value !== "no" && value !== true && value !== false) {
        return `${field.label} must be Yes or No`;
      }
      return null;
    }
    case "checkbox": {
      if (typeof value !== "boolean") {
        return `${field.label} must be checked or unchecked`;
      }
      return null;
    }
    default:
      if (typeof value !== "string") {
        return `${field.label} must be text`;
      }
      return null;
  }
}

export function validateFormResponses(
  fields: FormFieldDefinition[],
  responses: Record<string, FormResponseValue>,
  signatureDataUrl?: string | null,
): string | null {
  for (const field of fields) {
    if (field.type === "signature") {
      if (field.required && !signatureDataUrl?.trim()) {
        return `Missing required field: ${field.label}`;
      }
      continue;
    }
    const error = validateFieldResponse(field, responses[field.id]);
    if (error) return error;
  }
  return null;
}
