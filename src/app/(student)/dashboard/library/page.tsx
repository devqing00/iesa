import { redirect } from "next/navigation";

// Library merged into /dashboard/resources
export default function LibraryPage() {
  redirect("/dashboard/resources");
}
