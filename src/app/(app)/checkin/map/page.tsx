import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { requireOrganizationSession } from "@/lib/org";
import { STAFF_ROLES } from "@/lib/constants";
import { getLocationDistribution } from "@/lib/attendance/location-distribution";
import { CampusMap } from "@/components/checkin/campus-map";
import { PageHeader } from "@/components/design-system/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function CampusMapPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/onboarding");
  if (!STAFF_ROLES.includes(session.user.role)) redirect("/dashboard");

  const campSession = await requireOrganizationSession(session.user.organizationId);
  const distribution = await getLocationDistribution(campSession.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus map"
        description={`${campSession.name} · where students are by activity location (check-in data only — not GPS).`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/checkin/whos-here"
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
            >
              Who&apos;s here
            </Link>
            <Link
              href="/checkin"
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
            >
              Check-in
            </Link>
          </div>
        }
      />

      <CampusMap
        initialSlices={distribution.slices}
        initialCheckedInCount={distribution.checkedInCount}
        initialTotalStudents={distribution.totalStudents}
      />
    </div>
  );
}
