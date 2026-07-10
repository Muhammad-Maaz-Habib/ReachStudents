import { PageHeader } from "@/components/design-system/page-header";
import { EmptyState } from "@/components/design-system/empty-state";
import { AlertTriangle } from "lucide-react";

export default function ParentIncidentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Incidents" description="Reports concerning your child." />
      <EmptyState
        icon={AlertTriangle}
        title="No incident reports"
        description="You'll be notified when staff files a report involving your child."
      />
    </div>
  );
}
