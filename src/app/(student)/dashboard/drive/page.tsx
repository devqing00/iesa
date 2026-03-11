import { redirect } from "next/navigation";

// Drive merged into /dashboard/resources
export default function DrivePage() {
  redirect("/dashboard/resources");
}
