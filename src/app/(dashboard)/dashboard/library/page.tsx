"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState } from "react";

// Mock Data
const RESOURCES = [
  {
    id: 1,
    title: "Engineering Mathematics K.A Stroud",
    author: "K.A Stroud",
    type: "Textbook",
    course: "General",
    status: "Available",
    format: "Physical",
    color: "bg-orange-600",
  },
  {
    id: 2,
    title: "TVE 202 Past Questions (2018-2023)",
    author: "IESA Academic Committee",
    type: "Past Question",
    course: "TVE 202",
    status: "Download",
    format: "PDF",
    color: "bg-blue-600",
  },
  {
    id: 3,
    title: "Introduction to Thermodynamics",
    author: "Y.V.C. Rao",
    type: "Textbook",
    course: "MEE 301",
    status: "Borrowed",
    returnDate: "2 days",
    format: "Physical",
    color: "bg-red-600",
  },
  {
    id: 4,
    title: "Fluid Mechanics Lab Manual",
    author: "Department of Civil Eng.",
    type: "Manual",
    course: "CVE 305",
    status: "Download",
    format: "PDF",
    color: "bg-emerald-600",
  },
  {
    id: 5,
    title: "Engineering Drawing Standards",
    author: "ISO",
    type: "Reference",
    course: "MEE 201",
    status: "Available",
    format: "Physical",
    color: "bg-purple-600",
  },
  {
    id: 6,
    title: "EEE 311 Lecture Notes",
    author: "Dr. Adewale",
    type: "Notes",
    course: "EEE 311",
    status: "Download",
    format: "PDF",
    color: "bg-yellow-600",
  },
];

const FILTERS = ["All", "Textbook", "Past Question", "Notes"];

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const filteredResources = RESOURCES.filter((item) => {
    const matchesFilter = activeFilter === "All" || item.type === activeFilter;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.course.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="Library" />
      
      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        {/* Search & Filter Section */}
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-3 md:gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold font-heading text-foreground">Digital Library</h2>
              <p className="text-sm md:text-base text-foreground/60">Access textbooks, past questions, and lecture notes.</p>
            </div>
            
            <div className="relative w-full md:w-96">
              <input
                type="text"
                placeholder="Search by title or course code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-background/60 backdrop-blur-xl border border-foreground/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
              <svg className="w-5 h-5 text-foreground/40 absolute left-4 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-foreground/5 pb-4">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeFilter === filter
                    ? "bg-foreground text-background"
                    : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {filteredResources.map((item) => (
            <div 
              key={item.id}
              className="group bg-background/60 backdrop-blur-xl border border-foreground/5 rounded-xl p-4 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 flex flex-col"
            >
              {/* Book Cover Placeholder */}
              <div className={`aspect-3/4 ${item.color} rounded-lg mb-4 relative shadow-inner overflow-hidden group-hover:scale-[1.02] transition-transform duration-300`}>
                <div className="absolute inset-0 bg-linear-to-tr from-black/40 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="text-white/80 text-xs font-bold mb-1">{item.course}</div>
                  <div className="text-white font-heading font-bold text-lg leading-tight line-clamp-3">
                    {item.title}
                  </div>
                </div>
                {/* Spine effect */}
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-black/20" />
              </div>

              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-foreground/40 uppercase tracking-wider">{item.type}</span>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                    item.status === 'Available' ? 'border-green-500/30 text-green-600 bg-green-500/10' :
                    item.status === 'Download' ? 'border-blue-500/30 text-blue-600 bg-blue-500/10' :
                    'border-red-500/30 text-red-600 bg-red-500/10'
                  }`}>
                    {item.status === 'Borrowed' ? `Due in ${item.returnDate}` : item.status}
                  </span>
                </div>
                
                <h3 className="font-bold text-foreground mb-1 line-clamp-1" title={item.title}>{item.title}</h3>
                <p className="text-xs text-foreground/60 mb-4">{item.author}</p>

                <button className={`mt-auto w-full py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  item.status === 'Borrowed'
                    ? "border-foreground/10 text-foreground/40 cursor-not-allowed"
                    : "border-foreground/10 hover:border-primary hover:text-primary hover:bg-primary/5"
                }`}>
                  {item.status === 'Download' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Download PDF
                    </>
                  ) : item.status === 'Borrowed' ? (
                    "Unavailable"
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                      Reserve Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredResources.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4 opacity-20">🔍</div>
            <h3 className="text-xl font-bold text-foreground/40">No resources found</h3>
            <p className="text-foreground/40 text-sm mt-2">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
