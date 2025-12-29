"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useState } from "react";

// Mock Data
const EVENTS = [
  {
    id: 1,
    title: "Annual Engineering Symposium",
    date: new Date("2025-01-15T09:00:00"),
    location: "Main Auditorium",
    category: "Academic",
    description: "Join us for a day of innovation and technical talks from industry leaders.",
    image: "bg-linear-to-br from-blue-600 to-indigo-900",
    registered: true,
  },
  {
    id: 2,
    title: "Freshers' Welcome Party",
    date: new Date("2025-01-20T18:00:00"),
    location: "Student Union Building",
    category: "Social",
    description: "A night of music, food, and networking for our new engineering students.",
    image: "bg-linear-to-br from-pink-600 to-purple-900",
    registered: false,
  },
  {
    id: 3,
    title: "Career Fair 2025",
    date: new Date("2025-02-10T10:00:00"),
    location: "Faculty Open Space",
    category: "Career",
    description: "Meet top employers and secure your internship or graduate role.",
    image: "bg-linear-to-br from-emerald-600 to-teal-900",
    registered: false,
  },
  {
    id: 4,
    title: "Python for Engineers Workshop",
    date: new Date("2025-02-15T14:00:00"),
    location: "Computer Lab 2",
    category: "Workshop",
    description: "Hands-on session learning Python for data analysis and automation.",
    image: "bg-linear-to-br from-yellow-600 to-orange-900",
    registered: false,
  },
];

const CATEGORIES = ["All", "Academic", "Social", "Career", "Workshop"];

export default function EventsPage() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredEvents = activeCategory === "All" 
    ? EVENTS 
    : EVENTS.filter(e => e.category === activeCategory);

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="Events" />
      
      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold font-heading text-foreground">Upcoming Activities</h2>
            <p className="text-sm md:text-base text-foreground/60">Don't miss out on what's happening in the department.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  activeCategory === cat
                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                    : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {filteredEvents.map((event) => (
            <div 
              key={event.id}
              className="group relative bg-background/60 backdrop-blur-xl border border-foreground/5 rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 flex flex-col"
            >
              {/* Image / Banner Area */}
              <div className={`h-48 ${event.image} relative p-6 flex flex-col justify-between`}>
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                
                <div className="relative z-10 flex justify-between items-start">
                  <span className="bg-background/90 backdrop-blur-md text-foreground px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                    {event.category}
                  </span>
                  {event.registered && (
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      Registered
                    </span>
                  )}
                </div>

                <div className="relative z-10 bg-background/90 backdrop-blur-md self-start px-4 py-2 rounded-xl border border-foreground/5 text-center min-w-[80px]">
                  <div className="text-xs font-bold text-primary uppercase">{event.date.toLocaleString('default', { month: 'short' })}</div>
                  <div className="text-2xl font-bold font-heading text-foreground leading-none">{event.date.getDate()}</div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-xl font-bold font-heading text-foreground mb-2 group-hover:text-primary transition-colors">
                  {event.title}
                </h3>
                <p className="text-sm text-foreground/60 mb-6 line-clamp-2 flex-1">
                  {event.description}
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm text-foreground/80">
                    <span className="text-lg">🕒</span>
                    <span>{formatTime(event.date)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-foreground/80">
                    <span className="text-lg">📍</span>
                    <span>{event.location}</span>
                  </div>
                </div>

                <button className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  event.registered 
                    ? "bg-foreground/5 text-foreground/40 cursor-not-allowed"
                    : "bg-primary text-white hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
                }`}>
                  {event.registered ? "Ticket Confirmed" : "Register Now"}
                  {!event.registered && <span>→</span>}
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredEvents.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4 opacity-20">📅</div>
            <h3 className="text-xl font-bold text-foreground/40">No events found in this category</h3>
          </div>
        )}
      </div>
    </div>
  );
}
