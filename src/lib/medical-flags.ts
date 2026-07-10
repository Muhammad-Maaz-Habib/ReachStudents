export function getMedicalFlag(student: {
  medicalProfile?: {
    allergies?: string | null;
    medications?: string | null;
    conditions?: string | null;
  } | null;
}) {
  const allergies = student.medicalProfile?.allergies?.trim();
  const medications = student.medicalProfile?.medications?.trim();
  const conditions = student.medicalProfile?.conditions?.trim();

  if (allergies) {
    return { status: "danger" as const, label: "Allergy", detail: allergies };
  }
  if (medications) {
    return { status: "warning" as const, label: "Meds", detail: medications };
  }
  if (conditions) {
    return { status: "warning" as const, label: "Condition", detail: conditions };
  }
  return null;
}
