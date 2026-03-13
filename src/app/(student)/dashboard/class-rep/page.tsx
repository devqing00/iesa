"use client";

import { withAuth } from "@/lib/withAuth";
import { ClassRepPortal } from "@/app/(admin)/admin/class-rep/page";

function StudentClassRepPage() {
  return <ClassRepPortal />;
}

export default withAuth(StudentClassRepPage, {
  requiredPermission: "class_rep:view_cohort",
});
