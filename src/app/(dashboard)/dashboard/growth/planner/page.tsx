"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";

export default function PlannerPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="Personal Planner" />
      <div className="p-4 md:p-8 max-w-3xl mx-auto w-full">
        <p className="text-foreground/80 mb-4">
          A simple planner to manage tasks, deadlines and study sessions.
        </p>

        <div className="rounded-xl border p-4 bg-background/50">
          <p className="text-sm text-foreground/70 mb-4">Features:</p>
          <ul className="list-disc pl-5 text-foreground/70 mb-4">
            <li>Task lists</li>
            <li>Study session timers</li>
            <li>Deadline reminders</li>
          </ul>

          <div className="flex gap-2">
            <button className="btn btn-primary">Open Planner</button>
            <Link href="../" className="btn btn-ghost">
              Back
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
