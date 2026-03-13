"use client";

import { withAuth } from "@/lib/withAuth";
import { AdminIepodPage } from "@/app/(admin)/admin/iepod/page";

function StudentIepodManagePage() {
  return <AdminIepodPage />;
}

export default withAuth(StudentIepodManagePage, {
  anyPermission: ["iepod:manage", "iepod:view"],
});
