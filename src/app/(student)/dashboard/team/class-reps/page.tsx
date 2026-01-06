"use client";

import { useState } from "react";

const CLASS_REPS = [
  {
    name: "Emeka Obi",
    role: "100L Class Rep",
    phone: "08011112222",
    level: "100L",
    photo: "",
    email: "100lrep@iesa.edu",
  },
  {
    name: "Mary Johnson",
    role: "100L Asst. Rep",
    phone: "08011113333",
    level: "100L",
    photo: "",
    email: "100lrep2@iesa.edu",
  },
  {
    name: "Femi Adeyemi",
    role: "200L Class Rep",
    phone: "08022223333",
    level: "200L",
    photo: "",
    email: "200lrep@iesa.edu",
  },
  {
    name: "Grace Udo",
    role: "200L Asst. Rep",
    phone: "08022224444",
    level: "200L",
    photo: "",
    email: "200lrep2@iesa.edu",
  },
  {
    name: "Ahmed Yusuf",
    role: "300L Class Rep",
    phone: "08033334444",
    level: "300L",
    photo: "",
    email: "300lrep@iesa.edu",
  },
  {
    name: "Blessing Eze",
    role: "300L Asst. Rep",
    phone: "08033335555",
    level: "300L",
    photo: "",
    email: "300lrep2@iesa.edu",
  },
  {
    name: "Tunde Bello",
    role: "400L Class Rep",
    phone: "08044445555",
    level: "400L",
    photo: "",
    email: "400lrep@iesa.edu",
  },
  {
    name: "Ada Nwosu",
    role: "400L Asst. Rep",
    phone: "08044446666",
    level: "400L",
    photo: "",
    email: "400lrep2@iesa.edu",
  },
  {
    name: "John Doe",
    role: "500L Class Rep",
    phone: "08055556666",
    level: "500L",
    photo: "",
    email: "500lrep@iesa.edu",
  },
  {
    name: "Jane Smith",
    role: "500L Asst. Rep",
    phone: "08055557777",
    level: "500L",
    photo: "",
    email: "500lrep2@iesa.edu",
  },
];

const LEVELS = ["All", "100L", "200L", "300L", "400L", "500L"];

export default function ClassRepsPage() {
  const [selectedLevel, setSelectedLevel] = useState("All");

  const filteredReps =
    selectedLevel === "All"
      ? CLASS_REPS
      : CLASS_REPS.filter((rep) => rep.level === selectedLevel);

  const repsByLevel = CLASS_REPS.reduce((acc, rep) => {
    if (!acc[rep.level]) acc[rep.level] = [];
    acc[rep.level].push(rep);
    return acc;
  }, {} as Record<string, typeof CLASS_REPS>);

  return (
    <div>
      {/* Section Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-label text-text-muted">◆</span>
          <span className="text-label-sm text-text-muted">Representatives</span>
        </div>
        <h2 className="font-display text-display-sm">Class Representatives</h2>
        <p className="text-text-secondary text-body text-sm mt-2">
          Your class reps across all levels - reach out for class matters
        </p>
      </div>

      {/* Level Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide border-b border-border">
        {LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => setSelectedLevel(level)}
            className={`flex-shrink-0 px-4 py-2.5 text-label transition-all ${
              selectedLevel === level
                ? "bg-charcoal dark:bg-cream text-cream dark:text-charcoal"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
            }`}
          >
            {level}
          </button>
        ))}
      </div>

      {/* Reps by Level */}
      {selectedLevel === "All" ? (
        <div className="space-y-10">
          {Object.entries(repsByLevel)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([level, reps]) => (
              <div key={level}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-display text-lg">{level}</span>
                  <span className="text-text-muted text-label-sm">
                    ({reps.length} {reps.length === 1 ? "rep" : "reps"})
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reps.map((rep) => (
                    <RepCard key={rep.email} rep={rep} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReps.map((rep) => (
            <RepCard key={rep.email} rep={rep} />
          ))}
        </div>
      )}
    </div>
  );
}

function RepCard({ rep }: { rep: (typeof CLASS_REPS)[0] }) {
  const isMainRep =
    rep.role.includes("Class Rep") && !rep.role.includes("Asst");

  return (
    <div className="page-frame p-6 group hover:-translate-y-0.5 transition-transform">
      {/* Avatar */}
      <div className="flex items-start justify-between mb-4">
        <div className="relative">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center font-display text-xl ${
              isMainRep
                ? "bg-charcoal dark:bg-cream text-cream dark:text-charcoal"
                : "bg-charcoal/70 dark:bg-cream/70 text-cream dark:text-charcoal"
            }`}
          >
            {rep.name[0]}
          </div>
          {isMainRep && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-charcoal dark:bg-cream border-2 border-bg-primary rounded-full flex items-center justify-center">
              <span className="text-cream dark:text-charcoal text-[8px]">
                ✦
              </span>
            </div>
          )}
        </div>
        <span className="text-label-sm text-text-muted">{rep.level}</span>
      </div>

      {/* Name & Role */}
      <h3 className="font-display text-base mb-1">{rep.name}</h3>
      <p className="text-label-sm text-text-muted mb-4">{rep.role}</p>

      {/* Contact */}
      <div className="space-y-2 pt-4 border-t border-border">
        <a
          href={`mailto:${rep.email}`}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
          <span className="text-label-sm truncate">{rep.email}</span>
        </a>
        <a
          href={`tel:${rep.phone}`}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
            />
          </svg>
          <span className="text-label-sm">{rep.phone}</span>
        </a>
      </div>
    </div>
  );
}
