"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, Calendar, BookOpen, CreditCard, MessageSquare, TrendingUp, Users } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <DashboardHeader title="Overview" />
      
      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        {/* Hero Section with IESA AI */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-8 md:p-12 text-white shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
          
          <div className="relative z-10 max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-heading font-bold">
                  Welcome back, {user?.displayName?.split(' ')[0] || 'Engineer'}! 👋
                </h1>
              </div>
            </div>
            
            <p className="text-lg md:text-xl text-white/90 mb-6 leading-relaxed">
              Meet <span className="font-bold">IESA AI</span> — your personal campus assistant. Ask me anything about schedules, payments, events, study tips, or IESA processes. I'm here to help you succeed! 🎓
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard/iesa-ai"
                className="group flex items-center gap-3 px-6 py-3 bg-white text-primary rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                <MessageSquare className="w-5 h-5" />
                Chat with IESA AI
                <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              </Link>
              
              <button className="flex items-center gap-3 px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl font-medium hover:bg-white/20 transition-all border border-white/20">
                <TrendingUp className="w-5 h-5" />
                View My Progress
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {[
            { label: "Upcoming Events", value: "3", icon: Calendar, color: "from-blue-500 to-cyan-500" },
            { label: "Library Resources", value: "24", icon: BookOpen, color: "from-purple-500 to-pink-500" },
            { label: "Payment Status", value: "Paid", icon: CreditCard, color: "from-green-500 to-emerald-500" },
          ].map((stat, i) => (
            <div key={i} className="group relative overflow-hidden bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-6 rounded-2xl hover:border-primary/30 hover:shadow-lg transition-all">
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500`} />
              
              <div className="relative flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-mono text-foreground/40 bg-foreground/5 px-2 py-1 rounded">LIVE</span>
              </div>
              
              <div className="relative">
                <div className="text-3xl font-bold font-heading text-foreground mb-1">{stat.value}</div>
                <div className="text-sm text-foreground/60">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* Recent Announcements */}
          <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-6 hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold font-heading flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <span className="text-white text-sm">📢</span>
                </div>
                Recent Announcements
              </h3>
              <Link href="/dashboard/announcements" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </div>
            
            <div className="space-y-3">
              {[
                { title: "General Meeting This Friday", time: "2 hours ago", unread: true },
                { title: "T-Shirt Collection Starts Monday", time: "5 hours ago", unread: true },
                { title: "Career Fair Registration Open", time: "1 day ago", unread: false },
              ].map((item, i) => (
                <div key={i} className={`flex gap-4 items-start p-4 rounded-xl transition-all cursor-pointer ${item.unread ? 'bg-primary/5 hover:bg-primary/10 border border-primary/20' : 'hover:bg-foreground/5 border border-transparent'}`}>
                  <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${item.unread ? 'bg-primary' : 'bg-foreground/20'}`} />
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-foreground">{item.title}</h4>
                    <p className="text-xs text-foreground/60 mt-1">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-6">
            <h3 className="text-xl font-bold font-heading mb-6 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              Quick Actions
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Calculate CGPA", icon: "🎯", href: "/dashboard/growth/cgpa", color: "from-blue-500 to-cyan-500" },
                { label: "View Events", icon: "🎉", href: "/dashboard/events", color: "from-pink-500 to-rose-500" },
                { label: "Library", icon: "📚", href: "/dashboard/library", color: "from-amber-500 to-orange-500" },
                { label: "Payments", icon: "💳", href: "/dashboard/payments", color: "from-green-500 to-emerald-500" },
                { label: "IESA Team", icon: "👥", href: "/dashboard/team/central", color: "from-purple-500 to-violet-500" },
                { label: "My Profile", icon: "👤", href: "/dashboard/profile", color: "from-indigo-500 to-blue-500" },
              ].map((action, i) => (
                <Link
                  key={i}
                  href={action.href}
                  className="group relative overflow-hidden p-5 rounded-xl border border-foreground/10 hover:border-primary/50 bg-gradient-to-br from-foreground/5 to-transparent hover:from-primary/5 hover:to-primary/10 transition-all text-left"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                  <span className="relative block text-3xl mb-3 group-hover:scale-110 transition-transform">{action.icon}</span>
                  <span className="relative block font-bold text-sm text-foreground">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* AI Assistant Teaser */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-primary/20 p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-xl">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold font-heading mb-2 text-foreground">
                Need help with anything?
              </h3>
              <p className="text-foreground/70 mb-4">
                IESA AI knows your schedule, payment status, upcoming events, and can answer any questions about the department. Try asking "What's my next class?" or "How do I pay my dues?"
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {["Show my timetable", "Payment help", "Study tips", "Events this week"].map((q, i) => (
                  <Link
                    key={i}
                    href={`/dashboard/iesa-ai?q=${encodeURIComponent(q)}`}
                    className="px-4 py-2 rounded-lg bg-white/50 dark:bg-foreground/10 hover:bg-white dark:hover:bg-foreground/20 text-sm font-medium transition-all border border-foreground/10"
                  >
                    {q}
                  </Link>
                ))}
              </div>
            </div>
            
            <Link
              href="/dashboard/iesa-ai"
              className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
            >
              Start Chatting →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

