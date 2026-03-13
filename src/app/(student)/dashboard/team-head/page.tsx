"use client";

import { withAuth } from "@/lib/withAuth";
import { TeamHeadPortal } from "@/app/(admin)/admin/team-head/page";

function StudentTeamHeadPage() {
  return <TeamHeadPortal />;
}

export default withAuth(StudentTeamHeadPage, {
  requiredPermission: "team_head:view_members",
});
