"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl, getWsUrl } from "@/lib/api";

/* ─── Types ─────────────────────────────────────────────────────── */

interface StudyGroupMember {
  userId: string;
  firstName: string;
  lastName: string;
  matricNumber?: string;
  joinedAt: string;
}

interface GroupMessage {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  text: string;
  createdAt: string;
}

interface GroupSession {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  agenda?: string;
  createdBy: string;
  creatorName: string;
  attendees: string[];
  createdAt: string;
}

interface GroupResource {
  id: string;
  title: string;
  url: string;
  type: "link" | "document" | "video";
  addedBy: string;
  addedByName: string;
  createdAt: string;
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
  pinnedNote?: string;
  messages?: GroupMessage[];
  sessions?: GroupSession[];
  resources?: GroupResource[];
  createdAt: string;
  updatedAt: string;
}

type ViewMode = "browse" | "my-groups" | "create" | "detail";
type DetailTab = "overview" | "feed" | "sessions" | "resources";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const LEVELS = ["100", "200", "300", "400", "500"];
const POLL_INTERVAL = 30_000; // 30s REST polling

/* ─── GroupChatPanel — outside parent to prevent re-mount on every keystroke ─ */

interface ChatPanelProps {
  groupId: string;
  userId: string;
  getAccessToken: () => Promise<string | null>;
}

function GroupChatPanel({ groupId, userId, getAccessToken }: ChatPanelProps) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    // Defined inside effect so it can reference itself for reconnect
    const connectWS = async (retryToken?: string) => {
      if (cancelledRef.current) return;
      const token = retryToken ?? (await getAccessToken());
      if (!token || cancelledRef.current) return;

      const wsUrl =
        getWsUrl(`/api/v1/study-groups/${groupId}/ws?token=${token}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setWsStatus("connecting");

      ws.onopen = () => setWsStatus("open");

      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          if (packet.type === "message") {
            setMessages((prev) =>
              prev.some((m) => m.id === packet.data.id) ? prev : [...prev, packet.data]
            );
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setWsStatus("closed");
        if (!cancelledRef.current) {
          reconnectRef.current = setTimeout(() => connectWS(), 4000);
        }
      };

      ws.onerror = () => ws.close();
    };

    const init = async () => {
      const token = await getAccessToken();
      if (!token || cancelledRef.current) return;
      try {
        const res = await fetch(
          getApiUrl(`/api/v1/study-groups/${groupId}/messages`),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok && !cancelledRef.current) setMessages(await res.json());
      } catch { /* silent */ }
      if (!cancelledRef.current) connectWS(token);
    };

    init();

    return () => {
      cancelledRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [groupId, getAccessToken]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    const text = inputValue.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "message", text }));
    setInputValue("");
  };

  return (
    <div className="p-6">
      {wsStatus !== "open" && (
        <div className={`flex items-center gap-2 text-xs mb-3 ${wsStatus === "connecting" ? "text-slate" : "text-coral"}`}>
          <span className={`w-2 h-2 rounded-full ${wsStatus === "connecting" ? "bg-slate animate-pulse" : "bg-coral animate-pulse"}`} />
          {wsStatus === "connecting" ? "Connecting..." : "Reconnecting..."}
        </div>
      )}
      <div className="max-h-96 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-10 h-10 mx-auto text-cloud mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .836.497 1.562 1.22 1.882" />
            </svg>
            <p className="text-slate text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.userId === userId ? "flex-row-reverse" : ""}`}>
              <div className="w-7 h-7 rounded-full bg-navy text-snow flex items-center justify-center font-display font-bold text-[10px] shrink-0" aria-hidden="true">
                {msg.firstName?.[0]}{msg.lastName?.[0]}
              </div>
              <div className={`max-w-[75%] ${msg.userId === userId ? "text-right" : ""}`}>
                <p className="text-[10px] font-bold text-navy/40 mb-0.5">
                  {msg.userId === userId ? "You" : `${msg.firstName} ${msg.lastName}`}
                  <span className="ml-2 font-normal">
                    {new Date(msg.createdAt).toLocaleString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </p>
                <div className={`inline-block px-4 py-2 rounded-2xl text-sm ${
                  msg.userId === userId ? "bg-lime text-navy rounded-tr-sm" : "bg-ghost text-navy rounded-tl-sm"
                }`}>
                  {msg.text}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Type a message..."
          maxLength={500}
          disabled={wsStatus !== "open"}
          className="flex-1 px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-teal focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={wsStatus !== "open" || !inputValue.trim()}
          className="bg-navy text-snow px-5 py-3 rounded-xl font-display font-bold text-sm disabled:opacity-40 hover:bg-navy-light transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}

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

  // ─── New feature state ────────────────────────────────────
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [editMode, setEditMode] = useState(false);
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [resources, setResources] = useState<GroupResource[]>([]);
  // Session form
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("");
  const [sessionLocation, setSessionLocation] = useState("");
  const [sessionAgenda, setSessionAgenda] = useState("");
  // Resource form
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceType, setResourceType] = useState<"link" | "document" | "video">("link");
  // Edit form
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editMeetingDay, setEditMeetingDay] = useState("");
  const [editMeetingTime, setEditMeetingTime] = useState("");
  const [editMeetingLocation, setEditMeetingLocation] = useState("");
  const [editPinnedNote, setEditPinnedNote] = useState("");
  const [editIsOpen, setEditIsOpen] = useState(true);
  const [editMaxMembers, setEditMaxMembers] = useState(8);
  const [editTags, setEditTags] = useState("");

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

  /* ─── Edit group ────────────────────────────────────────── */

  const startEdit = (g: StudyGroup) => {
    setEditName(g.name);
    setEditDescription(g.description || "");
    setEditMeetingDay(g.meetingDay || "");
    setEditMeetingTime(g.meetingTime || "");
    setEditMeetingLocation(g.meetingLocation || "");
    setEditPinnedNote(g.pinnedNote || "");
    setEditIsOpen(g.isOpen);
    setEditMaxMembers(g.maxMembers);
    setEditTags(g.tags.join(", "));
    setEditMode(true);
  };

  const saveEdit = async () => {
    if (!selectedGroup) return;
    setActionLoading(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${selectedGroup.id}`), {
        method: "PUT",
        headers: h,
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          meetingDay: editMeetingDay || null,
          meetingTime: editMeetingTime || null,
          meetingLocation: editMeetingLocation.trim() || null,
          pinnedNote: editPinnedNote.trim() || null,
          isOpen: editIsOpen,
          maxMembers: editMaxMembers,
          tags: editTags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedGroup(updated);
        setEditMode(false);
        showToast("Group updated!");
        fetchGroups();
        fetchMyGroups();
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to update");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── Sessions ──────────────────────────────────────────── */

  const fetchSessions = (g: StudyGroup) => {
    setSessions(g.sessions || []);
  };

  const scheduleSession = async () => {
    if (!selectedGroup || !sessionTitle.trim() || !sessionDate) return;
    setActionLoading(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${selectedGroup.id}/sessions`), {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          title: sessionTitle.trim(),
          date: sessionDate,
          time: sessionTime,
          location: sessionLocation.trim() || null,
          agenda: sessionAgenda.trim() || null,
        }),
      });
      if (res.ok) {
        const session = await res.json();
        setSessions((prev) => [...prev, session]);
        setSessionTitle("");
        setSessionDate("");
        setSessionTime("");
        setSessionLocation("");
        setSessionAgenda("");
        showToast("Session scheduled!");
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to schedule");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const cancelSession = async (sessionId: string) => {
    if (!selectedGroup) return;
    setActionLoading(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${selectedGroup.id}/sessions/${sessionId}`), {
        method: "DELETE",
        headers: h,
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        showToast("Session cancelled");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleRSVP = async (sessionId: string) => {
    if (!selectedGroup) return;
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${selectedGroup.id}/sessions/${sessionId}/rsvp`), {
        method: "POST",
        headers: h,
      });
      if (res.ok) {
        const { attending } = await res.json();
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, attendees: attending ? [...s.attendees, userId] : s.attendees.filter((a) => a !== userId) }
              : s
          )
        );
      }
    } catch {
      showToast("Network error");
    }
  };

  /* ─── Resources ─────────────────────────────────────────── */

  const fetchResources = (g: StudyGroup) => {
    setResources(g.resources || []);
  };

  const addResource = async () => {
    if (!selectedGroup || !resourceTitle.trim() || !resourceUrl.trim()) return;
    setActionLoading(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${selectedGroup.id}/resources`), {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          title: resourceTitle.trim(),
          url: resourceUrl.trim(),
          type: resourceType,
        }),
      });
      if (res.ok) {
        const resource = await res.json();
        setResources((prev) => [...prev, resource]);
        setResourceTitle("");
        setResourceUrl("");
        setResourceType("link");
        showToast("Resource shared!");
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to add");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const removeResource = async (resourceId: string) => {
    if (!selectedGroup) return;
    setActionLoading(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${selectedGroup.id}/resources/${resourceId}`), {
        method: "DELETE",
        headers: h,
      });
      if (res.ok) {
        setResources((prev) => prev.filter((r) => r.id !== resourceId));
        showToast("Resource removed");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── Load detail data when opening a group ─────────────── */

  const openGroupDetail = (group: StudyGroup) => {
    setSelectedGroup(group);
    setDetailTab("overview");
    setView("detail");
    fetchSessions(group);
    fetchResources(group);
  };

  const userId = user?.id || "";

  const isMember = (g: StudyGroup) => g.members.some((m) => m.userId === userId);
  const isCreator = (g: StudyGroup) => g.createdBy === userId;

  /* ─── Render helpers ────────────────────────────────────── */

  const renderGroupCard = (group: StudyGroup, compact?: boolean) => {
    const member = isMember(group);
    const creator = isCreator(group);
    const full = group.members.length >= group.maxMembers;
    const spots = group.maxMembers - group.members.length;

    return (
      <div
        className={`bg-snow border-[3px] border-navy rounded-3xl p-5 press-4 press-black cursor-pointer transition-all ${
 member ?"ring-4 ring-lime/40" :""
 }`}
        onClick={() => openGroupDetail(group)}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-navy text-snow text-label-sm px-2 py-0.5 rounded-lg font-bold">
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
          <div className="shrink-0 ml-2">
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

  /* ─── Detail View (Enhanced with Tabs) ────────────────── */

  const renderDetailView = () => {
    if (!selectedGroup) return null;
    const g = selectedGroup;
    const member = isMember(g);
    const creator = isCreator(g);
    const full = g.members.length >= g.maxMembers;

    const DETAIL_TABS: { key: DetailTab; label: string; count?: number }[] = [
      { key: "overview", label: "Overview" },
      { key: "feed", label: "Feed" },
      { key: "sessions", label: "Sessions", count: sessions.length },
      { key: "resources", label: "Resources", count: resources.length },
    ];

    return (
      <div className="space-y-6">
        {/* Back */}
        <button
          onClick={() => { setView("browse"); setEditMode(false); }}
          className="flex items-center gap-2 text-navy/70 font-bold hover:text-navy transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to groups
        </button>

        {/* Main header card */}
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 sm:p-8 shadow-[3px_3px_0_0_#000]">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="bg-navy text-snow text-label px-3 py-1 rounded-xl font-bold">
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
                <span className={`text-label px-3 py-1 rounded-xl font-bold ${g.isOpen ? "bg-lime-light text-navy" : "bg-coral-light text-coral"}`}>
                  {g.isOpen ? "Open" : "Closed"}
                </span>
              </div>
              <h2 className="font-display font-black text-navy text-2xl sm:text-3xl">{g.name}</h2>
              {g.courseName && <p className="text-slate mt-1">{g.courseName}</p>}
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0 flex-wrap">
              {!member && !full && g.isOpen && (
                <button
                  onClick={() => joinGroup(g.id)}
                  disabled={actionLoading}
                  className="bg-lime border-[3px] border-navy press-3 press-navy px-6 py-3 rounded-2xl font-display text-base text-navy transition-all disabled:opacity-50"
                >
                  {actionLoading ? "..." : "Join Group"}
                </button>
              )}
              {creator && (
                <button
                  onClick={() => startEdit(g)}
                  className="bg-lavender-light border-[3px] border-navy/30 px-5 py-2.5 rounded-xl font-display text-sm text-navy hover:border-navy transition-all"
                >
                  Edit
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

          {/* Pinned note */}
          {g.pinnedNote && (
            <div className="bg-sunny-light border-[3px] border-navy/10 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-sunny" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd"/></svg>
                <span className="text-[10px] font-bold uppercase tracking-widest text-navy/50">Pinned Note</span>
              </div>
              <p className="text-navy text-sm whitespace-pre-wrap">{g.pinnedNote}</p>
            </div>
          )}

          {g.description && (
            <p className="text-navy/80 mb-4 leading-relaxed">{g.description}</p>
          )}

          <p className="text-xs text-cloud">
            Created by {creator ? "You" : g.creatorName} · {new Date(g.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Edit Modal */}
        {editMode && creator && (
          <div className="bg-lavender-light border-[3px] border-navy rounded-3xl p-6 shadow-[3px_3px_0_0_#000]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-black text-navy text-xl">Edit Group</h3>
              <button onClick={() => setEditMode(false)} className="text-slate hover:text-navy text-xl font-bold">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-label text-navy mb-1 block">Group Name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100}
                  className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lavender focus:outline-none" />
              </div>
              <div>
                <label className="text-label text-navy mb-1 block">Description</label>
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} maxLength={500} title="Group description"
                  className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lavender focus:outline-none resize-none" />
              </div>
              <div>
                <label className="text-label text-navy mb-1 block">Pinned Note (visible to all members)</label>
                <textarea value={editPinnedNote} onChange={(e) => setEditPinnedNote(e.target.value)} rows={2} maxLength={300}
                  placeholder="e.g. Next exam: Chapter 5-8. Bring past questions!"
                  className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lavender focus:outline-none resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-label text-navy mb-1 block">Meeting Day</label>
                  <select value={editMeetingDay} onChange={(e) => setEditMeetingDay(e.target.value)} title="Meeting day"
                    className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy bg-snow focus:border-lavender focus:outline-none">
                    <option value="">Select day</option>
                    {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-label text-navy mb-1 block">Time</label>
                  <input type="time" value={editMeetingTime} onChange={(e) => setEditMeetingTime(e.target.value)} title="Meeting time"
                    className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lavender focus:outline-none" />
                </div>
                <div>
                  <label className="text-label text-navy mb-1 block">Location</label>
                  <input value={editMeetingLocation} onChange={(e) => setEditMeetingLocation(e.target.value)} maxLength={200}
                    className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lavender focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-label text-navy mb-1 block">Max Members</label>
                  <input type="number" value={editMaxMembers} onChange={(e) => setEditMaxMembers(Math.max(2, Math.min(20, Number(e.target.value))))}
                    min={2} max={20} title="Max members"
                    className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lavender focus:outline-none" />
                </div>
                <div>
                  <label className="text-label text-navy mb-1 block">Tags (comma separated)</label>
                  <input value={editTags} onChange={(e) => setEditTags(e.target.value)} title="Tags" placeholder="e.g. exam-prep, tutorials"
                    className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-lavender focus:outline-none" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-3 cursor-pointer py-3">
                    <input type="checkbox" checked={editIsOpen} onChange={(e) => setEditIsOpen(e.target.checked)}
                      className="w-5 h-5 rounded accent-lime" />
                    <span className="font-display font-bold text-sm text-navy">Accepting Members</span>
                  </label>
                </div>
              </div>
              <button onClick={saveEdit} disabled={actionLoading}
                className="bg-lime border-[3px] border-navy press-3 press-navy px-8 py-3 rounded-2xl font-display text-navy transition-all disabled:opacity-50">
                {actionLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {/* Detail tabs (only for members) */}
        {member && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DETAIL_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDetailTab(tab.key)}
                  className={`px-5 py-2.5 rounded-xl font-display font-bold text-sm border-[3px] transition-all whitespace-nowrap ${
                    detailTab === tab.key
                      ? "bg-navy text-snow border-navy"
                      : "bg-snow text-navy border-navy/15 hover:border-navy"
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-2 text-[10px] bg-snow/20 px-1.5 py-0.5 rounded-full">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-snow border-[3px] border-navy rounded-3xl shadow-[3px_3px_0_0_#000] overflow-hidden">
              {/* ── Overview Tab ── */}
              {detailTab === "overview" && (
                <div className="p-6 space-y-6">
                  {/* Meeting info */}
                  {(g.meetingDay || g.meetingTime || g.meetingLocation) && (
                    <div className="bg-lime-light border-[3px] border-navy/10 rounded-2xl p-4">
                      <h3 className="font-display font-bold text-navy text-sm mb-2 uppercase tracking-wider">
                        Regular Meeting Schedule
                      </h3>
                      <div className="flex flex-wrap gap-4 text-sm text-navy/80">
                        {g.meetingDay && <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-navy/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>{g.meetingDay}</span>}
                        {g.meetingTime && <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-navy/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{g.meetingTime}</span>}
                        {g.meetingLocation && <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-navy/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>{g.meetingLocation}</span>}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {g.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
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
                        <div key={m.userId} className="flex items-center gap-3 bg-ghost rounded-xl px-4 py-3">
                          <div className="w-8 h-8 rounded-full bg-navy text-snow flex items-center justify-center font-display font-bold text-sm">
                            {m.firstName?.[0]}{m.lastName?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-navy text-sm truncate">
                              {m.firstName} {m.lastName}
                              {m.userId === g.createdBy && (
                                <span className="ml-1 text-[9px] font-bold uppercase text-lavender bg-lavender-light px-1.5 py-0.5 rounded">Creator</span>
                              )}
                            </p>
                            {m.matricNumber && <p className="text-xs text-slate">{m.matricNumber}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Feed Tab ── */}
              {detailTab === "feed" && (
                <GroupChatPanel
                  groupId={g.id}
                  userId={userId}
                  getAccessToken={getAccessToken}
                />
              )}

              {/* ── Sessions Tab ── */}
              {detailTab === "sessions" && (
                <div className="p-6 space-y-4">
                  {/* Session list */}
                  {sessions.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-slate text-sm mb-1">No study sessions scheduled yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sessions
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((s) => {
                          const isPast = new Date(s.date) < new Date(new Date().toDateString());
                          const isAttending = s.attendees.includes(userId);
                          return (
                            <div key={s.id} className={`border-[3px] rounded-2xl p-4 ${isPast ? "border-navy/10 bg-ghost/50 opacity-60" : "border-navy/15 bg-snow"}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <h4 className="font-display font-bold text-navy">{s.title}</h4>
                                  <div className="flex flex-wrap gap-3 text-xs text-slate mt-1">
                                    <span>{new Date(s.date).toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" })}</span>
                                    {s.time && <span>{s.time}</span>}
                                    {s.location && <span>{s.location}</span>}
                                  </div>
                                  {s.agenda && <p className="text-sm text-navy/60 mt-2">{s.agenda}</p>}
                                  <p className="text-[10px] text-navy/30 mt-1">by {s.creatorName} · {s.attendees.length} attending</p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  {!isPast && (
                                    <button
                                      onClick={() => toggleRSVP(s.id)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                                        isAttending
                                          ? "bg-teal text-navy border-navy/20"
                                          : "bg-snow text-navy border-navy/20 hover:border-navy"
                                      }`}
                                    >
                                      {isAttending ? "Going" : "RSVP"}
                                    </button>
                                  )}
                                  {(s.createdBy === userId || creator) && (
                                    <button
                                      onClick={() => cancelSession(s.id)}
                                      className="p-1.5 text-slate hover:text-coral transition-colors"
                                      aria-label="Cancel session"
                                    >
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd"/></svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Schedule form */}
                  <div className="border-t-[3px] border-navy/10 pt-4 mt-4">
                    <h4 className="font-display font-bold text-navy text-sm mb-3 uppercase tracking-wider">Schedule a Session</h4>
                    <div className="space-y-3">
                      <input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} placeholder="Session title (e.g. Exam Review)" maxLength={100}
                        className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-teal focus:outline-none" />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} title="Session date"
                          className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-teal focus:outline-none" />
                        <input type="time" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} title="Session time"
                          className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-teal focus:outline-none" />
                        <input value={sessionLocation} onChange={(e) => setSessionLocation(e.target.value)} placeholder="Location" maxLength={200}
                          className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-teal focus:outline-none" />
                      </div>
                      <textarea value={sessionAgenda} onChange={(e) => setSessionAgenda(e.target.value)} placeholder="Agenda / topics to cover" rows={2} maxLength={500}
                        className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-teal focus:outline-none resize-none" />
                      <button onClick={scheduleSession} disabled={actionLoading || !sessionTitle.trim() || !sessionDate}
                        className="bg-teal border-[3px] border-navy press-3 press-navy px-6 py-3 rounded-2xl font-display text-sm text-navy transition-all disabled:opacity-40">
                        {actionLoading ? "Scheduling..." : "Schedule Session"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Resources Tab ── */}
              {detailTab === "resources" && (
                <div className="p-6 space-y-4">
                  {resources.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-slate text-sm">No shared resources yet. Share study materials with the group!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {resources.map((r) => {
                        const typeIcons: Record<string, string> = { link: "bg-teal-light text-teal", document: "bg-lavender-light text-lavender", video: "bg-coral-light text-coral" };
                        return (
                          <div key={r.id} className="flex items-center gap-3 bg-ghost rounded-xl px-4 py-3 group">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeIcons[r.type] || typeIcons.link}`}>
                              {r.type === "video" ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd"/></svg>
                              ) : r.type === "document" ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" clipRule="evenodd"/></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M19.902 4.098a3.75 3.75 0 00-5.304 0l-4.5 4.5a3.75 3.75 0 001.035 6.037.75.75 0 01-.646 1.353 5.25 5.25 0 01-1.449-8.45l4.5-4.5a5.25 5.25 0 117.424 7.424l-1.757 1.757a.75.75 0 11-1.06-1.06l1.757-1.757a3.75 3.75 0 000-5.304zm-7.389 4.267a.75.75 0 011-.353 5.25 5.25 0 011.449 8.45l-4.5 4.5a5.25 5.25 0 11-7.424-7.424l1.757-1.757a.75.75 0 111.06 1.06l-1.757 1.757a3.75 3.75 0 105.304 5.304l4.5-4.5a3.75 3.75 0 00-1.035-6.037.75.75 0 01-.354-1z" clipRule="evenodd"/></svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <a href={r.url} target="_blank" rel="noopener noreferrer"
                                className="font-display font-bold text-sm text-navy hover:text-teal transition-colors truncate block">
                                {r.title}
                              </a>
                              <p className="text-[10px] text-slate truncate">
                                by {r.addedByName} · {r.type} · {new Date(r.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            {(r.addedBy === userId || creator) && (
                              <button onClick={() => removeResource(r.id)}
                                className="p-1.5 text-slate hover:text-coral opacity-0 group-hover:opacity-100 transition-all"
                                aria-label="Remove resource">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add resource form */}
                  <div className="border-t-[3px] border-navy/10 pt-4 mt-4">
                    <h4 className="font-display font-bold text-navy text-sm mb-3 uppercase tracking-wider">Share a Resource</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} placeholder="Resource title" maxLength={100}
                          className="sm:col-span-2 w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-teal focus:outline-none" />
                        <select value={resourceType} onChange={(e) => setResourceType(e.target.value as "link" | "document" | "video")} title="Resource type"
                          className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy bg-snow focus:border-teal focus:outline-none">
                          <option value="link">Link</option>
                          <option value="document">Document</option>
                          <option value="video">Video</option>
                        </select>
                      </div>
                      <input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://..." maxLength={500}
                        className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-teal focus:outline-none" />
                      <button onClick={addResource} disabled={actionLoading || !resourceTitle.trim() || !resourceUrl.trim()}
                        className="bg-lavender border-[3px] border-navy press-3 press-navy px-6 py-3 rounded-2xl font-display text-sm text-snow transition-all disabled:opacity-40">
                        {actionLoading ? "Sharing..." : "Share Resource"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Non-member view: just show members */}
        {!member && (
          <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 shadow-[3px_3px_0_0_#000]">
            <h3 className="font-display font-bold text-navy mb-3">
              Members ({g.members.length}/{g.maxMembers})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {g.members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 bg-ghost rounded-xl px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-navy text-snow flex items-center justify-center font-display font-bold text-sm">
                    {m.firstName?.[0]}{m.lastName?.[0]}
                  </div>
                  <p className="font-medium text-navy text-sm truncate">
                    {m.firstName} {m.lastName}
                    {m.userId === g.createdBy && <span className="ml-1 text-[9px] font-bold uppercase text-lavender bg-lavender-light px-1.5 py-0.5 rounded">Creator</span>}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-navy/30 mt-4">Join the group to access the feed, sessions, and shared resources.</p>
          </div>
        )}
      </div>
    );
  };

  /* ─── Create Form ───────────────────────────────────────── */

  const renderCreateForm = () => (
    <div className="space-y-6">
      <button
        onClick={() => setView("browse")}
        className="flex items-center gap-2 text-navy font-bold hover:text-snow transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 sm:p-8 shadow-[3px_3px_0_0_#000]">
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
              className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors"
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
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-label text-navy mb-1 block">Course Name</label>
              <input
                value={formCourseName}
                onChange={(e) => setFormCourseName(e.target.value)}
                placeholder="e.g. Operations Research I"
                maxLength={200}
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors"
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
              className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Level + Max Members */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-label text-navy mb-1 block">Level</label>
              <select
                value={formLevel}
                onChange={(e) => setFormLevel(e.target.value)}
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors bg-snow"
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
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors"
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
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors bg-snow"
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
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-label text-navy mb-1 block">Location</label>
              <input
                value={formMeetingLocation}
                onChange={(e) => setFormMeetingLocation(e.target.value)}
                placeholder="e.g. Room 204, IE Building"
                maxLength={200}
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors"
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
              className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors"
            />
          </div>

          {/* Submit */}
          <button
            onClick={createGroup}
            disabled={actionLoading}
            className="bg-lime border-[3px] border-navy press-3 press-navy px-8 py-4 rounded-2xl font-display text-lg text-navy transition-all disabled:opacity-50 w-full sm:w-auto"
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
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toast */}
        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-navy text-snow px-5 py-3 rounded-2xl border-[3px] border-ghost/20 font-display text-sm animate-bounce">
            {toast}
          </div>
        )}

        {/* Back to Growth Hub + Help */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/dashboard/growth"
            className="inline-flex items-center gap-2 text-navy/70 font-bold hover:text-navy transition-colors"
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
            className="bg-lime border-[3px] border-navy press-3 press-navy px-6 py-3 rounded-2xl font-display text-base text-navy transition-all"
          >
            + New Group
          </button>
        </div>

        {/* Stats Cards */}
        {view !== "create" && view !== "detail" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-teal-light border-[3px] border-navy/10 rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-navy/40 mb-1">Total Groups</p>
              <p className="font-display font-black text-navy text-3xl">{groups.length}</p>
              <p className="text-xs text-slate mt-0.5">{groups.filter((g) => g.isOpen).length} open</p>
            </div>
            <div className="bg-lavender-light border-[3px] border-navy/10 rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-navy/40 mb-1">My Groups</p>
              <p className="font-display font-black text-navy text-3xl">{myGroups.length}</p>
              <p className="text-xs text-slate mt-0.5">{myGroups.filter((g) => g.createdBy === userId).length} created by you</p>
            </div>
            <div className="bg-sunny-light border-[3px] border-navy/10 rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-navy/40 mb-1">Next Session</p>
              {(() => {
                const allSessions = myGroups.flatMap((g) => (g.sessions || []).map((s) => ({ ...s, groupName: g.name })));
                const upcoming = allSessions
                  .filter((s) => new Date(s.date) >= new Date(new Date().toDateString()))
                  .sort((a, b) => a.date.localeCompare(b.date));
                if (upcoming.length > 0) {
                  const next = upcoming[0];
                  return (
                    <>
                      <p className="font-display font-black text-navy text-lg truncate">{next.title}</p>
                      <p className="text-xs text-slate mt-0.5">
                        {new Date(next.date).toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" })}
                        {next.time ? ` at ${next.time}` : ""}
                      </p>
                    </>
                  );
                }
                return <p className="font-display font-bold text-navy/30 text-lg">None scheduled</p>;
              })()}
            </div>
          </div>
        )}

        {/* Tab navigation */}
        {view !== "create" && view !== "detail" && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setView("browse")}
              className={`px-5 py-2.5 rounded-xl font-display text-sm border-[3px] transition-all ${
                view === "browse"
                  ? "bg-navy text-snow border-navy"
                  : "bg-snow text-navy border-navy/20 hover:border-navy"
              }`}
            >
              Browse All
            </button>
            <button
              onClick={() => setView("my-groups")}
              className={`px-5 py-2.5 rounded-xl font-display text-sm border-[3px] transition-all ${
                view === "my-groups"
                  ? "bg-navy text-snow border-navy"
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
                  className="w-full pl-12 pr-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors"
                />
              </div>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors bg-snow min-w-[140px]"
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
              <div className="bg-snow border-[3px] border-navy/10 rounded-3xl p-12 text-center">
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
                  className="bg-lime border-[3px] border-navy press-3 press-navy px-6 py-3 rounded-2xl font-display text-navy transition-all"
                >
                  + Create Study Group
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map((g) => (
                  <div key={g.id}>{renderGroupCard(g)}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── MY GROUPS VIEW ──── */}
        {view === "my-groups" && (
          <div className="space-y-6">
            {myGroups.length === 0 ? (
              <div className="bg-snow border-[3px] border-navy/10 rounded-3xl p-12 text-center">
                <p className="text-navy font-display font-bold text-lg mb-2">You haven&apos;t joined any groups yet</p>
                <p className="text-slate mb-4">Browse available groups or create your own!</p>
                <button
                  onClick={() => setView("browse")}
                  className="bg-transparent border-[3px] border-navy px-6 py-3 rounded-xl font-display text-navy hover:bg-navy hover:text-snow transition-all"
                >
                  Browse Groups
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myGroups.map((g) => (
                  <div key={g.id}>{renderGroupCard(g)}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── DETAIL VIEW ──── */}
        {view === "detail" && renderDetailView()}

        {/* ─── CREATE VIEW ──── */}
        {view === "create" && renderCreateForm()}

        {/* Privacy/info note */}
        <div className="mt-12 bg-ghost border-[3px] border-navy/10 rounded-2xl p-4 text-center text-xs text-slate">
          Study groups are visible to all logged-in students. Your name and matric number are shared with group members.
          Data refreshes every 30 seconds.
        </div>
      </main>
    </div>
  );
}
