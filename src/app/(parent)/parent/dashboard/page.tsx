import { PageHeader } from "@/components/design-system/page-header";
import { EmptyState } from "@/components/design-system/empty-state";
import { Home } from "lucide-react";

export default function ParentDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent portal"
        description="Your child's schedule, check-in status, and announcements — coming in later stages."
      />
      <EmptyState
        icon={Home}
        title="Welcome, parent"
        description="Link your account to a student roster in Stage 2 to see your child's info here."
      />
    </div>
  );
}
