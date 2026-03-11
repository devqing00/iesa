"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { toast } from "sonner";
import Pagination from "@/components/ui/Pagination";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import { useDrive } from "@/hooks/useDrive";
import type { DriveItem } from "@/lib/api/drive";

const DriveExplorer = dynamic(() => import("@/components/dashboard/drive/DriveExplorer"), { ssr: false });
const ResourceViewer = dynamic(() => import("@/components/dashboard/drive/ResourceViewer"), { ssr: false });

/* ─── Types ──────────────────────────────────────────────────────── */

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
  averageRating?: number;
  ratingCount?: number;
  isApproved: boolean;
  feedback?: string;
  createdAt: string;
}

/* ─── Constants ──────────────────────────────────────────────────── */

const RESOURCE_TYPES = [
  { value: "all", label: "All" },
  { value: "slide", label: "Slides" },
  { value: "pastQuestion", label: "Past Questions" },
  { value: "note", label: "Notes" },
  { value: "textbook", label: "Textbooks" },
  { value: "video", label: "Videos" },
];

const SEMESTERS = [
  { value: "all", label: "All" },
  { value: "first", label: "1st Sem" },
  { value: "second", label: "2nd Sem" },
];

const LEVELS: Array<{ value: "all" | number; label: string }> = [
  { value: "all", label: "All" },
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

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

/* ─── Filter Panel ───────────────────────────────────────────────── */

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  levelFilter: number | "all";
  setLevelFilter: (v: number | "all") => void;
  semesterFilter: "all" | "first" | "second";
  setSemesterFilter: (v: "all" | "first" | "second") => void;
  courseCodeFilter: string;
  setCourseCodeFilter: (v: string) => void;
  sortBy: "createdAt" | "viewCount" | "rating";
  setSortBy: (v: "createdAt" | "viewCount" | "rating") => void;
  studentLevel: number | null;
}

function FilterPanel({
  isOpen, onClose, anchorRef,
  typeFilter, setTypeFilter,
  levelFilter, setLevelFilter,
  semesterFilter, setSemesterFilter,
  courseCodeFilter, setCourseCodeFilter,
  sortBy, setSortBy,
  studentLevel,
}: FilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose, anchorRef]);

  const clearAll = () => {
    setTypeFilter("all");
    setLevelFilter(studentLevel ?? "all");
    setSemesterFilter("all");
    setCourseCodeFilter("");
    setSortBy("createdAt");
  };

  if (!isOpen) return null;

  const chipBase = "px-3 py-1.5 font-bold text-xs uppercase tracking-wider rounded-xl border-2 transition-all cursor-pointer";
  const chipOn = (color: string) => `${chipBase} ${color} border-navy shadow-[2px_2px_0_0_#000]`;
  const chipOff = `${chipBase} bg-snow border-navy/20 text-slate hover:text-navy hover:border-navy`;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 sm:right-0 sm:w-[520px] top-full mt-2 bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[6px_6px_0_0_#000] z-30"
    >
      {/* Type */}
      <div className="mb-4">
        <p className="text-[10px] font-bold text-slate uppercase tracking-[0.12em] mb-2">Type</p>
        <div className="flex flex-wrap gap-1.5">
          {RESOURCE_TYPES.map((t) => (
            <button key={t.value} onClick={() => setTypeFilter(t.value)}
              className={typeFilter === t.value ? chipOn("bg-navy text-snow") : chipOff}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Semester */}
      <div className="mb-4">
        <p className="text-[10px] font-bold text-slate uppercase tracking-[0.12em] mb-2">Semester</p>
        <div className="flex flex-wrap gap-1.5">
          {SEMESTERS.map((s) => (
            <button key={s.value} onClick={() => setSemesterFilter(s.value as "all" | "first" | "second")}
              className={semesterFilter === s.value ? chipOn("bg-coral text-snow") : chipOff}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Level */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <p className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Level</p>
          {studentLevel && levelFilter !== studentLevel && (
            <button onClick={() => setLevelFilter(studentLevel)}
              className="text-[10px] font-bold text-teal uppercase tracking-wider hover:underline">
              My level ({studentLevel}L)
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((l) => (
            <button key={l.value} onClick={() => setLevelFilter(l.value)}
              className={levelFilter === l.value ? chipOn("bg-lavender text-snow") : chipOff}>
              {l.label}{l.value === studentLevel ? " ★" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Course code */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <p className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Course Code</p>
          {courseCodeFilter && (
            <button onClick={() => setCourseCodeFilter("")}
              className="text-[10px] font-bold text-coral uppercase tracking-wider hover:underline">
              Clear ({courseCodeFilter.toUpperCase()})
            </button>
          )}
        </div>
        <input
          type="text"
          value={courseCodeFilter}
          onChange={(e) => setCourseCodeFilter(e.target.value)}
          placeholder="e.g. MEE 301"
          title="Filter by course code"
          className="w-full px-4 py-2.5 rounded-xl bg-ghost border-2 border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all"
        />
      </div>

      {/* Sort */}
      <div className="mb-4">
        <p className="text-[10px] font-bold text-slate uppercase tracking-[0.12em] mb-2">Sort By</p>
        <div className="flex flex-wrap gap-1.5">
          {(["createdAt", "viewCount", "rating"] as const).map((s) => (
            <button key={s} onClick={() => setSortBy(s)}
              className={sortBy === s ? chipOn("bg-sunny text-navy") : chipOff}>
              {s === "createdAt" ? "Newest" : s === "viewCount" ? "Most Viewed" : "Top Rated"}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t-2 border-cloud">
        <button onClick={clearAll} className="text-xs font-bold text-slate uppercase tracking-wider hover:text-coral transition-colors">
          Clear All
        </button>
        <button
          onClick={onClose}
          className="px-5 py-2 bg-lime border-2 border-navy rounded-xl font-display font-bold text-xs text-navy press-2 press-navy transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */

export default function ResourcesPage() {
  const { user, userProfile, getAccessToken } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("library");
  const drive = useDrive();

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<"library" | "drive">("library");

  // ── Library state ──
  const studentLevel = parseInt(String(userProfile?.level || userProfile?.currentLevel || "0")) || null;
  const [resources, setResources] = useState<Resource[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState<number | "all">("all");
  const [semesterFilter, setSemesterFilter] = useState<"all" | "first" | "second">("all");
  const [courseCodeFilter, setCourseCodeFilter] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "viewCount" | "rating">("createdAt");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<Resource[]>([]);
  const [showMySubmissions, setShowMySubmissions] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [bookmarkedResources, setBookmarkedResources] = useState<Resource[]>([]);
  const [ratingLoading, setRatingLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 12;
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedCourseCode, setDebouncedCourseCode] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  const [uploadForm, setUploadForm] = useState({
    title: "", description: "", type: "note", courseCode: "",
    level: 300, semester: "first" as "first" | "second", tags: "", url: "",
  });

  // Count active non-default filters
  const activeFilterCount = [
    typeFilter !== "all",
    levelFilter !== studentLevel && levelFilter !== "all",
    semesterFilter !== "all",
    !!courseCodeFilter,
    sortBy !== "createdAt",
  ].filter(Boolean).length;

  // ── Effects ──

  useEffect(() => {
    if (studentLevel && levelFilter === "all") setLevelFilter(studentLevel);
    if (studentLevel) setUploadForm((f) => ({ ...f, level: studentLevel }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentLevel]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCourseCode(courseCodeFilter), 300);
    return () => clearTimeout(t);
  }, [courseCodeFilter]);

  useEffect(() => {
    if (!user) return;
    setPage(1);
    fetchResources(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, typeFilter, levelFilter, semesterFilter, sortBy, debouncedSearch, debouncedCourseCode]);

  useEffect(() => {
    if (user && page > 1) fetchResources(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (user) fetchMySubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Library actions ──

  const fetchMySubmissions = async () => {
    if (!user) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/resources/my"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMySubmissions(await res.json());
    } catch { /* non-critical */ }
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
      const res = await fetch(getApiUrl(`/api/v1/resources?${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setResources(data.resources);
        setTotalCount(data.total ?? data.resources.length);
        const ps = data.pageSize ?? PAGE_SIZE;
        setTotalPages(Math.max(1, Math.ceil((data.total ?? data.resources.length) / ps)));
      }
    } catch { /* silent */ } finally {
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
      const res = await fetch(getApiUrl("/api/v1/resources/add"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(uploadForm),
      });
      if (res.ok) {
        toast.success("Resource Added", { description: "Resource added! It will appear after approval." });
        setShowUploadModal(false);
        setUploadForm({ title: "", description: "", type: "note", courseCode: "", level: studentLevel ?? 300, semester: "first", tags: "", url: "" });
        fetchResources(1);
        fetchMySubmissions();
      } else {
        const err = await res.json();
        toast.error("Upload Failed", { description: `Failed: ${err.detail}` });
      }
    } catch { toast.error("Upload Failed", { description: "Failed to add resource" }); }
    finally { setUploading(false); }
  };

  const handleViewResource = async (resourceId: string, url: string) => {
    if (!user) return;
    window.open(url, "_blank");
    setResources((prev) => prev.map((r) => r._id === resourceId ? { ...r, viewCount: r.viewCount + 1 } : r));
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/resources/${resourceId}/view`), {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setResources((prev) => prev.map((r) => r._id === resourceId ? { ...r, viewCount: data.viewCount } : r));
      }
    } catch { /* non-critical */ }
  };

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/resources/bookmarked"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Resource[] = await res.json();
        setBookmarkedIds(new Set(data.map((r) => r._id)));
        setBookmarkedResources(data);
      }
    } catch { /* non-critical */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => { fetchBookmarks(); }, [fetchBookmarks]);

  const handleBookmark = async (resourceId: string) => {
    if (!user) return;
    setBookmarkedIds((prev) => { const n = new Set(prev); n.has(resourceId) ? n.delete(resourceId) : n.add(resourceId); return n; });
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/resources/${resourceId}/bookmark`), {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.bookmarked) setBookmarkedIds((prev) => new Set(prev).add(resourceId));
        else setBookmarkedIds((prev) => { const n = new Set(prev); n.delete(resourceId); return n; });
        fetchBookmarks();
      }
    } catch {
      setBookmarkedIds((prev) => { const n = new Set(prev); n.has(resourceId) ? n.delete(resourceId) : n.add(resourceId); return n; });
    }
  };

  const handleRate = async (resourceId: string, rating: number) => {
    if (!user || ratingLoading) return;
    setRatingLoading(resourceId);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/resources/${resourceId}/rate`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating }),
      });
      if (res.ok) {
        const data = await res.json();
        setResources((prev) => prev.map((r) => r._id === resourceId ? { ...r, averageRating: data.averageRating, ratingCount: data.ratingCount } : r));
        toast.success("Rated!", { description: `You gave this resource ${rating} star${rating > 1 ? "s" : ""}` });
      } else toast.error("Rating Failed", { description: "Could not submit your rating" });
    } catch { toast.error("Rating Failed", { description: "Something went wrong" }); }
    finally { setRatingLoading(null); }
  };

  // ── Render ──

  if (initialLoading && activeTab === "library") {
    return (
      <div className="min-h-screen bg-ghost">
        <DashboardHeader title="Resources" />
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
      <DashboardHeader title="Resources" />
      <ToolHelpModal toolId="library" isOpen={showHelp} onClose={closeHelp} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-6">
        {/* Tab Switcher */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1.5 bg-snow border-[3px] border-navy rounded-2xl p-1.5 shadow-[3px_3px_0_0_#000]">
            <button
              onClick={() => setActiveTab("library")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all ${
                activeTab === "library" ? "bg-navy text-snow shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]" : "text-slate hover:text-navy"
              }`}
            >
              <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
              </svg>
              Library
            </button>
            <button
              onClick={() => setActiveTab("drive")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all ${
                activeTab === "drive" ? "bg-navy text-snow shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]" : "text-slate hover:text-navy"
              }`}
            >
              <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.71 3.5 1.15 15.04l3.56 6.46h6.92L5.07 9.96l2.64-6.46Z" />
                <path d="m8.59 3.5 6.56 12.04H21.7l-3.56-6.5L14.59 3.5H8.59Z" opacity=".8" />
                <path d="M15.41 16.04H8.29l-3.58 5.96h13.28l-2.58-5.96Z" opacity=".6" />
              </svg>
              Drive
            </button>
          </div>
          <HelpButton onClick={openHelp} />
        </div>

        {/* ══════════════════════ LIBRARY TAB ══════════════════════ */}
        {activeTab === "library" && (
          <>
            {/* Hero bento */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
              <div className="md:col-span-8 bg-teal border-[3px] border-navy rounded-[2rem] p-8 md:p-10 relative overflow-hidden min-h-[160px] flex flex-col justify-between">
                <div className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full bg-navy/8 pointer-events-none" />
                <svg className="absolute top-6 right-10 w-5 h-5 text-navy/15 pointer-events-none" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
                </svg>
                <div>
                  <p className="text-[10px] font-bold text-navy/40 uppercase tracking-[0.15em] mb-2">Student Materials</p>
                  <h1 className="font-display font-black text-3xl md:text-4xl text-navy leading-[0.95]">
                    <span className="brush-highlight brush-lime">Resource</span> Library
                  </h1>
                </div>
                <p className="text-navy/50 text-xs font-medium mt-4">Past questions · Lecture notes · Slides · Videos</p>
              </div>
              <div className="md:col-span-4 flex flex-col gap-3">
                <div className="bg-snow border-[3px] border-navy rounded-2xl p-5 shadow-[3px_3px_0_0_#000] flex-1 flex flex-col justify-between">
                  <div className="w-9 h-9 rounded-xl bg-lavender-light flex items-center justify-center mb-2">
                    <svg aria-hidden="true" className="w-4 h-4 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
                    </svg>
                  </div>
                  <p className="text-[10px] font-bold text-slate uppercase tracking-[0.1em]">
                    {levelFilter !== "all" ? `${levelFilter}L Resources` : "All Resources"}
                  </p>
                  <p className="font-display font-black text-3xl text-navy">{totalCount}</p>
                </div>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-lime border-[3px] border-navy rounded-2xl p-5 press-3 press-navy transition-all flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-navy/10 flex items-center justify-center shrink-0">
                    <svg aria-hidden="true" className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor">
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

            {/* Search + Filter button row */}
            <div className="bg-snow border-[3px] border-navy rounded-3xl p-4 md:p-5 mb-6 shadow-[4px_4px_0_0_#000]">
              <div className="flex gap-3 items-center">
                {/* Search */}
                <div className="relative flex-1">
                  <svg aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, course code, tag…"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all"
                  />
                </div>

                {/* Filters button */}
                <div className="relative">
                  <button
                    ref={filterBtnRef}
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-2xl border-[3px] border-navy font-display font-bold text-sm press-3 press-navy transition-all ${
                      showFilters ? "bg-navy text-snow" : "bg-ghost text-navy hover:bg-cloud"
                    }`}
                  >
                    <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M3.792 2.938A49.069 49.069 0 0 1 12 2.25c2.797 0 5.54.236 8.209.688a1.857 1.857 0 0 1 1.541 1.836v1.044a3 3 0 0 1-.879 2.121l-6.182 6.182a1.5 1.5 0 0 0-.439 1.061v2.927a3 3 0 0 1-1.658 2.684l-1.5.75a3 3 0 0 1-4.342-2.684V15.19a1.5 1.5 0 0 0-.44-1.061L2.879 7.947A3 3 0 0 1 2 5.826V4.782a1.857 1.857 0 0 1 1.792-1.844Z" clipRule="evenodd" />
                    </svg>
                    <span className="hidden sm:inline">Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-coral text-snow text-[10px] font-black flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  <FilterPanel
                    isOpen={showFilters}
                    onClose={() => setShowFilters(false)}
                    anchorRef={filterBtnRef}
                    typeFilter={typeFilter} setTypeFilter={setTypeFilter}
                    levelFilter={levelFilter} setLevelFilter={setLevelFilter}
                    semesterFilter={semesterFilter} setSemesterFilter={setSemesterFilter}
                    courseCodeFilter={courseCodeFilter} setCourseCodeFilter={setCourseCodeFilter}
                    sortBy={sortBy} setSortBy={setSortBy}
                    studentLevel={studentLevel}
                  />
                </div>
              </div>

              {/* Active filter chips row */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t-2 border-cloud">
                  {typeFilter !== "all" && (
                    <span className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-navy/8 rounded-lg text-[10px] font-bold text-navy uppercase tracking-wider">
                      {RESOURCE_TYPES.find(t => t.value === typeFilter)?.label}
                      <button onClick={() => setTypeFilter("all")} title="Remove type filter" className="ml-0.5 text-slate hover:text-navy">
                        <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                      </button>
                    </span>
                  )}
                  {semesterFilter !== "all" && (
                    <span className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-coral-light rounded-lg text-[10px] font-bold text-coral uppercase tracking-wider">
                      {semesterFilter === "first" ? "1st Sem" : "2nd Sem"}
                      <button onClick={() => setSemesterFilter("all")} title="Remove semester filter" className="ml-0.5 text-coral hover:text-coral/70">
                        <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                      </button>
                    </span>
                  )}
                  {levelFilter !== "all" && levelFilter !== studentLevel && (
                    <span className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-lavender-light rounded-lg text-[10px] font-bold text-lavender uppercase tracking-wider">
                      {levelFilter}L
                      <button onClick={() => setLevelFilter(studentLevel ?? "all")} title="Remove level filter" className="ml-0.5 text-lavender hover:text-lavender/70">
                        <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                      </button>
                    </span>
                  )}
                  {courseCodeFilter && (
                    <span className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-cloud rounded-lg text-[10px] font-bold text-navy uppercase tracking-wider">
                      {courseCodeFilter.toUpperCase()}
                      <button onClick={() => setCourseCodeFilter("")} title="Remove course filter" className="ml-0.5 text-slate hover:text-navy">
                        <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                      </button>
                    </span>
                  )}
                  {sortBy !== "createdAt" && (
                    <span className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-sunny-light rounded-lg text-[10px] font-bold text-navy uppercase tracking-wider">
                      {sortBy === "viewCount" ? "Most Viewed" : "Top Rated"}
                      <button onClick={() => setSortBy("createdAt")} title="Remove sort filter" className="ml-0.5 text-slate hover:text-navy">
                        <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* My Submissions */}
            {mySubmissions.length > 0 && (
              <div className="mb-6">
                <button
                  onClick={() => setShowMySubmissions(!showMySubmissions)}
                  className="w-full bg-snow border-[3px] border-navy rounded-3xl p-4 shadow-[4px_4px_0_0_#000] flex items-center justify-between hover:bg-ghost transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg aria-hidden="true" className="w-5 h-5 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-8.583-.164 3.023 3.023 0 0 0-2.251 2.996Z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M2.25 13.5a3 3 0 0 0 3 3h1.228a3.375 3.375 0 0 1-.978-2.375v-9.75a3.375 3.375 0 0 1 3-3.357H13.5a3 3 0 0 1 3 3v1.107a3.375 3.375 0 0 1 .878 2.618v6.007a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-1.25Z" clipRule="evenodd" />
                    </svg>
                    <span className="font-display font-bold text-navy">My Submissions ({mySubmissions.length})</span>
                    <span className="bg-sunny-light text-navy text-label px-2 py-0.5 rounded-full border border-navy text-[10px]">
                      {mySubmissions.filter((s) => s.isApproved === false && !s.feedback).length} pending
                    </span>
                  </div>
                  <svg aria-hidden="true" className={`w-5 h-5 text-navy transition-transform ${showMySubmissions ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                </button>
                {showMySubmissions && (
                  <div className="mt-3 space-y-3">
                    {mySubmissions.map((sub) => {
                      const accent = typeAccents[sub.type] || { bg: "bg-slate", text: "text-snow" };
                      const statusLabel = sub.isApproved ? "Approved" : (sub.feedback ? "Rejected" : "Pending");
                      const statusColor = sub.isApproved ? "bg-teal text-snow" : (sub.feedback ? "bg-coral text-snow" : "bg-sunny-light text-navy");
                      return (
                        <div key={sub._id} className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[3px_3px_0_0_#000] flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`${accent.bg} ${accent.text} text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full`}>{sub.type}</span>
                              <span className={`${statusColor} text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-navy`}>{statusLabel}</span>
                            </div>
                            <p className="font-display font-bold text-navy text-sm truncate">{sub.title}</p>
                            <p className="text-xs text-slate">{sub.courseCode} · Level {sub.level}</p>
                            {sub.feedback && <p className="text-xs text-coral mt-1 italic">&ldquo;{sub.feedback}&rdquo;</p>}
                          </div>
                          <p className="text-xs text-slate shrink-0">{new Date(sub.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Bookmarks */}
            {bookmarkedIds.size > 0 && (
              <div className="mb-6">
                <button
                  onClick={() => setShowBookmarked(!showBookmarked)}
                  className="w-full bg-snow border-[3px] border-navy rounded-3xl p-4 shadow-[4px_4px_0_0_#000] flex items-center justify-between hover:bg-ghost transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg aria-hidden="true" className="w-5 h-5 text-coral" viewBox="0 0 24 24" fill="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                    </svg>
                    <span className="font-display font-bold text-navy">Bookmarked ({bookmarkedIds.size})</span>
                  </div>
                  <svg aria-hidden="true" className={`w-5 h-5 text-navy transition-transform ${showBookmarked ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                </button>
                {showBookmarked && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {bookmarkedResources.map((bk) => {
                      const accent = typeAccents[bk.type] || { bg: "bg-navy", text: "text-snow" };
                      return (
                        <div key={bk._id} className="bg-snow border-[3px] border-navy rounded-2xl p-4 shadow-[3px_3px_0_0_#000] flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`${accent.bg} ${accent.text} text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full`}>{bk.type}</span>
                            <span className="text-[10px] font-bold text-slate">{bk.courseCode}</span>
                          </div>
                          <p className="font-display font-bold text-navy text-sm truncate">{bk.title}</p>
                          <div className="flex items-center justify-between mt-auto">
                            <button onClick={() => handleBookmark(bk._id)} className="text-[10px] font-bold text-coral uppercase tracking-wider hover:underline">Remove</button>
                            <button onClick={() => handleViewResource(bk._id, bk.url)} className="px-3 py-1.5 bg-lime border-2 border-navy rounded-lg font-bold text-[10px] text-navy uppercase tracking-wider press-2 press-navy transition-all">Open</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Resources grid */}
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
                    <svg aria-hidden="true" className="w-8 h-8 text-teal" viewBox="0 0 24 24" fill="currentColor">
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
                      <article key={resource._id} className={`bg-snow border-[3px] border-navy rounded-3xl overflow-hidden press-3 press-black transition-all ${rotation} hover:rotate-0 group`}>
                        <div className="p-4 pb-3 flex items-center justify-between border-b-[3px] border-navy/10">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ${accent.bg} ${accent.text}`}>{resource.type}</span>
                            <span className="text-[10px] font-bold text-navy/20 uppercase tracking-wider">{String(index + 1).padStart(2, "0")}</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-slate">
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                              <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clipRule="evenodd" /></svg>
                              {resource.viewCount}
                            </span>
                            {(resource.ratingCount ?? 0) > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold text-sunny uppercase tracking-wider">
                                <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" /></svg>
                                {(resource.averageRating ?? 0).toFixed(1)}
                              </span>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); handleBookmark(resource._id); }} className="p-1 rounded-lg hover:bg-cloud transition-colors" title={bookmarkedIds.has(resource._id) ? "Remove bookmark" : "Bookmark"}>
                              <svg aria-hidden="true" className={`w-3.5 h-3.5 transition-colors ${bookmarkedIds.has(resource._id) ? "text-coral" : "text-slate/50 hover:text-coral"}`} viewBox="0 0 24 24" fill={bookmarkedIds.has(resource._id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={bookmarkedIds.has(resource._id) ? 0 : 2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="p-5 space-y-3">
                          <h3 className="font-display font-black text-base text-navy line-clamp-2 leading-snug group-hover:text-navy/80 transition-colors">{resource.title}</h3>
                          <p className="text-xs text-slate line-clamp-2 leading-relaxed">{resource.description}</p>
                          <div className="flex flex-wrap gap-1.5">
                            <button onClick={() => setCourseCodeFilter(resource.courseCode)} className="px-2.5 py-1 rounded-lg bg-cloud text-[10px] font-bold text-navy uppercase tracking-wider hover:bg-navy hover:text-lime hover:border-lime transition-colors" title={`Filter by ${resource.courseCode}`}>{resource.courseCode}</button>
                            <span className="px-2.5 py-1 rounded-lg bg-cloud text-[10px] font-bold text-navy/60 uppercase tracking-wider">{resource.level}L</span>
                            {resource.semester && <span className="px-2.5 py-1 rounded-lg bg-coral-light text-[10px] font-bold text-coral uppercase tracking-wider border border-coral/30">{resource.semester === "first" ? "1st Sem" : "2nd Sem"}</span>}
                            {resource.fileSize && <span className="px-2.5 py-1 rounded-lg bg-cloud text-[10px] font-bold text-slate uppercase tracking-wider">{formatFileSize(resource.fileSize)}</span>}
                          </div>
                          {resource.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {resource.tags.slice(0, 3).map((tag, idx) => <span key={idx} className="text-[10px] font-bold text-lavender">#{tag}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="px-5 pb-5 space-y-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate uppercase tracking-[0.1em] mr-1">Rate</span>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button key={star} onClick={() => handleRate(resource._id, star)} disabled={ratingLoading === resource._id} className="p-0 transition-transform hover:scale-125 disabled:opacity-50" title={`Rate ${star} star${star > 1 ? "s" : ""}`}>
                                <svg aria-hidden="true" className={`w-4 h-4 transition-colors ${star <= Math.round(resource.averageRating ?? 0) ? "text-sunny" : "text-cloud"}`} viewBox="0 0 24 24" fill="currentColor">
                                  <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                                </svg>
                              </button>
                            ))}
                            {(resource.ratingCount ?? 0) > 0 && <span className="text-[10px] text-slate ml-1">({resource.ratingCount})</span>}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate truncate max-w-[45%]">By {resource.uploaderName}</span>
                            <button
                              onClick={() => handleViewResource(resource._id, resource.url)}
                              className="flex items-center gap-2 px-4 py-2.5 bg-lime border-[3px] border-navy rounded-xl font-bold text-xs text-navy uppercase tracking-wider press-3 press-navy transition-all"
                            >
                              {resource.type === "video" ? (
                                <>
                                  <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" /></svg>
                                  Watch
                                </>
                              ) : (
                                <>
                                  <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" /></svg>
                                  View
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              {resources.length > 0 && (
                <Pagination page={page} totalPages={totalPages} onPage={setPage} className="mt-6" />
              )}
            </div>
          </>
        )}

        {/* ══════════════════════ DRIVE TAB ══════════════════════ */}
        {activeTab === "drive" && (
          <div className="max-w-4xl mx-auto overflow-hidden">
            {/* Stats bar */}
            {drive.recentFiles.length > 0 && !drive.viewingFile && (
              <div className="flex flex-wrap gap-3 mb-5">
                <div className="bg-teal-light border-2 border-teal rounded-xl px-3 py-2 flex items-center gap-2">
                  <svg aria-hidden="true" className="w-4 h-4 text-teal" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-bold text-teal">
                    {drive.recentFiles.filter((r) => (r.percentComplete || 0) >= 100).length} completed
                  </span>
                </div>
                <div className="bg-lavender-light border-2 border-lavender rounded-xl px-3 py-2 flex items-center gap-2">
                  <svg aria-hidden="true" className="w-4 h-4 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
                  </svg>
                  <span className="text-xs font-bold text-lavender">{drive.recentFiles.length} viewed</span>
                </div>
              </div>
            )}

            <DriveExplorer
              items={drive.items}
              breadcrumbs={drive.breadcrumbs}
              folderId={drive.folderId}
              rootId={drive.rootId}
              loading={drive.loading}
              error={drive.error}
              searchQuery={drive.searchQuery}
              searchResults={drive.searchResults}
              searchLoading={drive.searchLoading}
              recentFiles={drive.recentFiles}
              progressMap={drive.progressMap}
              onNavigateFolder={drive.navigateFolder}
              onOpenFile={(item: DriveItem) => drive.openFile(item)}
              onSearch={drive.setSearchQuery}
              onSearchSubmit={drive.doSearch}
              onGoBack={drive.goBack}
              notConfigured={drive.notConfigured}
            />
          </div>
        )}
      </div>

      {/* Drive: fullscreen viewer (outside tab containers) */}
      {(drive.viewingFile || drive.viewerLoading) && (
        <ResourceViewer
          key={drive.viewingFile?.id}
          meta={drive.viewingFile!}
          loading={drive.viewerLoading}
          onClose={drive.closeViewer}
          token={null}
        />
      )}

      {/* Library: upload modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-navy/80 z-[70] flex items-center justify-center px-4 py-4 sm:p-6" onClick={() => setShowUploadModal(false)}>
          <div className="bg-snow border-[3px] border-navy rounded-3xl max-w-2xl w-full max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-[4px_4px_0_0_#000]" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-snow border-b-[3px] border-navy/10 rounded-t-3xl p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-light flex items-center justify-center">
                  <svg aria-hidden="true" className="w-5 h-5 text-teal" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M11.47 2.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06l-3.22-3.22V16.5a.75.75 0 0 1-1.5 0V4.81L8.03 8.03a.75.75 0 0 1-1.06-1.06l4.5-4.5ZM3 15.75a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg>
                </div>
                <h2 className="font-display font-black text-lg text-navy">Add Resource</h2>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="w-10 h-10 rounded-xl hover:bg-cloud transition-colors flex items-center justify-center" aria-label="Close">
                <svg aria-hidden="true" className="w-5 h-5 text-slate" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <form onSubmit={handleAddResource} className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div className="space-y-1.5">
                <label htmlFor="r-title" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Title</label>
                <input id="r-title" type="text" required value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all" placeholder="e.g., Thermodynamics Lecture Notes" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="r-desc" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Description</label>
                <textarea id="r-desc" required value={uploadForm.description} onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })} rows={3} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all resize-none" placeholder="Brief description of the resource…" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="r-type" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Type</label>
                  <select id="r-type" value={uploadForm.type} onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy focus:outline-none focus:border-teal transition-all" title="Resource type">
                    <option value="note">Note</option>
                    <option value="slide">Slide</option>
                    <option value="pastQuestion">Past Question</option>
                    <option value="textbook">Textbook</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="r-level" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Level{studentLevel ? <span className="text-teal normal-case font-medium tracking-normal"> (your level)</span> : ""}</label>
                  <select id="r-level" value={uploadForm.level} onChange={(e) => setUploadForm({ ...uploadForm, level: parseInt(e.target.value) })} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy focus:outline-none focus:border-teal transition-all" title="Academic level">
                    <option value={100}>100 Level</option>
                    <option value={200}>200 Level</option>
                    <option value={300}>300 Level</option>
                    <option value={400}>400 Level</option>
                    <option value={500}>500 Level</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="r-semester" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Semester</label>
                <div className="flex gap-3">
                  {(["first", "second"] as const).map((sem) => (
                    <button key={sem} type="button" onClick={() => setUploadForm({ ...uploadForm, semester: sem })}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold border-[3px] transition-all ${uploadForm.semester === sem ? "bg-coral text-snow border-navy shadow-[3px_3px_0_0_#000]" : "bg-ghost border-navy text-navy hover:bg-cloud"}`}>
                      {sem === "first" ? "1st Semester" : "2nd Semester"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="r-course" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Course Code</label>
                <input id="r-course" type="text" required value={uploadForm.courseCode} onChange={(e) => setUploadForm({ ...uploadForm, courseCode: e.target.value.toUpperCase() })} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all" placeholder="e.g., MEE 301" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="r-tags" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">Tags (comma-separated)</label>
                <input id="r-tags" type="text" value={uploadForm.tags} onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all" placeholder="e.g., thermodynamics, heat transfer, exam prep" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="r-url" className="text-[10px] font-bold text-slate uppercase tracking-[0.12em]">URL</label>
                <input id="r-url" type="url" required value={uploadForm.url} onChange={(e) => setUploadForm({ ...uploadForm, url: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-ghost border-[3px] border-navy text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal transition-all" placeholder={uploadForm.type === "video" ? "https://www.youtube.com/watch?v=…" : "https://drive.google.com/file/d/…"} />
                <p className="text-[10px] font-medium text-slate">{uploadForm.type === "video" ? "Paste a YouTube video link" : "Paste a Google Drive shareable link"}</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowUploadModal(false)} className="flex-1 px-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider border-[3px] border-navy text-navy hover:bg-cloud transition-colors">Cancel</button>
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
