"use client";

import { withAuth } from "@/lib/withAuth";
import { ClassRepPortal } from "@/app/(admin)/admin/class-rep/page";

function FreshersCoordinatorPage() {
  return <ClassRepPortal variant="freshers" />;
}

export default withAuth(FreshersCoordinatorPage, {
  requiredPermission: "freshers:manage",
});
