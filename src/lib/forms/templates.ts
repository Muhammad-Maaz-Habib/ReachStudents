export type FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "yesno"
  | "checkbox"
  | "signature";

export type FormFieldDefinition = {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  helpText?: string;
  /** Options for select / multiselect fields. */
  options?: string[];
};

export type FormResponseValue = string | boolean | string[];

export type FormTemplateType =
  | "PERMISSION_SLIP"
  | "MEDICAL_CONSENT"
  | "PHOTO_RELEASE"
  | "LIABILITY_WAIVER";

/** Form.type value for admin-built reusable schemas. */
export const CUSTOM_FORM_TYPE = "CUSTOM";

export type FormTemplate = {
  type: FormTemplateType;
  title: string;
  description: string;
  fields: FormFieldDefinition[];
};

export const FORM_FIELD_TYPE_OPTIONS: {
  value: FormFieldType;
  label: string;
  needsOptions?: boolean;
}[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text / paragraph" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Single-select", needsOptions: true },
  { value: "multiselect", label: "Multi-select", needsOptions: true },
  { value: "yesno", label: "Yes / No" },
  { value: "checkbox", label: "Checkbox (agree)" },
  { value: "signature", label: "Signature" },
];

export const FORM_TEMPLATES: Record<FormTemplateType, FormTemplate> = {
  PERMISSION_SLIP: {
    type: "PERMISSION_SLIP",
    title: "Activity permission slip",
    description:
      "Parent/guardian permission for off-campus or higher-risk activities.",
    fields: [
      {
        id: "activity_name",
        label: "Activity name",
        type: "text",
        required: true,
      },
      {
        id: "activity_date",
        label: "Activity date",
        type: "date",
        required: true,
      },
      {
        id: "transport_ack",
        label: "I authorize my child to participate and use camp transportation",
        type: "checkbox",
        required: true,
      },
      {
        id: "trip_location_ack",
        label:
          "I understand camp staff may record one-time GPS location check-ins during off-site trips for safety (not continuous tracking). Location data is deleted within 24 hours.",
        type: "checkbox",
        required: true,
        helpText:
          "Disclosure for the emergency trip location ping feature. Required for field trips using off-site location check-ins.",
      },
      {
        id: "emergency_contact_confirm",
        label: "Emergency contact information is current",
        type: "checkbox",
        required: true,
      },
      { id: "signature", label: "Parent/guardian signature", type: "signature", required: true },
    ],
  },
  MEDICAL_CONSENT: {
    type: "MEDICAL_CONSENT",
    title: "Medical treatment consent",
    description:
      "Consent for camp health staff to provide basic first aid and emergency care.",
    fields: [
      {
        id: "medical_history_ack",
        label: "Medical information on file is accurate",
        type: "checkbox",
        required: true,
      },
      {
        id: "otc_meds_ack",
        label: "I authorize OTC medications per camp policy (e.g. ibuprofen, antihistamine)",
        type: "checkbox",
        required: true,
      },
      {
        id: "provider_name",
        label: "Primary care provider (optional)",
        type: "text",
      },
      { id: "signature", label: "Parent/guardian signature", type: "signature", required: true },
    ],
  },
  PHOTO_RELEASE: {
    type: "PHOTO_RELEASE",
    title: "Photo & media release",
    description: "Permission to use photos/video for camp communications.",
    fields: [
      {
        id: "photo_web",
        label: "I allow photos on the camp website and social media",
        type: "checkbox",
        required: true,
      },
      {
        id: "photo_print",
        label: "I allow photos in printed camp materials",
        type: "checkbox",
      },
      { id: "signature", label: "Parent/guardian signature", type: "signature", required: true },
    ],
  },
  LIABILITY_WAIVER: {
    type: "LIABILITY_WAIVER",
    title: "Liability waiver",
    description: "Standard participation waiver for session activities.",
    fields: [
      {
        id: "assumption_of_risk",
        label: "I understand outdoor/camp activities involve inherent risks",
        type: "checkbox",
        required: true,
      },
      {
        id: "release_ack",
        label: "I release the organization from liability except gross negligence",
        type: "checkbox",
        required: true,
      },
      { id: "signature", label: "Parent/guardian signature", type: "signature", required: true },
    ],
  },
};

export function getFormTemplate(type: string): FormTemplate | null {
  return FORM_TEMPLATES[type as FormTemplateType] ?? null;
}

export const FORM_TEMPLATE_OPTIONS = Object.values(FORM_TEMPLATES).map((template) => ({
  type: template.type,
  title: template.title,
  description: template.description,
}));

export function formHasSignatureField(fields: FormFieldDefinition[]) {
  return fields.some((field) => field.type === "signature");
}

export function slugifyFieldId(label: string, existingIds: string[]) {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field";
  let id = base;
  let n = 2;
  while (existingIds.includes(id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  return id;
}
