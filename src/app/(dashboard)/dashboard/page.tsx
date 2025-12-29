"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="Overview" />
      
      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        {/* Welcome Section */}
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 md:p-8 relative overflow-hidden">
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-bold font-heading mb-2 text-foreground">Welcome back, Future Engineer! 🚀</h2>
            <p className="text-sm md:text-base text-foreground/60 max-w-2xl">
              Your academic journey is on track. Check your upcoming events and library status below.
            </p>
          </div>
          <div className="absolute right-0 top-0 h-full w-1/3 bg-linear-to-l from-primary/10 to-transparent pointer-events-none" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {[
            { label: "Upcoming Events", value: "3", icon: "📅" },
            { label: "Library Books", value: "1", icon: "📚" },
            { label: "Due Payments", value: "₦0.00", icon: "💳" },
          ].map((stat, i) => (
            <div key={i} className="bg-background/60 backdrop-blur-xl border border-foreground/5 p-6 rounded-xl hover:border-primary/20 transition-colors group">
              <div className="flex justify-between items-start mb-4">
                <span className="text-2xl group-hover:scale-110 transition-transform duration-300">{stat.icon}</span>
                <span className="text-xs font-mono text-foreground/40 bg-foreground/5 px-2 py-1 rounded">UPDATED NOW</span>
              </div>
              <div className="text-3xl font-bold font-heading text-foreground mb-1">{stat.value}</div>
              <div className="text-sm text-foreground/60">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Recent Activity / Quick Actions Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-background/60 backdrop-blur-xl border border-foreground/5 rounded-xl p-6">
            <h3 className="text-lg font-bold font-heading mb-4">Recent Announcements</h3>
            <div className="space-y-4">
              {[1, 2, 3].map((_, i) => (
                <div key={i} className="flex gap-4 items-start p-3 hover:bg-foreground/5 rounded-lg transition-colors cursor-pointer">
                  <div className="w-2 h-2 mt-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm text-foreground">General Meeting Scheduled</h4>
                    <p className="text-xs text-foreground/60 mt-1">The monthly general meeting will be held at the main auditorium...</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-background/60 backdrop-blur-xl border border-foreground/5 rounded-xl p-6">
            <h3 className="text-lg font-bold font-heading mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-4 rounded-lg border border-foreground/10 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
                <span className="block text-xl mb-2 group-hover:translate-x-1 transition-transform">📖</span>
                <span className="font-bold text-sm">Reserve Book</span>
              </button>
              <button className="p-4 rounded-lg border border-foreground/10 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
                <span className="block text-xl mb-2 group-hover:translate-x-1 transition-transform">🎫</span>
                <span className="font-bold text-sm">Event Ticket</span>
              </button>
              <button className="p-4 rounded-lg border border-foreground/10 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
                <span className="block text-xl mb-2 group-hover:translate-x-1 transition-transform">🗳️</span>
                <span className="font-bold text-sm">Vote Now</span>
              </button>
              <button className="p-4 rounded-lg border border-foreground/10 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
                <span className="block text-xl mb-2 group-hover:translate-x-1 transition-transform">💬</span>
                <span className="font-bold text-sm">Contact Excos</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
