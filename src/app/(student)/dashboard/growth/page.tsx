"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { Calculator, ClipboardList } from "lucide-react";

const TOOLS = [
  {
    id: "cgpa",
    title: "CGPA Calculator",
    desc: "Track your academic progress with precision. Calculate semester and cumulative GPA with ease.",
    href: "./growth/cgpa",
    icon: Calculator,
    gradient: "from-blue-500 to-purple-600",
  },
  {
    id: "planner",
    title: "Personal Planner",
    desc: "Organize your tasks, deadlines and study sessions. Stay productive and focused.",
    href: "./growth/planner",
    icon: ClipboardList,
    gradient: "from-green-500 to-teal-600",
  },
];

export default function GrowthPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <DashboardHeader title="Student Growth" />
      <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">
            Academic Tools
          </h2>
          <p className="text-foreground/70 text-lg max-w-2xl">
            Powerful tools to help you track progress, stay organized, and achieve your academic goals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.id}
                href={tool.href}
                className="group relative rounded-2xl overflow-hidden bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-[var(--glass-blur)] p-8 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
              >
                {/* Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                
                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-8 h-8 text-white" strokeWidth={2} />
                </div>

                {/* Content */}
                <div className="relative z-10">
                  <h3 className="font-heading font-bold text-2xl text-foreground mb-3 group-hover:text-primary transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-foreground/70 leading-relaxed mb-6">
                    {tool.desc}
                  </p>

                  {/* CTA Button */}
                  <div className="inline-flex items-center gap-2 text-primary font-semibold group-hover:gap-3 transition-all">
                    <span>Get Started</span>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Info Card */}
        <div className="mt-8 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-xl p-6">
          <p className="text-sm text-foreground/60 text-center">
            <svg className="w-4 h-4 inline-block mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            All your data is stored securely in your browser - your privacy matters.
          </p>
        </div>
      </div>
    </div>
  );
}
