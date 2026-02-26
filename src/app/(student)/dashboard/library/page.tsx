"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useToast } from "@/components/ui/Toast";
import Pagination from "@/components/ui/Pagination";

/* ─── Types ─────────────────────────────────────────────────────── */

interface Resource {
  _id: string;
  title: string;
  description: string;
  type: string;
  courseCode: string;
  level: number;
  semester?: string | null;
  url: string;
  driveFileId?: string;
  youtubeVideoId?: string;
  fileType?: string;
  fileSize?: number;
  uploadedBy: string;
  uploaderName: string;
  tags: string[];
  viewCount: number;
  isApproved: boolean;
  feedback?: string;
  createdAt: string;
}

/* ─── Constants ─────────────────────────────────────────────────── */

const RESOURCE_TYPES = [
  { value: "all", label: "All Types" },
  { value: "slide", label: "Slides" },
  { value: "pastQuestion", label: "Past Questions" },
  { value: "note", label: "Notes" },
  { value: "textbook", label: "Textbooks" },
  { value: "video", label: "Videos" },
];

const SEMESTERS = [
  { value: "all", label: "All Semesters" },
  { value: "first", label: "1st Semester" },
  { value: "second", label: "2nd Semester" },
];

const LEVELS: Array<{ value: "all" | number; label: string }> = [
  { value: "all", label: "All Levels" },
  { value: 100, label: "100L" },
  { value: 200, label: "200L" },
  { value: 300, label: "300L" },
  { value: 400, label: "400L" },
  { value: 500, label: "500L" },
];

const typeAccents: Record<string, { bg: string; text: string }> = {
  slide: { bg: "bg-lavender", text: "text-snow" },
  pastQuestion: { bg: "bg-coral", text: "text-snow" },
  note: { bg: "bg-teal", text: "text-snow" },
  textbook: { bg: "bg-sunny", text: "text-navy" },
  video: { bg: "bg-navy", text: "text-snow" },
};

const cardRotations = ["", "rotate-[0.4deg]", "rotate-[-0.3deg]", "", "rotate-[0.3deg]", "rotate-[-0.4deg]"];

/* ─── Helpers ───────────────────────────────────────────────────── */

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

/* ─── Component ─────────────────────────────────────────────────── */

export default function LibraryPage() {
  const { user, userProfile, getAccessToken } = useAuth();

  // Parse student's own level (e.g. "300L" → 300 or numeric)
  const studentLevel = parseInt(String(userProfile?.level || userProfile?.currentLevel || "0")) || null;

  const [resources, setResources] = useState<Resource[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState<number | "all">("all");
  const [semesterFilter, setSemesterFilter] = useState<"all" | "first" | "second">("all");
  const [courseCodeFilter, setCourseCodeFilter] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "viewCount">("createdAt");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<Resource[]>([]);
  const [showMySubmissions, setShowMySubmissions] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const toast = useToast();
  const PAGE_SIZE = 12;
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedCourseCode, setDebouncedCourseCode] = useState("");

  // Default upload form level to student's own level
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    type: "note",
    courseCode: "",
    level: 300,
    semester: "first" as "first" | "second",
    tags: "",
    url: "",
  });

  // Once profile loads, set the default level filter and upload form level
  useEffect(() => {
    if (studentLevel && levelFilter === "all") {
      setLevelFilter(studentLevel);
    }
    if (studentLevel) {
      setUploadForm((f) => ({ ...f, level: studentLevel }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentLevel]);

  // Debounce search query (400ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Debounce course code filter (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCourseCode(courseCodeFilter), 300);
    return () => clearTimeout(t);
  }, [courseCodeFilter]);

  // Fetch on filter / sort changes — always resets to page 1
  useEffect(() => {
    if (!user) return;
    setPage(1);
    fetchResources(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, typeFilter, levelFilter, semesterFilter, sortBy, debouncedSearch, debouncedCourseCode]);

  // Fetch on pagination (page > 1 only; page 1 handled above)
  useEffect(() => {
    if (user && page > 1) fetchResources(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Load my submissions once
  useEffect(() => {
    if (user) fetchMySubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchMySubmissions = async () => {
    if (!user) return;
    try {
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/resources/my"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) setMySubmissions(await response.json());
    } catch (error) {
      console.error("Error fetching my submissions:", error);
    }
  };

  const fetchResources = useCallback(async (p: number = page) => {
    if (!user) return;
    try {
      setIsFetching(true);
      const token = await getAccessToken();
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (levelFilter !== "all") params.append("level", levelFilter.toString());
      if (semesterFilter !== "all") params.append("semester", semesterFilter);
      if (debouncedCourseCode.trim()) params.append("courseCode", debouncedCourseCode.trim().toUpperCase());
      if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());
      params.append("sortBy", sortBy);
      params.append("approved", "true");
      params.append("pageSize", PAGE_SIZE.toString());
      params.append("page", p.toString());
      const response = await fetch(getApiUrl(`/api/v1/resources?${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setResources(data.resources);
        setTotalCount(data.total ?? data.resources.length);
        const ps = data.pageSize ?? PAGE_SIZE;
        setTotalPages(Math.max(1, Math.ceil((data.total ?? data.resources.length) / ps)));
      }
    } catch (error) {
      console.error("Error fetching resources:", error);
    } finally {
      setIsFetching(false);
      setInitialLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, typeFilter, levelFilter, semesterFilter, debouncedCourseCode, sortBy, debouncedSearch]);

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.url || !user) return;
    try {
      setUploading(true);
      const token = await getAccessToken();
      const response = await fetch(getApiUrl("/api/v1/resources/add"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(uploadForm),
      });
      if (response.ok) {
        toast.success("Resource Added", "Resource added successfully! It will appear after approval.");
        setShowUploadModal(false);
        setUploadForm({ title: "", description: "", type: "note", courseCode: "", level: studentLevel ?? 300, semester: "first", tags: "", url: "" });
        fetchResources(1);
        fetchMySubmissions();
      } else {
        const error = await response.json();
        toast.error("Upload Failed", `Failed to add resource: ${error.detail}`);
      }
    } catch (error) {
      console.error("Error adding resource:", error);
      toast.error("Upload Failed", "Failed to add resource");
    } finally {
      setUploading(false);
    }
  };

  const handleViewResource = async (resourceId: string, url: string) => {
    if (!user) return;
    // Open the resource immediately — don't block on the API call
    window.open(url, "_blank");
    // Optimistically increment viewCount in UI
    setResources((prev) =>
      prev.map((r) => r._id === resourceId ? { ...r, viewCount: r.viewCount + 1 } : r)
    );
    // Fire & forget the view tracking call
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/resources/${resourceId}/view`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Reconcile with real server count
        setResources((prev) =>
          prev.map((r) => r._id === resourceId ? { ...r, viewCount: data.viewCount } : r)
        );
      }
    } catch { /* non-critical */ }
  };

  /* ── Initial loading ── */
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-ghost">
        <DashboardHeader title="Resource Library" />
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-[3px] border-teal border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate uppercase tracking-wider">Loading resources…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Resource Library" />

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">

        {/* ═══════════════════════════════════════════════════════
            HERO BENTO
            ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
          {/* Main title card */}
          <div className="md:col-span-8 bg-teal border-[3px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[180px] flex flex-col justify-between">
            <div className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full bg-navy/8 pointer-events-none" />
            <svg className="absolute top-6 right-10 w-5 h-5 text-navy/15 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
            </svg>

            <div>
              <p className="text-[10px] font-bold text-navy/40 uppercase tracking-[0.15em] mb-2">Study Materials</p>
              <h1 className="font-display font-black text-3xl md:text-4xl text-navy leading-[0.95]">
                Resource Library
              </h1>
            </div>
            <p className="text-navy/50 text-xs font-medium mt-4">
              Past questions, lecture notes, slides &amp; videos
            </p>
          </div>

          {/* Stats + Upload */}
          <div className="md:col-span-4 flex flex-col gap-3">
            <div className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex-1 flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-lavender-light flex items-center justify-center mb-2">
                <svg className="w-4.5 h-4.5 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
                </svg>
              </div>
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">
                {levelFilter !== "all" ? `${levelFilter}L Resources` : "All Resources"}
              </p>
              <p className="font-display font-black text-3xl text-navy">{totalCount}</p>
            </div>
            {/* Submit Resource — available to all students */}
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-lime border-[3px] border-navy rounded-2xl p-5 press-3 press-navy transition-all flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-navy/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M11.47 2.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06l-3.22-3.22V16.5a.75.75 0 0 1-1.5 0V4.81L8.03 8.03a.75.75 0 0 1-1.06-1.06l4.5-4.5ZM3 15.75a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-display font-black text-sm text-navy">Add Resource</p>
                <p className="text-[10px] text-navy/50">Share materials</p>
              </div>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            SEARCH & FILTERS
            ═══════════════════════════════════════════════════════ */}
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-5 md:p-6 mb-6 shadow-[4px_4px_0_0_#000]">
          {/* Search */}
          <div className="relative mb-5">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, course code, or tag…"
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all"
            />
          </div>

          {/* Type filters */}
          <div className="mb-3">
            <p className="text-[10px] font-bold text-slate uppercase tracking-[0.12em] mb-2">Type</p>
            <div className="flex flex-wrap gap-2">
              {RESOURCE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setTypeFilter(type.value)}
                  className={`px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all rounded-xl border-[3px] ${
                    typeFilter === type.value
                      ? "bg-navy text-snow border-navy shadow-[3px_3px_0_0_#000]"
                      : "border-navy/20 text-slate hover:text-navy hover:border-navy bg-snow"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Semester filters */}
          <div className="mb-3">
            <p className="text-[10px] font-bold text-slate uppercase tracking-[0.12em] mb-2">Semester</p>
            <div className="flex flex-wrap gap-2">
              {SEMESTERS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSemesterFilter(s.value as "all" | "first" | "second")}
                  className={`px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all rounded-xl border-[3px] ${
                    semesterFilter === s.value
                      ? "bg-coral text-snow border-navy shadow-[3px_3px_0_0_#000]"
                      : "border-navy/20 text-slate hover:text-navy hover:border-navy bg-snow"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Level filters */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Level</p>
              {studentLevel && levelFilter !== studentLevel && (
                <button
                  onClick={() => setLevelFilter(studentLevel)}
                  className="text-[10px] font-bold text-teal uppercase tracking-wider hover:underline"
                >
                  Back to my level ({studentLevel}L)
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setLevelFilter(level.value)}
                  className={`px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all rounded-xl border-[3px] ${
                    levelFilter === level.value
                      ? "bg-lavender text-snow border-navy shadow-[3px_3px_0_0_#000]"
                      : "border-navy/20 text-slate hover:text-navy hover:border-navy bg-snow"
                  }`}
                >
                  {level.label}{level.value === studentLevel ? " ★" : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Course code filter */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Course</p>
              {courseCodeFilter && (
                <button
                  onClick={() => setCourseCodeFilter("")}
                  className="text-[10px] font-bold text-coral uppercase tracking-wider hover:underline"
                >
                  Clear ({courseCodeFilter.toUpperCase()})
                </button>
              )}
            </div>
            <input
              type="text"
              value={courseCodeFilter}
              onChange={(e) => setCourseCodeFilter(e.target.value)}
              placeholder="e.g. MEE 301 — or click a course badge on any card"
              className="w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all"
            />
          </div>

          {/* Sort */}
          <div>
            <p className="text-[10px] font-bold text-slate uppercase tracking-[0.12em] mb-2">Sort by</p>
            <div className="flex gap-2">
              {(["createdAt", "viewCount"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all rounded-xl border-[3px] ${
                    sortBy === s
                      ? "bg-sunny text-navy border-navy shadow-[3px_3px_0_0_#000]"
                      : "border-navy/20 text-slate hover:text-navy hover:border-navy bg-snow"
                  }`}
                >
                  {s === "createdAt" ? "Newest" : "Most Viewed"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            MY SUBMISSIONS
            ═══════════════════════════════════════════════════════ */}
        {mySubmissions.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setShowMySubmissions(!showMySubmissions)}
              className="w-full bg-snow border-[3px] border-navy rounded-3xl p-4 shadow-[4px_4px_0_0_#000] flex items-center justify-between hover:bg-ghost transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-8.583-.164 3.023 3.023 0 0 0-2.251 2.996Z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M2.25 13.5a3 3 0 0 0 3 3h1.228a3.375 3.375 0 0 1-.978-2.375v-9.75a3.375 3.375 0 0 1 3-3.357H13.5a3 3 0 0 1 3 3v1.107a3.375 3.375 0 0 1 .878 2.618v6.007a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-1.25Z" clipRule="evenodd" />
                </svg>
                <span className="font-display font-bold text-navy">
                  My Submissions ({mySubmissions.length})
                </span>
                <span className="bg-sunny-light text-navy text-label px-2 py-0.5 rounded-full border border-navy text-[10px]">
                  {mySubmissions.filter((s) => s.isApproved === false && !s.feedback).length} pending
                </span>
              </div>
              <svg className={`w-5 h-5 text-navy transition-transform ${showMySubmissions ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
              </svg>
            </button>

            {showMySubmissions && (
              <div className="mt-3 space-y-3">
                {mySubmissions.map((sub) => {
                  const accent = typeAccents[sub.type] || { bg: "bg-slate", text: "text-snow" };
                  const statusLabel = sub.isApproved ? "Approved" : (sub.feedback ? "Rejected" : "Pending");
                  const statusColor = sub.isApproved
                    ? "bg-teal text-snow"
                    : (sub.feedback ? "bg-coral text-snow" : "bg-sunny-light text-navy");

                  return (
                    <div
                      key={sub._id}
                      className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[3px_3px_0_0_#000] flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`${accent.bg} ${accent.text} text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full`}>
                            {sub.type}
                          </span>
                          <span className={`${statusColor} text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-navy`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="font-display font-bold text-navy text-sm truncate">{sub.title}</p>
                        <p className="text-xs text-slate">{sub.courseCode} &middot; Level {sub.level}</p>
                        {sub.feedback && (
                          <p className="text-xs text-coral mt-1 italic">&ldquo;{sub.feedback}&rdquo;</p>
                        )}
                      </div>
                      <p className="text-xs text-slate shrink-0">
                        {new Date(sub.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            RESOURCES GRID
            ═══════════════════════════════════════════════════════ */}
        <div className="relative">
          {isFetching && (
            <div className="absolute inset-0 bg-ghost/70 z-10 flex items-center justify-center rounded-3xl pointer-events-none">
              <div className="bg-snow border-[3px] border-navy rounded-2xl px-5 py-3 shadow-[4px_4px_0_0_#000] flex items-center gap-3">
                <div className="w-5 h-5 border-[3px] border-teal border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-navy uppercase tracking-wider">Updating…</span>
              </div>
            </div>
          )}

        {resources.length === 0 ? (
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-12 text-center shadow-[4px_4px_0_0_#000]">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-light flex items-center justify-center">
              <svg className="w-8 h-8 text-teal" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
              </svg>
            </div>
            <h3 className="font-display font-black text-xl text-navy mb-2">No resources found</h3>
            <p className="text-sm text-slate">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map((resource, index) => {
              const accent = typeAccents[resource.type] || { bg: "bg-navy", text: "text-snow" };
              const rotation = cardRotations[index % cardRotations.length];

              return (
                <article
                  key={resource._id}
                  className={`bg-snow border-[3px] border-navy rounded-3xl overflow-hidden press-3 press-black transition-all ${rotation} hover:rotate-0 group`}
                >
                  {/* Header bar */}
                  <div className="p-4 pb-3 flex items-center justify-between border-b-[3px] border-navy/10">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ${accent.bg} ${accent.text}`}>
                        {resource.type}
                      </span>
                      <span className="text-[10px] font-bold text-navy/20 uppercase tracking-wider">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate">
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                          <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clipRule="evenodd" />
                        </svg>
                        {resource.viewCount}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-3">
                    <h3 className="font-display font-black text-base text-navy line-clamp-2 leading-snug group-hover:text-navy/80 transition-colors">
                      {resource.title}
                    </h3>
                    <p className="text-xs text-slate line-clamp-2 leading-relaxed">
                      {resource.description}
                    </p>

                    {/* Tags row */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setCourseCodeFilter(resource.courseCode)}
                        className="px-2.5 py-1 rounded-lg bg-cloud text-[10px] font-bold text-navy uppercase tracking-wider hover:bg-navy hover:text-snow transition-colors"
                        title={`Filter by ${resource.courseCode}`}
                      >
                        {resource.courseCode}
                      </button>
                      <span className="px-2.5 py-1 rounded-lg bg-cloud text-[10px] font-bold text-navy/60 uppercase tracking-wider">
                        {resource.level}L
                      </span>
                      {resource.semester && (
                        <span className="px-2.5 py-1 rounded-lg bg-coral-light text-[10px] font-bold text-coral uppercase tracking-wider border border-coral/30">
                          {resource.semester === "first" ? "1st Sem" : "2nd Sem"}
                        </span>
                      )}
                      {resource.fileSize && (
                        <span className="px-2.5 py-1 rounded-lg bg-cloud text-[10px] font-bold text-slate uppercase tracking-wider">
                          {formatFileSize(resource.fileSize)}
                        </span>
                      )}
                    </div>

                    {resource.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {resource.tags.slice(0, 3).map((tag, idx) => (
                          <span key={idx} className="text-[10px] font-bold text-lavender">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-5 pb-5 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate truncate max-w-[45%]">
                      By {resource.uploaderName}
                    </span>
                    <button
                      onClick={() => handleViewResource(resource._id, resource.url)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-lime border-[3px] border-navy rounded-xl font-bold text-xs text-navy uppercase tracking-wider press-3 press-navy transition-all"
                    >
                      {resource.type === "video" ? (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                          </svg>
                          Watch
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
                            <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
                          </svg>
                          View
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {resources.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onPage={setPage} className="mt-6" />
        )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          UPLOAD MODAL
          ═══════════════════════════════════════════════════════ */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-navy/80 z-50 flex items-center justify-center px-4 pt-4 pb-20 md:p-6" onClick={() => setShowUploadModal(false)}>
          <div
            className="bg-snow border-[3px] border-navy rounded-3xl max-w-2xl w-full max-h-[80vh] md:max-h-[85vh] overflow-y-auto shadow-[4px_4px_0_0_#000]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-snow border-b-[3px] border-navy/10 rounded-t-3xl p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-light flex items-center justify-center">
                  <svg className="w-5 h-5 text-teal" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M11.47 2.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06l-3.22-3.22V16.5a.75.75 0 0 1-1.5 0V4.81L8.03 8.03a.75.75 0 0 1-1.06-1.06l4.5-4.5ZM3 15.75a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="font-display font-black text-lg text-navy">Add Resource</h2>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="w-10 h-10 rounded-xl hover:bg-cloud transition-colors flex items-center justify-center" aria-label="Close">
                <svg className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddResource} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="resource-title" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Title</label>
                <input id="resource-title" type="text" required value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all" placeholder="e.g., Thermodynamics Lecture Notes" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="resource-description" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Description</label>
                <textarea id="resource-description" required value={uploadForm.description} onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })} rows={3} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all resize-none" placeholder="Brief description of the resource…" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="resource-type" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Type</label>
                  <select id="resource-type" value={uploadForm.type} onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy focus:outline-none focus:border-teal transition-all" title="Resource type">
                    <option value="note">Note</option>
                    <option value="slide">Slide</option>
                    <option value="pastQuestion">Past Question</option>
                    <option value="textbook">Textbook</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="resource-level" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">
                    Level{studentLevel ? <span className="text-teal normal-case font-medium tracking-normal"> (defaulted to your level)</span> : ""}
                  </label>
                  <select id="resource-level" value={uploadForm.level} onChange={(e) => setUploadForm({ ...uploadForm, level: parseInt(e.target.value) })} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy focus:outline-none focus:border-teal transition-all" title="Academic level">
                    <option value={100}>100 Level</option>
                    <option value={200}>200 Level</option>
                    <option value={300}>300 Level</option>
                    <option value={400}>400 Level</option>
                    <option value={500}>500 Level</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="resource-semester" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Semester</label>
                <div className="flex gap-3">
                  {(["first", "second"] as const).map((sem) => (
                    <button
                      key={sem}
                      type="button"
                      onClick={() => setUploadForm({ ...uploadForm, semester: sem })}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold border-[3px] transition-all ${
                        uploadForm.semester === sem
                          ? "bg-coral text-snow border-navy shadow-[3px_3px_0_0_#000]"
                          : "bg-ghost border-navy text-navy hover:bg-cloud"
                      }`}
                    >
                      {sem === "first" ? "1st Semester" : "2nd Semester"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="resource-course-code" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Course Code</label>
                <input id="resource-course-code" type="text" required value={uploadForm.courseCode} onChange={(e) => setUploadForm({ ...uploadForm, courseCode: e.target.value.toUpperCase() })} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all" placeholder="e.g., MEE 301" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="resource-tags" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Tags (comma-separated)</label>
                <input id="resource-tags" type="text" value={uploadForm.tags} onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all" placeholder="e.g., thermodynamics, heat transfer, exam prep" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="resource-url" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">URL (Google Drive or YouTube)</label>
                <input id="resource-url" type="url" required value={uploadForm.url} onChange={(e) => setUploadForm({ ...uploadForm, url: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all" placeholder={uploadForm.type === "video" ? "https://www.youtube.com/watch?v=…" : "https://drive.google.com/file/d/…"} />
                <p className="text-[10px] font-medium text-slate">{uploadForm.type === "video" ? "Paste a YouTube video link" : "Paste a Google Drive shareable link"}</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowUploadModal(false)} className="flex-1 px-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider border-[3px] border-navy text-navy hover:bg-cloud transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={uploading} className="flex-1 px-4 py-3 rounded-2xl bg-teal text-snow font-bold text-xs uppercase tracking-wider border-[3px] border-navy press-3 press-black transition-all disabled:opacity-50">
                  {uploading ? "Adding…" : "Add Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
