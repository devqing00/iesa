"use client";

import { withAuth } from "@/lib/withAuth";
import { AdminTimpPage } from "@/app/(admin)/admin/timp/page";

function StudentTimpManagePage() {
  return <AdminTimpPage />;
}

export default withAuth(StudentTimpManagePage, {
  anyPermission: ["timp:manage"],
});
