"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";

/* ─── Types ─────────────────────────────────────────────────────── */

interface StudyGroupMember {
  userId: string;
  firstName: string;
  lastName: string;
  matricNumber?: string;
  joinedAt: string;
}

interface StudyGroup {
  id: string;
  name: string;
  courseCode: string;
  courseName?: string;
  description?: string;
  maxMembers: number;
  meetingDay?: string;
  meetingTime?: string;
  meetingLocation?: string;
  level?: string;
  tags: string[];
  isOpen: boolean;
  createdBy: string;
  creatorName: string;
  members: StudyGroupMember[];
  createdAt: string;
  updatedAt: string;
}

type ViewMode = "browse" | "my-groups" | "create" | "detail";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const LEVELS = ["100", "200", "300", "400", "500"];
const POLL_INTERVAL = 30_000; // 30s REST polling

/* ─── Page ──────────────────────────────────────────────────────── */

export default function StudyGroupFinderPage() {
  const { showHelp, openHelp, closeHelp } = useToolHelp("study-groups");
  const { user, getAccessToken } = useAuth();
  const [view, setView] = useState<ViewMode>("browse");
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [myGroups, setMyGroups] = useState<StudyGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Form state ──────────────────────────────────────────
  const [formName, setFormName] = useState("");
  const [formCourseCode, setFormCourseCode] = useState("");
  const [formCourseName, setFormCourseName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMaxMembers, setFormMaxMembers] = useState(8);
  const [formMeetingDay, setFormMeetingDay] = useState("");
  const [formMeetingTime, setFormMeetingTime] = useState("");
  const [formMeetingLocation, setFormMeetingLocation] = useState("");
  const [formLevel, setFormLevel] = useState("");
  const [formTags, setFormTags] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const headers = useCallback(
    async () => {
      const accessToken = await getAccessToken();
      return {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      };
    },
    [getAccessToken]
  );

  /* ─── Fetch functions ──────────────────────────────────── */

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterLevel) params.set("level", filterLevel);
      params.set("open_only", "false");
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/?${params}`), {
        headers: h,
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [user, searchQuery, filterLevel, headers]);

  const fetchMyGroups = useCallback(async () => {
    if (!user) return;
    try {
      const h = await headers();
      const res = await fetch(getApiUrl("/api/v1/study-groups/my-groups"), {
        headers: h,
      });
      if (res.ok) {
        const data = await res.json();
        setMyGroups(data);
      }
    } catch {
      /* silent */
    }
  }, [user, headers]);

  // Initial load + polling
  useEffect(() => {
    fetchGroups();
    fetchMyGroups();

    pollRef.current = setInterval(() => {
      fetchGroups();
      fetchMyGroups();
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchGroups, fetchMyGroups]);

  // Re-fetch when filters change
  useEffect(() => {
    setLoading(true);
    fetchGroups();
  }, [searchQuery, filterLevel, fetchGroups]);

  /* ─── Actions ───────────────────────────────────────────── */

  const createGroup = async () => {
    if (!formName.trim() || !formCourseCode.trim()) {
      showToast("Name and course code are required");
      return;
    }
    setActionLoading(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl("/api/v1/study-groups/"), {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          name: formName.trim(),
          courseCode: formCourseCode.trim(),
          courseName: formCourseName.trim() || null,
          description: formDescription.trim() || null,
          maxMembers: formMaxMembers,
          meetingDay: formMeetingDay || null,
          meetingTime: formMeetingTime || null,
          meetingLocation: formMeetingLocation.trim() || null,
          level: formLevel || null,
          tags: formTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 5),
          isOpen: true,
        }),
      });
      if (res.ok) {
        showToast("Study group created!");
        resetForm();
        setView("my-groups");
        fetchGroups();
        fetchMyGroups();
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to create group");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const joinGroup = async (groupId: string) => {
    setActionLoading(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${groupId}/join`), {
        method: "POST",
        headers: h,
      });
      if (res.ok) {
        showToast("Joined group!");
        fetchGroups();
        fetchMyGroups();
        if (selectedGroup?.id === groupId) {
          const data = await res.json();
          setSelectedGroup(data);
        }
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to join");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const leaveGroup = async (groupId: string) => {
    setActionLoading(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${groupId}/leave`), {
        method: "POST",
        headers: h,
      });
      if (res.ok) {
        showToast("Left group");
        fetchGroups();
        fetchMyGroups();
        if (selectedGroup?.id === groupId) {
          const data = await res.json();
          setSelectedGroup(data);
        }
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to leave");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm("Delete this study group? This cannot be undone.")) return;
    setActionLoading(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${groupId}`), {
        method: "DELETE",
        headers: h,
      });
      if (res.ok) {
        showToast("Group deleted");
        setView("my-groups");
        setSelectedGroup(null);
        fetchGroups();
        fetchMyGroups();
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to delete");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormCourseCode("");
    setFormCourseName("");
    setFormDescription("");
    setFormMaxMembers(8);
    setFormMeetingDay("");
    setFormMeetingTime("");
    setFormMeetingLocation("");
    setFormLevel("");
    setFormTags("");
  };

  const userId = user?.id || "";

  const isMember = (g: StudyGroup) => g.members.some((m) => m.userId === userId);
  const isCreator = (g: StudyGroup) => g.createdBy === userId;

  /* ─── Render helpers ────────────────────────────────────── */

  const GroupCard = ({ group, compact }: { group: StudyGroup; compact?: boolean }) => {
    const member = isMember(group);
    const creator = isCreator(group);
    const full = group.members.length >= group.maxMembers;
    const spots = group.maxMembers - group.members.length;

    return (
      <div
        className={`bg-snow border-[4px] border-navy rounded-3xl p-5 press-4 press-black cursor-pointer transition-all ${
 member ?"ring-4 ring-lime/40" :""
 }`}
        onClick={() => {
          setSelectedGroup(group);
          setView("detail");
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-navy text-lime text-label-sm px-2 py-0.5 rounded-lg font-bold">
                {group.courseCode}
              </span>
              {group.level && (
                <span className="bg-lavender-light text-navy text-label-sm px-2 py-0.5 rounded-lg">
                  {group.level}L
                </span>
              )}
            </div>
            <h3 className="font-display font-black text-navy text-lg leading-tight truncate">
              {group.name}
            </h3>
          </div>
          {/* Status badge */}
          <div className="flex-shrink-0 ml-2">
            {member ? (
              <span className="bg-teal text-navy text-label-sm px-2 py-0.5 rounded-lg font-bold">
                Joined
              </span>
            ) : full ? (
              <span className="bg-coral-light text-coral text-label-sm px-2 py-0.5 rounded-lg font-bold">
                Full
              </span>
            ) : (
              <span className="bg-lime-light text-navy text-label-sm px-2 py-0.5 rounded-lg font-bold">
                {spots} spot{spots !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {!compact && group.description && (
          <p className="text-slate text-sm mb-3 line-clamp-2">{group.description}</p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap gap-2 text-xs text-slate mb-3">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {group.members.length}/{group.maxMembers}
          </span>
          {group.meetingDay && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {group.meetingDay} {group.meetingTime && `@ ${group.meetingTime}`}
            </span>
          )}
          {group.meetingLocation && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {group.meetingLocation}
            </span>
          )}
        </div>

        {/* Tags */}
        {group.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {group.tags.map((tag) => (
              <span key={tag} className="bg-ghost text-slate text-label-sm px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Creator */}
        <p className="text-xs text-cloud mt-2">
          Created by {creator ? "You" : group.creatorName}
        </p>
      </div>
    );
  };

  /* ─── Detail View ───────────────────────────────────────── */

  const DetailView = () => {
    if (!selectedGroup) return null;
    const g = selectedGroup;
    const member = isMember(g);
    const creator = isCreator(g);
    const full = g.members.length >= g.maxMembers;

    return (
      <div className="space-y-6">
        {/* Back */}
        <button
          onClick={() => setView("browse")}
          className="flex items-center gap-2 text-navy font-bold hover:text-lime transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to groups
        </button>

        {/* Main card */}
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[3px_3px_0_0_#000]">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-navy text-lime text-label px-3 py-1 rounded-xl font-bold">
                  {g.courseCode}
                </span>
                {g.level && (
                  <span className="bg-lavender-light text-navy text-label px-3 py-1 rounded-xl">
                    {g.level} Level
                  </span>
                )}
                {member && (
                  <span className="bg-teal text-navy text-label px-3 py-1 rounded-xl font-bold">
                    Member
                  </span>
                )}
              </div>
              <h2 className="font-display font-black text-navy text-2xl sm:text-3xl">{g.name}</h2>
              {g.courseName && <p className="text-slate mt-1">{g.courseName}</p>}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              {!member && !full && g.isOpen && (
                <button
                  onClick={() => joinGroup(g.id)}
                  disabled={actionLoading}
                  className="bg-lime border-[4px] border-navy press-3 press-navy px-6 py-3 rounded-2xl font-display text-base text-navy transition-all disabled:opacity-50"
                >
                  {actionLoading ? "..." : "Join Group"}
                </button>
              )}
              {member && !creator && (
                <button
                  onClick={() => leaveGroup(g.id)}
                  disabled={actionLoading}
                  className="bg-coral-light border-[3px] border-navy px-5 py-2.5 rounded-xl font-display text-sm text-navy hover:bg-coral hover:text-snow transition-all disabled:opacity-50"
                >
                  {actionLoading ? "..." : "Leave"}
                </button>
              )}
              {creator && (
                <button
                  onClick={() => deleteGroup(g.id)}
                  disabled={actionLoading}
                  className="bg-coral-light border-[3px] border-navy px-5 py-2.5 rounded-xl font-display text-sm text-navy hover:bg-coral hover:text-snow transition-all disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {g.description && (
            <p className="text-navy/80 mb-6 leading-relaxed">{g.description}</p>
          )}

          {/* Meeting info */}
          {(g.meetingDay || g.meetingTime || g.meetingLocation) && (
            <div className="bg-lime-light border-[3px] border-navy/10 rounded-2xl p-4 mb-6">
              <h3 className="font-display font-bold text-navy text-sm mb-2 uppercase tracking-wider">
                Meeting Schedule
              </h3>
              <div className="flex flex-wrap gap-4 text-sm text-navy/80">
                {g.meetingDay && (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-navy/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {g.meetingDay}
                  </span>
                )}
                {g.meetingTime && (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-navy/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {g.meetingTime}
                  </span>
                )}
                {g.meetingLocation && (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-navy/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {g.meetingLocation}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {g.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {g.tags.map((tag) => (
                <span key={tag} className="bg-lavender-light text-navy text-sm px-3 py-1 rounded-full font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Members */}
          <div>
            <h3 className="font-display font-bold text-navy mb-3">
              Members ({g.members.length}/{g.maxMembers})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {g.members.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center gap-3 bg-ghost rounded-xl px-4 py-3"
                >
                  <div className="w-8 h-8 rounded-full bg-navy text-lime flex items-center justify-center font-display font-bold text-sm">
                    {m.firstName?.[0]}
                    {m.lastName?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-navy text-sm truncate">
                      {m.firstName} {m.lastName}
                      {m.userId === g.createdBy && (
                        <span className="text-label-sm text-lime ml-1">(Creator)</span>
                      )}
                    </p>
                    {m.matricNumber && (
                      <p className="text-xs text-slate">{m.matricNumber}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-cloud mt-4">
            Created {new Date(g.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    );
  };

  /* ─── Create Form ───────────────────────────────────────── */

  const CreateForm = () => (
    <div className="space-y-6">
      <button
        onClick={() => setView("browse")}
        className="flex items-center gap-2 text-navy font-bold hover:text-lime transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[3px_3px_0_0_#000]">
        <h2 className="font-display font-black text-navy text-2xl mb-6">Create Study Group</h2>

        <div className="space-y-4">
          {/* Group name */}
          <div>
            <label className="text-label text-navy mb-1 block">
              Group Name <span className="text-coral">*</span>
            </label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Operations Research Study Squad"
              maxLength={100}
              className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lime focus:outline-none transition-colors"
            />
          </div>

          {/* Course code + name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-label text-navy mb-1 block">
                Course Code <span className="text-coral">*</span>
              </label>
              <input
                value={formCourseCode}
                onChange={(e) => setFormCourseCode(e.target.value.toUpperCase())}
                placeholder="e.g. IEN 401"
                maxLength={20}
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lime focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-label text-navy mb-1 block">Course Name</label>
              <input
                value={formCourseName}
                onChange={(e) => setFormCourseName(e.target.value)}
                placeholder="e.g. Operations Research I"
                maxLength={200}
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lime focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-label text-navy mb-1 block">Description</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="What will this group focus on? Study goals, expectations..."
              maxLength={500}
              rows={3}
              className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lime focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Level + Max Members */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-label text-navy mb-1 block">Level</label>
              <select
                value={formLevel}
                onChange={(e) => setFormLevel(e.target.value)}
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lime focus:outline-none transition-colors bg-white"
              >
                <option value="">Any level</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l} Level</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label text-navy mb-1 block">Max Members</label>
              <input
                type="number"
                value={formMaxMembers}
                onChange={(e) => setFormMaxMembers(Math.max(2, Math.min(20, Number(e.target.value))))}
                min={2}
                max={20}
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lime focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Meeting info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-label text-navy mb-1 block">Meeting Day</label>
              <select
                value={formMeetingDay}
                onChange={(e) => setFormMeetingDay(e.target.value)}
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lime focus:outline-none transition-colors bg-white"
              >
                <option value="">Select day</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label text-navy mb-1 block">Meeting Time</label>
              <input
                type="time"
                value={formMeetingTime}
                onChange={(e) => setFormMeetingTime(e.target.value)}
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lime focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-label text-navy mb-1 block">Location</label>
              <input
                value={formMeetingLocation}
                onChange={(e) => setFormMeetingLocation(e.target.value)}
                placeholder="e.g. Room 204, IE Building"
                maxLength={200}
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lime focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-label text-navy mb-1 block">Tags (comma separated)</label>
            <input
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              placeholder="e.g. exam prep, linear programming, tutorials"
              className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lime focus:outline-none transition-colors"
            />
          </div>

          {/* Submit */}
          <button
            onClick={createGroup}
            disabled={actionLoading}
            className="bg-lime border-[4px] border-navy press-3 press-navy px-8 py-4 rounded-2xl font-display text-lg text-navy transition-all disabled:opacity-50 w-full sm:w-auto"
          >
            {actionLoading ? "Creating..." : "Create Study Group"}
          </button>
        </div>
      </div>
    </div>
  );

  /* ─── Main Render ───────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader />
      <ToolHelpModal toolId="study-groups" isOpen={showHelp} onClose={closeHelp} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toast */}
        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-navy text-lime px-5 py-3 rounded-2xl border-[3px] border-lime shadow-[4px_4px_0_0_#C8F31D] font-display text-sm animate-bounce">
            {toast}
          </div>
        )}

        {/* Back to Growth Hub + Help */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/dashboard/growth"
            className="inline-flex items-center gap-2 text-navy font-bold hover:text-lime transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Growth Hub
          </Link>
          <HelpButton onClick={openHelp} />
        </div>

        {/* Title + nav */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display font-black text-navy text-3xl sm:text-4xl">
              Study Group <span className="brush-highlight">Finder</span>
            </h1>
            <p className="text-slate mt-1">Find study partners, form groups, ace together</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setView("create");
            }}
            className="bg-lime border-[4px] border-navy press-3 press-navy px-6 py-3 rounded-2xl font-display text-base text-navy transition-all"
          >
            + New Group
          </button>
        </div>

        {/* Tab navigation */}
        {view !== "create" && view !== "detail" && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setView("browse")}
              className={`px-5 py-2.5 rounded-xl font-display text-sm border-[3px] transition-all ${
                view === "browse"
                  ? "bg-navy text-lime border-navy"
                  : "bg-snow text-navy border-navy/20 hover:border-navy"
              }`}
            >
              Browse All
            </button>
            <button
              onClick={() => setView("my-groups")}
              className={`px-5 py-2.5 rounded-xl font-display text-sm border-[3px] transition-all ${
                view === "my-groups"
                  ? "bg-navy text-lime border-navy"
                  : "bg-snow text-navy border-navy/20 hover:border-navy"
              }`}
            >
              My Groups ({myGroups.length})
            </button>
          </div>
        )}

        {/* ─── BROWSE VIEW ──── */}
        {view === "browse" && (
          <div className="space-y-6">
            {/* Search + filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search groups by name, course, or tags..."
                  className="w-full pl-12 pr-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lime focus:outline-none transition-colors"
                />
              </div>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lime focus:outline-none transition-colors bg-white min-w-[140px]"
              >
                <option value="">All levels</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l} Level</option>
                ))}
              </select>
            </div>

            {/* Results */}
            {loading ? (
              <div className="text-center py-16">
                <div className="w-10 h-10 border-4 border-navy/20 border-t-lime rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate">Loading groups...</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="bg-snow border-[4px] border-navy/10 rounded-3xl p-12 text-center">
                <svg className="w-16 h-16 mx-auto text-cloud mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                <p className="text-navy font-display font-bold text-lg mb-2">No study groups found</p>
                <p className="text-slate mb-4">
                  {searchQuery || filterLevel ? "Try adjusting your filters" : "Be the first to create one!"}
                </p>
                <button
                  onClick={() => {
                    resetForm();
                    setView("create");
                  }}
                  className="bg-lime border-[4px] border-navy press-3 press-navy px-6 py-3 rounded-2xl font-display text-navy transition-all"
                >
                  + Create Study Group
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map((g) => (
                  <GroupCard key={g.id} group={g} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── MY GROUPS VIEW ──── */}
        {view === "my-groups" && (
          <div className="space-y-6">
            {myGroups.length === 0 ? (
              <div className="bg-snow border-[4px] border-navy/10 rounded-3xl p-12 text-center">
                <p className="text-navy font-display font-bold text-lg mb-2">You haven&apos;t joined any groups yet</p>
                <p className="text-slate mb-4">Browse available groups or create your own!</p>
                <button
                  onClick={() => setView("browse")}
                  className="bg-transparent border-[3px] border-navy px-6 py-3 rounded-xl font-display text-navy hover:bg-navy hover:text-lime transition-all"
                >
                  Browse Groups
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myGroups.map((g) => (
                  <GroupCard key={g.id} group={g} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── DETAIL VIEW ──── */}
        {view === "detail" && <DetailView />}

        {/* ─── CREATE VIEW ──── */}
        {view === "create" && <CreateForm />}

        {/* Privacy/info note */}
        <div className="mt-12 bg-ghost border-[3px] border-navy/10 rounded-2xl p-4 text-center text-xs text-slate">
          Study groups are visible to all logged-in students. Your name and matric number are shared with group members.
          Data refreshes every 30 seconds.
        </div>
      </main>
    </div>
  );
}
