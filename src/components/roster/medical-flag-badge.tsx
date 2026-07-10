import { StatusBadge } from "@/components/design-system/status-badge";
import { getMedicalFlag } from "@/lib/medical-flags";

type MedicalFlagBadgeProps = {
  student: {
    medicalProfile?: {
      allergies?: string | null;
      medications?: string | null;
      conditions?: string | null;
    } | null;
  };
  className?: string;
};

export function MedicalFlagBadge({ student, className }: MedicalFlagBadgeProps) {
  const flag = getMedicalFlag(student);
  if (!flag) {
    return (
      <StatusBadge status="success" label="Clear" className={className} />
    );
  }

  return (
    <StatusBadge
      status={flag.status}
      label={flag.label}
      className={className}
      title={flag.detail}
    />
  );
}
