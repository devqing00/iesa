/**
 * First-time explainer modal content for every student & admin page.
 *
 * Entries are keyed by a unique `toolId` (same convention as Growth Hub tools)
 * and consumed by the generic `<ToolHelpModal>` + `useToolHelp(toolId)` system.
 *
 * Adding an entry here + wiring up the hook in the page is all that's needed.
 */

import type { ToolHelpContent } from "./ToolHelpModal";

/* ────────────────────────────────────────────────────────
   STUDENT PAGES
   ──────────────────────────────────────────────────────── */

export const PAGE_HELP_STUDENT: Record<string, ToolHelpContent> = {
  /* ── Dashboard (home) ── */
  "student-dashboard": {
    toolId: "student-dashboard",
    title: "Your Dashboard",
    subtitle: "Your personal hub — everything at a glance",
    accentColor: "bg-lime",
    steps: [
      { icon: "sparkle", title: "Quick Overview", desc: "See today's greeting, upcoming events, and latest announcements in one place" },
      { icon: "chart", title: "Growth Snapshot", desc: "Track your habit streaks, focus sessions, and goal progress" },
      { icon: "calendar", title: "Upcoming Events", desc: "Stay on top of departmental events and deadlines" },
      { icon: "trending", title: "Announcements", desc: "Never miss important notices from the department" },
    ],
    tips: [
      "Complete your profile to unlock all features",
      "Check back daily — new announcements appear at the top",
    ],
  },

  /* ── Announcements ── */
  announcements: {
    toolId: "announcements",
    title: "Announcements",
    subtitle: "Stay updated with departmental notices and news",
    accentColor: "bg-coral",
    steps: [
      { icon: "list", title: "Browse Notices", desc: "Scroll through all announcements from the department" },
      { icon: "search", title: "Search & Filter", desc: "Use the search bar and category filters to find specific announcements" },
      { icon: "pin", title: "Pinned Items", desc: "Important announcements are pinned to the top" },
      { icon: "calendar", title: "Timeline", desc: "Announcements show when they were posted — newest first" },
    ],
    tips: [
      "Pinned announcements contain critical information — read them first",
      "Check regularly so you don't miss registration deadlines or events",
    ],
  },

  /* ── Events ── */
  events: {
    toolId: "events",
    title: "Events",
    subtitle: "Discover and register for departmental events",
    accentColor: "bg-lavender",
    steps: [
      { icon: "calendar", title: "Browse Events", desc: "See upcoming departmental events in list or calendar view" },
      { icon: "search", title: "Filter by Type", desc: "Filter events by category — academic, social, career, etc." },
      { icon: "check", title: "Register", desc: "RSVP to events you want to attend — some require payment" },
      { icon: "pin", title: "Event Details", desc: "Click any event to see full details, location, and schedule" },
    ],
    tips: [
      "Switch between list and calendar views using the toggle",
      "Some events require payment — you'll be redirected to Paystack",
      "Past events are archived but still visible for reference",
    ],
  },

  /* ── Timetable ── */
  timetable: {
    toolId: "timetable",
    title: "Timetable",
    subtitle: "View your class and exam schedule for the semester",
    accentColor: "bg-teal",
    steps: [
      { icon: "calendar", title: "Weekly View", desc: "See your classes organized by day and time slot" },
      { icon: "filter", title: "Filter by Level", desc: "Toggle your level to see only your classes" },
      { icon: "clock", title: "Today's Classes", desc: "Today's schedule is highlighted so you know what's next" },
      { icon: "book", title: "Exam Schedule", desc: "Switch to the exam tab to see your exam timetable" },
    ],
    tips: [
      "The current day is highlighted automatically",
      "Tap a class to see full details — course code, venue, and lecturer",
    ],
  },

  /* ── Payments ── */
  payments: {
    toolId: "payments",
    title: "Payments & Dues",
    subtitle: "View and pay departmental dues securely",
    accentColor: "bg-sunny",
    steps: [
      { icon: "list", title: "View Dues", desc: "See all payment dues for the current session with amounts and deadlines" },
      { icon: "check", title: "Pay Online", desc: "Click 'Pay' to be redirected to Paystack for secure card payment" },
      { icon: "save", title: "Bank Transfer", desc: "Prefer bank transfer? Submit your transfer receipt for admin review" },
      { icon: "target", title: "Payment Status", desc: "Track which dues you've paid and which are still outstanding" },
    ],
    tips: [
      "You'll be redirected to Paystack — complete payment there and you'll return automatically",
      "Bank transfers need admin approval — allow time for review",
      "Download your receipt after successful payment",
    ],
  },

  /* ── Library ── */
  library: {
    toolId: "library",
    title: "Resource Library",
    subtitle: "Access shared study materials and resources",
    accentColor: "bg-teal",
    steps: [
      { icon: "book", title: "Browse Resources", desc: "Find study materials shared by students and lecturers" },
      { icon: "search", title: "Search & Filter", desc: "Search by course code, title, or filter by category and level" },
      { icon: "save", title: "Download", desc: "Click any resource to download or open the shared link" },
      { icon: "plus", title: "Upload a Resource", desc: "Share your own study materials — they go through admin approval" },
    ],
    tips: [
      "Uploaded resources need admin approval before they appear publicly",
      "Use descriptive titles and correct course codes so others can find your materials",
    ],
  },

  /* ── Profile ── */
  profile: {
    toolId: "profile",
    title: "Your Profile",
    subtitle: "Manage your account details and preferences",
    accentColor: "bg-lime",
    steps: [
      { icon: "pencil", title: "Edit Details", desc: "Update your name, phone number, and profile picture" },
      { icon: "gear", title: "Account Info", desc: "View your matric number, email, level, and enrollment status" },
      { icon: "check", title: "Complete Onboarding", desc: "Fill in all required fields to complete your profile setup" },
      { icon: "users", title: "Roles & Permissions", desc: "See your assigned roles and active enrollments" },
    ],
    tips: [
      "A complete profile unlocks all platform features",
      "Your level is calculated automatically from your admission year",
    ],
  },

  /* ── Messages ── */
  messages: {
    toolId: "messages",
    title: "Messages",
    subtitle: "Send and receive direct messages with fellow students",
    accentColor: "bg-lavender",
    steps: [
      { icon: "users", title: "Start a Conversation", desc: "Search for a student by name and send a message request" },
      { icon: "pencil", title: "Send Messages", desc: "Once connected, you can chat freely in real-time" },
      { icon: "check", title: "Message Requests", desc: "Accept or decline incoming message requests from others" },
      { icon: "filter", title: "Block & Report", desc: "Block unwanted contacts or report inappropriate messages" },
    ],
    tips: [
      "New conversations start as message requests — the other person must accept",
      "Messages are delivered in real-time via WebSocket",
      "You can block or mute conversations from the chat menu",
    ],
  },

  /* ── IESA AI ── */
  "iesa-ai": {
    toolId: "iesa-ai",
    title: "IESA AI Assistant",
    subtitle: "Ask questions about the department, courses, and campus life",
    accentColor: "bg-teal",
    steps: [
      { icon: "bulb", title: "Ask Anything", desc: "Type a question about courses, the department, registration, or general advice" },
      { icon: "sparkle", title: "Personalised Answers", desc: "AI knows your level and department for tailored responses" },
      { icon: "list", title: "Suggested Prompts", desc: "Use the suggested prompts to get started quickly" },
      { icon: "save", title: "Chat History", desc: "Previous conversations are saved for your reference" },
    ],
    tips: [
      "Be specific with your questions for better answers",
      "Rate limit: 20 requests/hour, 60/day — use wisely",
      "AI responses are generated — always verify critical information",
    ],
  },

  /* ── Press (Dashboard) ── */
  press: {
    toolId: "press",
    title: "Association Press",
    subtitle: "Read and contribute to the departmental student blog",
    accentColor: "bg-coral",
    steps: [
      { icon: "book", title: "Read Articles", desc: "Browse published articles from fellow students" },
      { icon: "pencil", title: "Write an Article", desc: "Submit your own article for editorial review" },
      { icon: "check", title: "Review Process", desc: "Editors review submissions before they go live" },
      { icon: "trending", title: "Your Submissions", desc: "Track the status of your submitted articles" },
    ],
    tips: [
      "Articles go through an editorial review before being published",
      "Write about department life, career tips, or academic experiences",
    ],
  },

  /* ── Press Write ── */
  "press-write": {
    toolId: "press-write",
    title: "Write Article",
    subtitle: "Draft and submit articles for the Association Press",
    accentColor: "bg-sunny",
    steps: [
      { icon: "pencil", title: "Write Your Draft", desc: "Give your article a title and write the body content" },
      { icon: "list", title: "Add Tags", desc: "Tag your article with relevant topics so readers can find it" },
      { icon: "save", title: "Save as Draft", desc: "Not ready to submit? Save your work and come back later" },
      { icon: "check", title: "Submit for Review", desc: "When you're happy with it, submit for editorial review" },
    ],
    tips: [
      "Proofread before submitting — first impressions matter",
      "You can edit drafts any time before submitting",
    ],
  },

  /* ── Press Review ── */
  "press-review": {
    toolId: "press-review",
    title: "Press Review",
    subtitle: "Review and approve submitted articles (editors)",
    accentColor: "bg-lavender",
    steps: [
      { icon: "list", title: "Review Queue", desc: "See all submitted articles waiting for editorial review" },
      { icon: "search", title: "Read & Evaluate", desc: "Click an article to read the full content" },
      { icon: "check", title: "Approve or Reject", desc: "Approve articles to publish them, or reject with feedback" },
      { icon: "pencil", title: "Leave Feedback", desc: "Give authors constructive feedback on their submissions" },
    ],
    tips: [
      "This page is only visible to users with editorial permissions",
      "Rejected articles can be revised and resubmitted by the author",
    ],
  },

  /* ── Applications ── */
  applications: {
    toolId: "applications",
    title: "Applications",
    subtitle: "Apply for departmental roles, teams, and positions",
    accentColor: "bg-teal",
    steps: [
      { icon: "list", title: "Open Positions", desc: "Browse available positions and application windows" },
      { icon: "pencil", title: "Apply", desc: "Fill out and submit your application for a position" },
      { icon: "clock", title: "Track Status", desc: "Check the status of your submitted applications" },
      { icon: "check", title: "Results", desc: "See your application outcome once reviewed" },
    ],
    tips: [
      "Application windows have deadlines — apply early",
      "Make sure your profile is complete before applying",
    ],
  },

  /* ── Archive ── */
  archive: {
    toolId: "archive",
    title: "Session Archive",
    subtitle: "Browse data from past academic sessions",
    accentColor: "bg-lavender",
    steps: [
      { icon: "calendar", title: "Select a Session", desc: "Pick a previous academic session from the dropdown" },
      { icon: "list", title: "View Past Data", desc: "See announcements, events, and records from that session" },
      { icon: "search", title: "Search Archives", desc: "Search through archived content to find what you need" },
    ],
    tips: [
      "Only past sessions appear here — current session data is on the main pages",
    ],
  },

  /* ── Team – Central Excos ── */
  "team-central": {
    toolId: "team-central",
    title: "Central Executives",
    subtitle: "Meet the IESA central executive members",
    accentColor: "bg-lime",
    steps: [
      { icon: "users", title: "View Executives", desc: "See all current central executive members and their roles" },
      { icon: "search", title: "Contact Info", desc: "Find contact details for each executive member" },
    ],
    tips: [
      "Executive members are updated each session by the admin team",
    ],
  },

  /* ── Team – Class Reps ── */
  "team-class-reps": {
    toolId: "team-class-reps",
    title: "Class Representatives",
    subtitle: "Find your level's class representatives",
    accentColor: "bg-teal",
    steps: [
      { icon: "users", title: "By Level", desc: "See class reps organized by level (100L–500L)" },
      { icon: "search", title: "Contact Info", desc: "Find your rep's name and contact details" },
    ],
    tips: [
      "Contact your class rep for level-specific concerns",
    ],
  },

  /* ── Class Rep Portal ── */
  "class-rep-portal": {
    toolId: "class-rep-portal",
    title: "Class Rep Portal",
    subtitle: "Coordinate your level's communication, deadlines, and class updates",
    accentColor: "bg-lavender",
    steps: [
      { icon: "chart", title: "Overview", desc: "Track your level stats, deadline count, and active polls in one place" },
      { icon: "users", title: "Cohort Directory", desc: "Search and export your level's student list for coordination" },
      { icon: "clock", title: "Deadlines", desc: "Create, update, and remove assignment or test deadlines for your class" },
      { icon: "list", title: "Polls & Relay", desc: "Run quick polls and post class updates on the relay board" },
    ],
    tips: [
      "Use clear course codes in deadlines so students can act quickly",
      "Close polls when decisions are finalized to keep results clean",
    ],
  },

  /* ── Freshers Coordinator Portal ── */
  "freshers-portal": {
    toolId: "freshers-portal",
    title: "Freshers Coordinator Portal",
    subtitle: "Manage your freshers cohort with deadlines, polls, and broadcast updates",
    accentColor: "bg-sunny",
    steps: [
      { icon: "chart", title: "Cohort Snapshot", desc: "See enrollment totals and active class activities at a glance" },
      { icon: "clock", title: "Important Deadlines", desc: "Publish key onboarding and academic deadlines for freshers" },
      { icon: "list", title: "Pulse Checks", desc: "Create polls to collect quick feedback from your cohort" },
      { icon: "users", title: "Announcements", desc: "Send focused updates to keep freshers informed and aligned" },
    ],
    tips: [
      "Keep announcements concise and action-focused for better response rates",
      "Use deadlines tab for time-sensitive items and relay board for context",
    ],
  },

  /* ── Team Head Portal ── */
  "team-head-portal": {
    toolId: "team-head-portal",
    title: "Team Head Portal",
    subtitle: "Lead your unit members, noticeboard updates, and task execution",
    accentColor: "bg-teal",
    steps: [
      { icon: "users", title: "Members", desc: "View and search everyone in your headed unit" },
      { icon: "pin", title: "Noticeboard", desc: "Post important notices and pin critical updates for your team" },
      { icon: "check", title: "Task Management", desc: "Assign tasks, set due dates, and track completion status" },
      { icon: "chart", title: "Analytics", desc: "Review completion rates and activity trends to improve delivery" },
    ],
    tips: [
      "Pin only high-priority notices so your board stays useful",
      "Review analytics weekly to catch overdue workload early",
    ],
  },

  /* ── Team – Teams ── */
  "team-committees": {
    toolId: "team-committees",
    title: "Teams",
    subtitle: "Explore active departmental teams and their members",
    accentColor: "bg-lavender",
    steps: [
      { icon: "users", title: "Browse Teams", desc: "See all active teams with their descriptions" },
      { icon: "list", title: "View Members", desc: "Click a team to see its members and coordinators" },
    ],
    tips: [
      "Interested in joining a team? Apply through the Applications page",
    ],
  },

  /* ── IEPOD Hub ── */
  iepod: {
    toolId: "iepod",
    title: "IEPOD Hub",
    subtitle: "Industrial Engineering Orientation Programme for freshers",
    accentColor: "bg-coral",
    steps: [
      { icon: "check", title: "Register", desc: "Sign up for the IEPOD programme if you haven't already" },
      { icon: "list", title: "Programme Phases", desc: "Follow the structured orientation phases step by step" },
      { icon: "target", title: "Quizzes & Challenges", desc: "Complete quizzes and tasks for each phase" },
      { icon: "users", title: "Team Activities", desc: "Join a team for the hackathon and group projects" },
    ],
    tips: [
      "IEPOD is required for freshers — complete all phases",
      "Check back regularly for new quizzes and team assignments",
    ],
  },

  /* ── IEPOD Quizzes ── */
  "iepod-quizzes": {
    toolId: "iepod-quizzes",
    title: "Quizzes & Challenges",
    subtitle: "Test your knowledge with IEPOD phase quizzes",
    accentColor: "bg-sunny",
    steps: [
      { icon: "list", title: "Available Quizzes", desc: "See all quizzes assigned to your current IEPOD phase" },
      { icon: "pencil", title: "Take a Quiz", desc: "Answer questions within the time limit" },
      { icon: "chart", title: "View Results", desc: "See your score and correct answers after submission" },
    ],
    tips: [
      "Each quiz can only be attempted once — read questions carefully",
      "Time limits are enforced — manage your time wisely",
    ],
  },

  /* ── IEPOD Team ── */
  "iepod-team": {
    toolId: "iepod-team",
    title: "Teams & Hackathon",
    subtitle: "Form teams and participate in the IEPOD hackathon",
    accentColor: "bg-teal",
    steps: [
      { icon: "users", title: "Join a Team", desc: "Join or create a team for the hackathon challenge" },
      { icon: "list", title: "Team Members", desc: "View your team members and their roles" },
      { icon: "target", title: "Hackathon Tasks", desc: "Complete team tasks and submit deliverables" },
    ],
    tips: [
      "Teams are assigned by the IEPOD coordinators",
      "Collaborate with your team to produce the best project",
    ],
  },

  /* ── IEPOD Niche Audit ── */
  "iepod-niche-audit": {
    toolId: "iepod-niche-audit",
    title: "Niche Audit",
    subtitle: "Discover your Industrial Engineering specialisation path",
    accentColor: "bg-lavender",
    steps: [
      { icon: "search", title: "Take the Audit", desc: "Answer a series of questions about your interests and strengths" },
      { icon: "chart", title: "Get Results", desc: "See your recommended IE specialisation based on your responses" },
      { icon: "target", title: "Explore Paths", desc: "Learn about different IE niches and career options" },
    ],
    tips: [
      "Answer honestly — the audit is for your benefit, not graded",
      "You can retake the audit if your interests change",
    ],
  },

  /* ── TIMP ── */
  timp: {
    toolId: "timp",
    title: "TIMP",
    subtitle: "Technical & Industry Mentorship Programme",
    accentColor: "bg-teal",
    steps: [
      { icon: "users", title: "Apply as Mentee", desc: "Submit your application to be matched with an industry mentor" },
      { icon: "check", title: "Track Application", desc: "See your application status — pending, matched, or declined" },
      { icon: "target", title: "Your Mentor Pair", desc: "Once matched, view your mentor's profile and contact details" },
    ],
    tips: [
      "TIMP applications open once per session — check deadlines",
      "Fill in your detailed interests so you get the best mentor match",
    ],
  },

  /* ── Teams ── */
  units: {
    toolId: "units",
    title: "Teams",
    subtitle: "Browse the organisational teams of the department",
    accentColor: "bg-lime",
    steps: [
      { icon: "list", title: "View Teams", desc: "See all departmental teams and bodies" },
      { icon: "users", title: "Team Members", desc: "Click a team to see its members and coordinators" },
      { icon: "search", title: "Explore Roles", desc: "Learn about what each team does and how to get involved" },
    ],
    tips: [
      "Interested in joining? Apply through the Applications page when positions open",
    ],
  },

  /* ── Hubs ── */
  hubs: {
    toolId: "hubs",
    title: "Hubs",
    subtitle: "Explore specialised spaces and communities",
    accentColor: "bg-sunny",
    steps: [
      { icon: "list", title: "Browse Hubs", desc: "See available hubs and their descriptions" },
      { icon: "search", title: "Explore", desc: "Click a hub to learn more and find resources" },
    ],
    tips: [
      "Hubs are organised around topics and interests within the department",
    ],
  },

  /* ── Settings ── */
  settings: {
    toolId: "settings",
    title: "Settings",
    subtitle: "Customise your account and notification preferences",
    accentColor: "bg-lime",
    steps: [
      { icon: "gear", title: "Account Settings", desc: "Change your password and manage security options" },
      { icon: "pencil", title: "Notification Preferences", desc: "Choose which notifications you want to receive" },
      { icon: "users", title: "Connected Accounts", desc: "Manage social logins and linked accounts" },
    ],
    tips: [
      "Use a strong, unique password for your account",
      "Review your notification settings to avoid alert fatigue",
    ],
  },

  /* ── Growth Hub (landing) ── */
  "growth-hub": {
    toolId: "growth-hub",
    title: "Growth Hub",
    subtitle: "Your personal toolkit for academic and personal development",
    accentColor: "bg-lime",
    steps: [
      { icon: "trending", title: "Choose a Tool", desc: "Pick from 9 tools: habits, CGPA, timer, flashcards, journal, planner, courses, goals, and study groups" },
      { icon: "chart", title: "Track Progress", desc: "Each tool tracks your history and progress over time" },
      { icon: "save", title: "Data Sync", desc: "Your data syncs to the cloud — accessible from any device" },
      { icon: "sparkle", title: "Build Consistency", desc: "Use tools daily to build productive academic habits" },
    ],
    tips: [
      "Start with 1-2 tools and add more as you build the habit",
      "The CGPA calculator and planner are great for semester planning",
      "Data syncs automatically — look for the sync status badge",
    ],
  },
};

/* ────────────────────────────────────────────────────────
   ADMIN PAGES
   ──────────────────────────────────────────────────────── */

export const PAGE_HELP_ADMIN: Record<string, ToolHelpContent> = {
  /* ── Admin Dashboard ── */
  "admin-dashboard": {
    toolId: "admin-dashboard",
    title: "Admin Dashboard",
    subtitle: "Overview of platform activity and key metrics",
    accentColor: "bg-lime",
    steps: [
      { icon: "chart", title: "Key Metrics", desc: "View total students, active enrolments, payments collected, and more" },
      { icon: "trending", title: "Engagement Stats", desc: "Track student activity and platform usage trends" },
      { icon: "calendar", title: "Active Session", desc: "See the current academic session and its status" },
      { icon: "list", title: "Quick Actions", desc: "Jump to frequently used admin pages from the dashboard cards" },
    ],
    tips: [
      "Dashboard data refreshes automatically — pull down to force refresh",
      "Click any metric card to go to the detailed management page",
    ],
  },

  /* ── Admin Announcements ── */
  "admin-announcements": {
    toolId: "admin-announcements",
    title: "Manage Announcements",
    subtitle: "Create, edit, pin, and delete departmental announcements",
    accentColor: "bg-coral",
    steps: [
      { icon: "plus", title: "Create Announcement", desc: "Write a new announcement with title, content, and category" },
      { icon: "pin", title: "Pin Important Ones", desc: "Pin announcements to keep them at the top of the student feed" },
      { icon: "pencil", title: "Edit Existing", desc: "Update any announcement's content or settings" },
      { icon: "filter", title: "Filter & Search", desc: "Find specific announcements by title, category, or date" },
    ],
    tips: [
      "Pinned announcements appear first for all students",
      "Use clear, concise titles — students scan headers first",
      "Announcements are tied to the active session",
    ],
  },

  /* ── Admin Events ── */
  "admin-events": {
    toolId: "admin-events",
    title: "Manage Events",
    subtitle: "Create and manage departmental events with registration",
    accentColor: "bg-lavender",
    steps: [
      { icon: "plus", title: "Create Event", desc: "Set up an event with title, date, location, category, and optional payment" },
      { icon: "pencil", title: "Edit Events", desc: "Update event details, change status, or modify registration settings" },
      { icon: "users", title: "View Registrations", desc: "See who has registered for each event" },
      { icon: "filter", title: "Filter by Status", desc: "Filter events by upcoming, ongoing, or past" },
    ],
    tips: [
      "Paid events integrate with Paystack — set the price during event creation",
      "Cancel or reschedule events by editing their status",
    ],
  },

  /* ── Admin Users ── */
  "admin-users": {
    toolId: "admin-users",
    title: "User Management",
    subtitle: "View, search, and manage all registered users",
    accentColor: "bg-teal",
    steps: [
      { icon: "users", title: "Browse Users", desc: "See all registered students and admins with their details" },
      { icon: "search", title: "Search & Filter", desc: "Search by name, email, matric number, or filter by role and level" },
      { icon: "gear", title: "Manage Roles", desc: "Assign or remove admin roles from the user detail panel" },
      { icon: "pencil", title: "Edit User", desc: "Update user details, role, academic info, and account status" },
      { icon: "trash", title: "Delete User", desc: "Permanently remove a user account after confirmation" },
    ],
    tips: [
      "Use the search bar for quick lookups — it searches across name, email, and matric",
      "Role changes take effect immediately",
      "Deleting a user is permanent and also removes related user data (with financial records anonymized for audit)",
    ],
  },

  /* ── Admin Roles ── */
  "admin-roles": {
    toolId: "admin-roles",
    title: "Role Management",
    subtitle: "Create and configure permission-based roles",
    accentColor: "bg-sunny",
    steps: [
      { icon: "gear", title: "View Roles", desc: "See all defined roles and their permission sets" },
      { icon: "plus", title: "Create Role", desc: "Define new roles with specific permission scopes" },
      { icon: "pencil", title: "Edit Permissions", desc: "Modify which permissions are granted by each role" },
      { icon: "users", title: "Assign Roles", desc: "Roles are assigned to users from the Users page" },
    ],
    tips: [
      "Permissions follow the scope:action pattern (e.g. announcement:create)",
      "Super Admin has all permissions by default",
    ],
  },

  /* ── Admin Payments ── */
  "admin-payments": {
    toolId: "admin-payments",
    title: "Payment Management",
    subtitle: "Manage dues, transactions, bank accounts, and transfers",
    accentColor: "bg-sunny",
    steps: [
      { icon: "plus", title: "Create Payment Due", desc: "Set up a new payment due with amount, deadline, and category" },
      { icon: "list", title: "View Transactions", desc: "See all Paystack transactions with student details and status" },
      { icon: "check", title: "Review Transfers", desc: "Approve or reject bank transfer submissions from students" },
      { icon: "chart", title: "Payment Analytics", desc: "Track collection rates and outstanding dues" },
    ],
    tips: [
      "Use the 4 tabs: Dues, Transactions, Bank Accounts, and Transfers",
      "Approved bank transfers automatically mark the student as paid",
      "Export payment data for financial reporting",
    ],
  },

  /* ── Admin Timetable ── */
  "admin-timetable": {
    toolId: "admin-timetable",
    title: "Timetable Management",
    subtitle: "Create and manage class and exam schedules",
    accentColor: "bg-teal",
    steps: [
      { icon: "plus", title: "Add Classes", desc: "Add class entries with course, time, venue, and day" },
      { icon: "calendar", title: "Add Exams", desc: "Schedule exams with date, time, and venue" },
      { icon: "pencil", title: "Edit Entries", desc: "Update or delete existing timetable entries" },
      { icon: "filter", title: "Filter by Level", desc: "View timetable by level or show all at once" },
    ],
    tips: [
      "Changes are visible to students immediately",
      "Use consistent venue names for clarity",
    ],
  },

  /* ── Admin Enrollments ── */
  "admin-enrollments": {
    toolId: "admin-enrollments",
    title: "Enrollment Management",
    subtitle: "Manage student enrolments for the active session",
    accentColor: "bg-lime",
    steps: [
      { icon: "plus", title: "Enroll Students", desc: "Manually enrol students for the current academic session" },
      { icon: "list", title: "View Enrolments", desc: "See all enrolled students with their status" },
      { icon: "search", title: "Search & Filter", desc: "Find students by name, matric, or filter by level" },
      { icon: "check", title: "Manage Status", desc: "Activate or deactivate enrolments as needed" },
    ],
    tips: [
      "Enrolments are tied to the active session",
      "Students must be enrolled to access session-specific features",
    ],
  },

  /* ── Admin Sessions ── */
  "admin-sessions": {
    toolId: "admin-sessions",
    title: "Session Management",
    subtitle: "Create and manage academic sessions",
    accentColor: "bg-lavender",
    steps: [
      { icon: "plus", title: "Create Session", desc: "Set up a new academic session (e.g. 2025/2026)" },
      { icon: "gear", title: "Set Active Session", desc: "Mark one session as active — this affects the entire platform" },
      { icon: "pencil", title: "Edit Sessions", desc: "Update session names, dates, or status" },
    ],
    tips: [
      "Only ONE session can be active at a time",
      "Changing the active session affects payments, enrolments, timetable, and more",
      "Past sessions are preserved for archive access",
    ],
  },

  /* ── Admin Resources ── */
  "admin-resources": {
    toolId: "admin-resources",
    title: "Resource Management",
    subtitle: "Review and manage the student resource library",
    accentColor: "bg-teal",
    steps: [
      { icon: "list", title: "Review Submissions", desc: "See resources submitted by students awaiting approval" },
      { icon: "check", title: "Approve or Reject", desc: "Approve resources to make them visible, or reject with reason" },
      { icon: "plus", title: "Add Resources", desc: "Upload resources directly to the library" },
      { icon: "pencil", title: "Edit Resources", desc: "Update metadata, links, or categories of existing resources" },
    ],
    tips: [
      "New submissions need approval before students can see them",
      "Use consistent categories and course codes for organisation",
    ],
  },

  /* ── Admin Audit Logs ── */
  "admin-audit-logs": {
    toolId: "admin-audit-logs",
    title: "Audit Logs",
    subtitle: "Track all administrative actions on the platform",
    accentColor: "bg-coral",
    steps: [
      { icon: "list", title: "Browse Logs", desc: "See a chronological log of all admin actions" },
      { icon: "search", title: "Search & Filter", desc: "Filter by action type, user, or date range" },
      { icon: "save", title: "Export Logs", desc: "Export audit log data as CSV for reporting" },
    ],
    tips: [
      "All create, update, and delete actions are logged automatically",
      "Use the date range filter for specific investigation periods",
    ],
  },

  /* ── Admin Messages ── */
  "admin-messages": {
    toolId: "admin-messages",
    title: "Message Oversight",
    subtitle: "Monitor and manage the student messaging system",
    accentColor: "bg-lavender",
    steps: [
      { icon: "list", title: "View Conversations", desc: "Browse all active conversations across the platform" },
      { icon: "search", title: "Search Messages", desc: "Search message content or filter by user" },
      { icon: "chart", title: "Message Stats", desc: "See total messages, active conversations, and unread counts" },
    ],
    tips: [
      "Admin message oversight is for moderation purposes only",
      "Use the Moderation page to handle flagged content",
    ],
  },

  /* ── Admin Moderation ── */
  "admin-moderation": {
    toolId: "admin-moderation",
    title: "Content Moderation",
    subtitle: "Review flagged messages and reports from students",
    accentColor: "bg-coral",
    steps: [
      { icon: "list", title: "Review Reports", desc: "See all reported messages and conversations" },
      { icon: "search", title: "Investigate", desc: "View the full conversation context for each report" },
      { icon: "check", title: "Take Action", desc: "Warn, mute, or ban users based on violations" },
      { icon: "filter", title: "Filter by Status", desc: "Filter reports by pending, resolved, or dismissed" },
    ],
    tips: [
      "Always review the full context before taking action",
      "Banning a user prevents them from using the messaging system",
    ],
  },

  /* ── Admin Health ── */
  "admin-health": {
    toolId: "admin-health",
    title: "System Health",
    subtitle: "Monitor backend services and platform health status",
    accentColor: "bg-teal",
    steps: [
      { icon: "chart", title: "Service Status", desc: "See the health status of the database, email, and other services" },
      { icon: "clock", title: "Response Times", desc: "Check API response times and identify bottlenecks" },
      { icon: "gear", title: "Refresh Health", desc: "Click refresh to get a fresh health check from the backend" },
    ],
    tips: [
      "Green = healthy, Yellow = degraded, Red = down",
      "Check email health if students report not receiving verification emails",
    ],
  },

  /* ── Admin IEPOD ── */
  "admin-iepod": {
    toolId: "admin-iepod",
    title: "IEPOD Management",
    subtitle: "Manage the departmental orientation programme",
    accentColor: "bg-coral",
    steps: [
      { icon: "list", title: "View Registrations", desc: "See all students registered for the IEPOD programme" },
      { icon: "plus", title: "Create Quizzes", desc: "Add quizzes and challenges for each programme phase" },
      { icon: "users", title: "Manage Teams", desc: "Create and assign teams for the hackathon component" },
      { icon: "chart", title: "Track Progress", desc: "Monitor student completion rates across all phases" },
    ],
    tips: [
      "Ensure quiz time limits are reasonable for the question count",
      "Teams can be auto-assigned or manually configured",
    ],
  },

  /* ── Admin TIMP ── */
  "admin-timp": {
    toolId: "admin-timp",
    title: "TIMP Management",
    subtitle: "Manage the Technical & Industry Mentorship Programme",
    accentColor: "bg-teal",
    steps: [
      { icon: "list", title: "View Applications", desc: "See all mentee and mentor applications" },
      { icon: "users", title: "Match Pairs", desc: "Pair mentors with mentees based on interests and availability" },
      { icon: "gear", title: "Open/Close Forms", desc: "Toggle the application form open or closed" },
      { icon: "chart", title: "Track Pairs", desc: "Monitor active mentorship pairs and their progress" },
    ],
    tips: [
      "Match mentors and mentees based on shared technical interests",
      "Close applications before starting the matching process",
    ],
  },

  /* ── Admin Teams ── */
  "admin-units": {
    toolId: "admin-units",
    title: "Team Management",
    subtitle: "Manage departmental teams, applications, and members",
    accentColor: "bg-lime",
    steps: [
      { icon: "plus", title: "Create Teams", desc: "Set up new departmental teams with descriptions and roles" },
      { icon: "list", title: "Manage Applications", desc: "Review and process student applications for team positions" },
      { icon: "users", title: "Assign Members", desc: "Add or remove members from teams" },
      { icon: "pencil", title: "Edit Teams", desc: "Update team details, descriptions, and open positions" },
    ],
    tips: [
      "Student applications route here from the student Applications page",
      "Teams can have multiple coordinators and members",
    ],
  },
};

/* ────────────────────────────────────────────────────────
   Merged map (for easy lookup from any page)
   ──────────────────────────────────────────────────────── */
export const ALL_PAGE_HELP: Record<string, ToolHelpContent> = {
  ...PAGE_HELP_STUDENT,
  ...PAGE_HELP_ADMIN,
};
