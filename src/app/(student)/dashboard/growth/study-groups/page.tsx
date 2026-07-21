"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";
import { ConfirmModal } from "@/components/ui/Modal";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl, getWsUrl } from "@/lib/api";
import { buildMessagesHref } from "@/lib/messaging";

/* ─── Types ─────────────────────────────────────────────────────── */

interface StudyGroupMember {
  userId: string;
  firstName: string;
  lastName: string;
  matricNumber?: string;
  joinedAt: string;
}

interface JoinRequest {
  userId: string;
  firstName: string;
  lastName: string;
  matricNumber?: string;
  requestedAt: string;
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
  meetupType?: "physical" | "online";
  location?: string;
  meetingLink?: string;
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
  courseCode?: string;
  courseName?: string;
  description?: string;
  maxMembers: number;
  level?: string;
  tags: string[];
  visibility?: "public" | "private";
  publicJoinRequiresApproval?: boolean;
  isOpen: boolean;
  requireApproval: boolean;
  createdBy: string;
  creatorName: string;
  members: StudyGroupMember[];
  joinRequests: JoinRequest[];
  inviteCode?: string;
  pinnedNote?: string;
  messages?: GroupMessage[];
  sessions?: GroupSession[];
  resources?: GroupResource[];
  onlineMemberIds?: string[];
  createdAt: string;
  updatedAt: string;
}

interface InviteSearchStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  matricNumber?: string;
  role?: string;
  level?: string;
}

type ViewMode = "browse" | "my-groups" | "create" | "detail";
type DetailTab = "overview" | "feed" | "sessions" | "resources";

const LEVELS = ["100", "200", "300", "400", "500"];
const POLL_INTERVAL = 30_000; // 30s REST polling

/* ─── GroupChatPanel — outside parent to prevent re-mount on every keystroke ─ */

interface ChatPanelProps {
  groupId: string;
  userId: string;
  getAccessToken: () => Promise<string | null>;
  initialOnlineUserIds?: string[];
  onPresenceChange?: (onlineUserIds: string[]) => void;
}

function GroupChatPanel({ groupId, userId, getAccessToken, initialOnlineUserIds = [], onPresenceChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>(initialOnlineUserIds);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const isInitialScrollRef = useRef(true);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    isInitialScrollRef.current = true;

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

      ws.onopen = () => {
        setWsStatus("open");
        // Heartbeat: send ping every 30 s to keep connection alive through proxies
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30_000);
      };

      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          if (packet.type === "message") {
            setMessages((prev) =>
              prev.some((m) => m.id === packet.data.id) ? prev : [...prev, packet.data]
            );
          } else if (packet.type === "presence") {
            const onlineIds = Array.isArray(packet.data?.onlineUserIds) ? packet.data.onlineUserIds : [];
            setOnlineUserIds(onlineIds);
            onPresenceChange?.(onlineIds);
          }
          // pong from server — ignore (just keeps the connection alive)
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setWsStatus("closed");
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
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
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [groupId, getAccessToken]);

  useEffect(() => {
    setOnlineUserIds(initialOnlineUserIds);
  }, [initialOnlineUserIds]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length === 0) return;
    const behavior = isInitialScrollRef.current ? "auto" as const : "smooth" as const;
    isInitialScrollRef.current = false;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior });
    });
  }, [messages]);

  const sendMessage = () => {
    const text = inputValue.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "message", text }));
    setInputValue("");
  };

  return (
    <div className="p-6">
      <div className="mb-2 text-[11px] text-slate font-medium">
        {onlineUserIds.length > 0 ? `${onlineUserIds.length} member${onlineUserIds.length === 1 ? "" : "s"} online` : "No members online right now"}
      </div>
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
                <div className={`inline-block px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
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
      <div className="flex gap-2 items-end">
        <textarea
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
          }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Type a message... (Shift+Enter for new line)"
          maxLength={500}
          rows={1}
          disabled={wsStatus !== "open"}
          className="flex-1 resize-none px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-teal focus:outline-none disabled:opacity-50"
          style={{ maxHeight: "120px" }}
        />
        <button
          onClick={sendMessage}
          disabled={wsStatus !== "open" || !inputValue.trim()}
          className="bg-navy text-snow px-5 py-3 rounded-xl font-display font-bold text-sm disabled:opacity-40 border-[3px] border-lime press-3 press-lime transition-all shrink-0"
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
  const searchParams = useSearchParams();
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
  const [formDescription, setFormDescription] = useState("");
  const [formMaxMembers, setFormMaxMembers] = useState(8);
  const [formLevel, setFormLevel] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formVisibility, setFormVisibility] = useState<"public" | "private">("public");
  const [formPublicJoinRequiresApproval, setFormPublicJoinRequiresApproval] = useState(false);

  // ─── New feature state ────────────────────────────────────
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [editMode, setEditMode] = useState(false);
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [resources, setResources] = useState<GroupResource[]>([]);
  // Session form
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("");
  const [sessionMeetupType, setSessionMeetupType] = useState<"physical" | "online">("physical");
  const [sessionLocation, setSessionLocation] = useState("");
  const [sessionMeetingLink, setSessionMeetingLink] = useState("");
  const [sessionAgenda, setSessionAgenda] = useState("");
  // Resource form
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceType, setResourceType] = useState<"link" | "document" | "video">("link");
  // Edit form
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPinnedNote, setEditPinnedNote] = useState("");
  const [editVisibility, setEditVisibility] = useState<"public" | "private">("public");
  const [editPublicJoinRequiresApproval, setEditPublicJoinRequiresApproval] = useState(false);
  const [editIsOpen, setEditIsOpen] = useState(true);
  const [editMaxMembers, setEditMaxMembers] = useState(8);
  const [editTags, setEditTags] = useState("");
  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [inviteSearchResults, setInviteSearchResults] = useState<InviteSearchStudent[]>([]);
  const [selectedInviteeIds, setSelectedInviteeIds] = useState<string[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [deleteTargetGroupId, setDeleteTargetGroupId] = useState<string | null>(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<{ groupId: string; memberId: string } | null>(null);

  const getGroupVisibility = useCallback((group: StudyGroup) => {
    return group.visibility === "private" ? "private" : "public";
  }, []);

  const requiresApproval = useCallback((group: StudyGroup) => {
    if (getGroupVisibility(group) === "private") return true;
    if (typeof group.publicJoinRequiresApproval === "boolean") {
      return group.publicJoinRequiresApproval;
    }
    return Boolean(group.requireApproval);
  }, [getGroupVisibility]);

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

  // Handle invite code from URL
  const inviteHandledRef = useRef(false);
  useEffect(() => {
    const inviteCode = searchParams.get("invite");
    if (!inviteCode || !user || inviteHandledRef.current) return;
    inviteHandledRef.current = true;

    const handleInvite = async () => {
      try {
        const h = await headers();
        // Look up group by invite code
        const lookupRes = await fetch(getApiUrl(`/api/v1/study-groups/join-by-code/${inviteCode}`), { headers: h });
        if (!lookupRes.ok) {
          showToast("Invalid or expired invite link");
          return;
        }
        const group: StudyGroup = await lookupRes.json();

        // Check if already a member
        if (group.members.some((m) => m.userId === user.id)) {
          openGroupDetail(group);
          showToast("You're already a member of this group!");
          return;
        }

        // Join by invite
        const joinRes = await fetch(getApiUrl(`/api/v1/study-groups/${group.id}/join-by-invite`), {
          method: "POST",
          headers: h,
          body: JSON.stringify({ inviteCode }),
        });
        if (joinRes.ok) {
          const updated = await joinRes.json();
          openGroupDetail(updated);
          showToast("Joined group via invite link!");
          fetchGroups();
          fetchMyGroups();
        } else {
          const err = await joinRes.json();
          showToast(err.detail || "Failed to join via invite");
          openGroupDetail(group);
        }
      } catch {
        showToast("Failed to process invite link");
      }
    };

    handleInvite();
    // Clean the URL
    window.history.replaceState({}, "", window.location.pathname);
  }, [searchParams, user, headers, fetchGroups, fetchMyGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Actions ───────────────────────────────────────────── */

  const createGroup = async () => {
    if (!formName.trim()) {
      showToast("Group name is required");
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
          description: formDescription.trim() || null,
          maxMembers: formMaxMembers,
          level: formLevel || null,
          tags: formTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 5),
          visibility: formVisibility,
          publicJoinRequiresApproval: formVisibility === "public" ? formPublicJoinRequiresApproval : false,
          isOpen: true,
          requireApproval: formVisibility === "private" ? true : formPublicJoinRequiresApproval,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        showToast("Study group created! Now invite coursemates.");
        resetForm();
        setSelectedGroup(created);
        setDetailTab("overview");
        setView("detail");
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
        const data = await res.json();
        if (data.status === "pending") {
          showToast(data.message || "Join request sent!");
          if (data.group) setSelectedGroup(data.group);
        } else {
          showToast("Joined group!");
          if (selectedGroup?.id === groupId) setSelectedGroup(data);
        }
        fetchGroups();
        fetchMyGroups();
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

  const deleteGroup = async (groupId: string, skipConfirm = false) => {
    if (!skipConfirm) {
      setDeleteTargetGroupId(groupId);
      return;
    }
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

  const approveRequest = async (groupId: string, reqUserId: string) => {
    setActionLoading(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${groupId}/approve/${reqUserId}`), {
        method: "POST",
        headers: h,
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedGroup(updated);
        showToast("Request approved!");
        fetchGroups();
        fetchMyGroups();
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to approve");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const rejectRequest = async (groupId: string, reqUserId: string) => {
    setActionLoading(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${groupId}/reject/${reqUserId}`), {
        method: "POST",
        headers: h,
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedGroup(updated);
        showToast("Request rejected");
        fetchGroups();
        fetchMyGroups();
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to reject");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const removeMember = async (groupId: string, memberId: string, skipConfirm = false) => {
    if (!skipConfirm) {
      setRemoveMemberTarget({ groupId, memberId });
      return;
    }
    setActionLoading(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${groupId}/members/${memberId}`), {
        method: "DELETE",
        headers: h,
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedGroup(updated);
        showToast("Member removed");
        fetchGroups();
        fetchMyGroups();
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to remove");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const regenerateInvite = async (groupId: string) => {
    setActionLoading(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${groupId}/regenerate-invite`), {
        method: "POST",
        headers: h,
      });
      if (res.ok) {
        const { inviteCode } = await res.json();
        if (selectedGroup) setSelectedGroup({ ...selectedGroup, inviteCode });
        showToast("Invite code regenerated!");
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to regenerate");
      }
    } catch {
      showToast("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const copyInviteLink = (code: string) => {
    const link = `${window.location.origin}/dashboard/growth/study-groups?invite=${code}`;
    navigator.clipboard.writeText(link);
    showToast("Invite link copied!");
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormMaxMembers(8);
    setFormLevel("");
    setFormTags("");
    setFormVisibility("public");
    setFormPublicJoinRequiresApproval(false);
  };

  /* ─── Edit group ────────────────────────────────────────── */

  const startEdit = (g: StudyGroup) => {
    setEditName(g.name);
    setEditDescription(g.description || "");
    setEditPinnedNote(g.pinnedNote || "");
    const visibility = getGroupVisibility(g);
    setEditVisibility(visibility);
    setEditPublicJoinRequiresApproval(visibility === "private" ? true : requiresApproval(g));
    setEditIsOpen(g.isOpen);
    setEditMaxMembers(g.maxMembers);
    setEditTags(g.tags.join(", "));
    setInviteSearchQuery("");
    setInviteSearchResults([]);
    setSelectedInviteeIds([]);
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
          pinnedNote: editPinnedNote.trim() || null,
          visibility: editVisibility,
          publicJoinRequiresApproval: editVisibility === "public" ? editPublicJoinRequiresApproval : false,
          isOpen: editIsOpen,
          maxMembers: editMaxMembers,
          tags: editTags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5),
          requireApproval: editVisibility === "private" ? true : editPublicJoinRequiresApproval,
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
    if (sessionMeetupType === "physical" && !sessionLocation.trim()) {
      showToast("Location is required for physical sessions");
      return;
    }
    if (sessionMeetupType === "online" && !sessionMeetingLink.trim()) {
      showToast("Meeting link is required for online sessions");
      return;
    }
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
          meetupType: sessionMeetupType,
          location: sessionMeetupType === "physical" ? sessionLocation.trim() || null : null,
          meetingLink: sessionMeetupType === "online" ? sessionMeetingLink.trim() || null : null,
          agenda: sessionAgenda.trim() || null,
        }),
      });
      if (res.ok) {
        const session = await res.json();
        setSessions((prev) => [...prev, session]);
        setSessionTitle("");
        setSessionDate("");
        setSessionTime("");
        setSessionMeetupType("physical");
        setSessionLocation("");
        setSessionMeetingLink("");
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
    setInviteSearchQuery("");
    setInviteSearchResults([]);
    setSelectedInviteeIds([]);
    fetchSessions(group);
    fetchResources(group);
  };

  const searchInviteStudents = async (groupId: string) => {
    const query = inviteSearchQuery.trim();
    if (query.length < 2) {
      showToast("Type at least 2 characters to search");
      return;
    }
    setInviteSearching(true);
    try {
      const h = await headers();
      const params = new URLSearchParams({ q: query });
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${groupId}/students/search?${params.toString()}`), {
        headers: h,
      });
      if (res.ok) {
        const data = await res.json();
        setInviteSearchResults(data.students || []);
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to search students");
      }
    } catch {
      showToast("Network error while searching students");
    } finally {
      setInviteSearching(false);
    }
  };

  const toggleInviteSelection = (studentId: string) => {
    setSelectedInviteeIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const sendBulkInvites = async (groupId: string) => {
    if (selectedInviteeIds.length === 0) {
      showToast("Select at least one student to invite");
      return;
    }
    setInviteSending(true);
    try {
      const h = await headers();
      const res = await fetch(getApiUrl(`/api/v1/study-groups/${groupId}/invites/send`), {
        method: "POST",
        headers: h,
        body: JSON.stringify({ userIds: selectedInviteeIds }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Invites queued: ${data.invited} student${data.invited === 1 ? "" : "s"}`);
        setSelectedInviteeIds([]);
        fetchGroups();
        fetchMyGroups();
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to send invites");
      }
    } catch {
      showToast("Network error while sending invites");
    } finally {
      setInviteSending(false);
    }
  };

  const userId = user?.id || "";

  const isMember = (g: StudyGroup) => g.members.some((m) => m.userId === userId);
  const isCreator = (g: StudyGroup) => g.createdBy === userId;
  const hasPendingRequest = (g: StudyGroup) => (g.joinRequests || []).some((jr) => jr.userId === userId);

  /* ─── Render helpers ────────────────────────────────────── */

  const renderGroupCard = (group: StudyGroup, compact?: boolean) => {
    const member = isMember(group);
    const creator = isCreator(group);
    const pending = hasPendingRequest(group);
    const full = group.members.length >= group.maxMembers;
    const spots = group.maxMembers - group.members.length;
    const visibility = getGroupVisibility(group);
    const approvalRequired = requiresApproval(group);

    return (
      <div
        className={`bg-snow border-[3px] border-navy rounded-3xl p-5 press-4 press-black cursor-pointer transition-all ${
 member ?"ring-4 ring-lime/40" : pending ? "ring-4 ring-sunny/40" : ""
 }`}
        onClick={() => openGroupDetail(group)}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-label-sm px-2 py-0.5 rounded-lg font-bold ${visibility === "private" ? "bg-navy text-lime" : "bg-teal-light text-navy"}`}>
                {visibility === "private" ? "Private" : "Public"}
              </span>
              {group.courseCode && (
                <span className="bg-navy text-snow text-label-sm px-2 py-0.5 rounded-lg font-bold">
                  {group.courseCode}
                </span>
              )}
              {group.level && (
                <span className="bg-lavender-light text-navy text-label-sm px-2 py-0.5 rounded-lg">
                  {group.level}
                </span>
              )}
              {approvalRequired && (
                <span className="bg-sunny-light text-navy text-label-sm px-2 py-0.5 rounded-lg" title="Requires approval to join">
                  <svg aria-hidden="true" className="w-3 h-3 inline -mt-0.5 mr-0.5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd"/></svg>
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
            ) : pending ? (
              <span className="bg-sunny text-navy text-label-sm px-2 py-0.5 rounded-lg font-bold">
                Pending
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
            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {group.members.length}/{group.maxMembers}
          </span>
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
    const pending = hasPendingRequest(g);
    const full = g.members.length >= g.maxMembers;
    const visibility = getGroupVisibility(g);
    const approvalRequired = requiresApproval(g);

    const DETAIL_TABS: { key: DetailTab; label: string; count?: number }[] = [
      { key: "overview", label: "Overview" },
      { key: "feed", label: "Feed" },
      { key: "sessions", label: "Sessions", count: sessions.length },
      { key: "resources", label: "Resources", count: resources.length },
    ];
    const onlineMemberSet = new Set(g.onlineMemberIds || []);

    return (
      <div className="space-y-6">
        {/* Back */}
        <button
          onClick={() => { setView("browse"); setEditMode(false); }}
          className="flex items-center gap-2 text-navy/70 font-bold hover:text-navy transition-colors"
        >
          <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to groups
        </button>

        {/* Main header card */}
        <div className="bg-snow border-[3px] border-navy rounded-3xl p-6 sm:p-8 shadow-[3px_3px_0_0_#000]">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-label px-3 py-1 rounded-xl font-bold ${visibility === "private" ? "bg-navy text-lime" : "bg-teal-light text-navy"}`}>
                  {visibility === "private" ? "Private Group" : "Public Group"}
                </span>
                {g.courseCode && (
                  <span className="bg-navy text-snow text-label px-3 py-1 rounded-xl font-bold">
                    {g.courseCode}
                  </span>
                )}
                {g.level && (
                  <span className="bg-lavender-light text-navy text-label px-3 py-1 rounded-xl">
                    {String(g.level).replace(/L$/i, "")} Level
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
                {approvalRequired && (
                  <span className="bg-sunny-light text-navy text-label px-3 py-1 rounded-xl font-bold">
                    Approval Required
                  </span>
                )}
              </div>
              <h2 className="font-display font-black text-navy text-2xl sm:text-3xl">{g.name}</h2>
              {g.courseName && <p className="text-slate mt-1">{g.courseName}</p>}
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0 flex-wrap">
              {!member && !pending && !full && g.isOpen && visibility === "public" && (
                <button
                  onClick={() => joinGroup(g.id)}
                  disabled={actionLoading}
                  className="bg-lime border-[3px] border-navy press-3 press-navy px-6 py-3 rounded-2xl font-display text-base text-navy transition-all disabled:opacity-50"
                >
                  {actionLoading ? "..." : approvalRequired ? "Request to Join" : "Join Group"}
                </button>
              )}
              {!member && !pending && visibility === "private" && (
                <span className="bg-lavender-light border-[3px] border-navy/20 px-5 py-2.5 rounded-xl font-display text-sm text-navy">
                  Join via invite link
                </span>
              )}
              {!member && pending && (
                <span className="bg-sunny-light border-[3px] border-navy/20 px-5 py-2.5 rounded-xl font-display text-sm text-navy">
                  <svg aria-hidden="true" className="w-4 h-4 inline -mt-0.5 mr-1" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd"/></svg>
                  Pending Approval
                </span>
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
                <svg aria-hidden="true" className="w-4 h-4 text-sunny" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd"/></svg>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-label text-navy mb-1 block">Visibility</label>
                  <select
                    value={editVisibility}
                    onChange={(e) => setEditVisibility(e.target.value as "public" | "private")}
                    title="Group visibility"
                    className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy bg-snow focus:border-lavender focus:outline-none"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-3 cursor-pointer py-3">
                    <input type="checkbox" checked={editIsOpen} onChange={(e) => setEditIsOpen(e.target.checked)}
                      title="Accepting members"
                      className="w-5 h-5 rounded accent-lime" />
                    <span className="font-display font-bold text-sm text-navy">Accepting Members</span>
                  </label>
                </div>
              </div>
              {editVisibility === "public" ? (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={editPublicJoinRequiresApproval} onChange={(e) => setEditPublicJoinRequiresApproval(e.target.checked)}
                      title="Require approval"
                      className="w-5 h-5 rounded accent-sunny" />
                    <span className="font-display font-bold text-sm text-navy">Require Approval to Join</span>
                  </label>
                  <span className="text-xs text-slate">(Optional for public groups)</span>
                </div>
              ) : (
                <p className="text-xs text-slate">Private groups always require approval and are hidden from public browsing.</p>
              )}
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
                      ? "bg-navy text-snow border-lime"
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
                        <div key={m.userId} className="flex items-center gap-3 bg-ghost rounded-xl px-4 py-3 group">
                          <div className="relative w-8 h-8 rounded-full bg-navy text-snow flex items-center justify-center font-display font-bold text-sm">
                            {m.firstName?.[0]}{m.lastName?.[0]}
                            {onlineMemberSet.has(m.userId) && (
                              <span className="absolute -bottom-0.5 -right-0.5 inline-flex w-2.5 h-2.5 rounded-full bg-teal border border-snow" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-navy text-sm truncate">
                              {m.firstName} {m.lastName}
                              {m.userId === g.createdBy && (
                                <span className="ml-1 text-[9px] font-bold uppercase text-lavender bg-lavender-light px-1.5 py-0.5 rounded">Head</span>
                              )}
                            </p>
                            <p className="text-xs text-slate">
                              {m.matricNumber || ""}
                              {onlineMemberSet.has(m.userId) ? `${m.matricNumber ? " · " : ""}Online` : ""}
                            </p>
                          </div>
                          {m.userId !== userId && (
                            <Link
                              href={buildMessagesHref({
                                userId: m.userId,
                                userName: `${m.firstName} ${m.lastName}`,
                                context: "study_group",
                                contextId: g.id,
                                contextLabel: g.name,
                              })}
                              className="text-[10px] font-bold bg-lime border-2 border-navy rounded-lg px-2 py-1 text-navy press-1 press-navy shrink-0"
                            >
                              Message
                            </Link>
                          )}
                          {creator && m.userId !== g.createdBy && (
                            <button
                              onClick={() => removeMember(g.id, m.userId)}
                              disabled={actionLoading}
                              className="p-1.5 text-slate hover:text-coral opacity-0 group-hover:opacity-100 transition-all shrink-0"
                              aria-label={`Remove ${m.firstName}`}
                            >
                              <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Join Requests (creator only) */}
                  {creator && (g.joinRequests || []).length > 0 && (
                    <div>
                      <h3 className="font-display font-bold text-navy mb-3">
                        Join Requests ({g.joinRequests.length})
                      </h3>
                      <div className="space-y-2">
                        {g.joinRequests.map((jr) => (
                          <div key={jr.userId} className="flex items-center gap-3 bg-sunny-light border-[3px] border-navy/10 rounded-xl px-4 py-3">
                            <div className="w-8 h-8 rounded-full bg-sunny text-navy flex items-center justify-center font-display font-bold text-sm shrink-0">
                              {jr.firstName?.[0]}{jr.lastName?.[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-navy text-sm truncate">
                                {jr.firstName} {jr.lastName}
                              </p>
                              {jr.matricNumber && <p className="text-xs text-slate">{jr.matricNumber}</p>}
                              <p className="text-[10px] text-navy/30">
                                Requested {new Date(jr.requestedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => approveRequest(g.id, jr.userId)}
                                disabled={actionLoading}
                                className="bg-teal border-[2px] border-navy press-2 press-navy px-3 py-1.5 rounded-lg font-display text-xs text-navy transition-all disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => rejectRequest(g.id, jr.userId)}
                                disabled={actionLoading}
                                className="bg-coral-light border-[2px] border-navy/30 px-3 py-1.5 rounded-lg font-display text-xs text-navy hover:border-navy transition-all disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invite Link (creator only) */}
                  {creator && g.inviteCode && (
                    <div className="bg-lavender-light border-[3px] border-navy/10 rounded-2xl p-4">
                      <h3 className="font-display font-bold text-navy text-sm mb-2 uppercase tracking-wider">
                        Invite Link
                      </h3>
                      <p className="text-xs text-slate mb-3">Share this link to let others join or request access, depending on group settings.</p>
                      <div className="flex gap-2 items-stretch">
                        <div className="flex-1 bg-snow border-[2px] border-navy/15 rounded-lg px-3 py-2 text-sm text-navy/70 truncate font-mono">
                          {typeof window !== "undefined"
                            ? `${window.location.origin}/dashboard/growth/study-groups?invite=${g.inviteCode}`
                            : `...?invite=${g.inviteCode}`}
                        </div>
                        <button
                          onClick={() => copyInviteLink(g.inviteCode!)}
                          className="bg-navy text-snow px-4 py-2 rounded-lg font-display font-bold text-xs border-[2px] border-lime press-2 press-lime transition-all shrink-0"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => regenerateInvite(g.id)}
                          disabled={actionLoading}
                          className="bg-snow border-[2px] border-navy/20 px-3 py-2 rounded-lg text-xs text-navy hover:border-navy transition-all shrink-0 disabled:opacity-50"
                          title="Generate new invite code"
                        >
                          <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bulk invite (creator only) */}
                  {creator && (
                    <div className="bg-teal-light border-[3px] border-navy/10 rounded-2xl p-4 space-y-3">
                      <h3 className="font-display font-bold text-navy text-sm uppercase tracking-wider">Invite Students</h3>
                      <p className="text-xs text-slate">Search and invite students in bulk (in-app + email).</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          value={inviteSearchQuery}
                          onChange={(e) => setInviteSearchQuery(e.target.value)}
                          title="Search students"
                          placeholder="Search by name, email, or matric number"
                          className="flex-1 px-4 py-2.5 border-[3px] border-navy/20 rounded-xl text-navy focus:border-teal focus:outline-none"
                        />
                        <button
                          onClick={() => searchInviteStudents(g.id)}
                          disabled={inviteSearching}
                          className="bg-navy text-snow px-4 py-2.5 rounded-xl font-display font-bold text-xs border-[3px] border-lime press-2 press-lime transition-all disabled:opacity-50"
                        >
                          {inviteSearching ? "Searching..." : "Search"}
                        </button>
                      </div>

                      {inviteSearchResults.length > 0 && (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {inviteSearchResults.map((student) => {
                            const checked = selectedInviteeIds.includes(student.id);
                            return (
                              <label key={student.id} className="flex items-start gap-3 bg-snow border-[2px] border-navy/10 rounded-xl px-3 py-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleInviteSelection(student.id)}
                                  title={`Select ${student.firstName} ${student.lastName}`}
                                  className="mt-1 w-4 h-4 accent-teal"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-navy truncate">{student.firstName} {student.lastName}</p>
                                  <p className="text-[11px] text-slate truncate">
                                    {student.email}
                                    {student.matricNumber ? ` · ${student.matricNumber}` : ""}
                                    {student.level ? ` · ${student.level}` : ""}
                                    {student.role && student.role !== "student" ? ` · ${student.role}` : ""}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setSelectedInviteeIds(inviteSearchResults.map((s) => s.id))}
                          disabled={inviteSearchResults.length === 0}
                          className="bg-snow border-[2px] border-navy/20 px-3 py-1.5 rounded-lg text-xs text-navy hover:border-navy transition-all disabled:opacity-40"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedInviteeIds([])}
                          disabled={selectedInviteeIds.length === 0}
                          className="bg-snow border-[2px] border-navy/20 px-3 py-1.5 rounded-lg text-xs text-navy hover:border-navy transition-all disabled:opacity-40"
                        >
                          Clear Selection
                        </button>
                        <button
                          onClick={() => sendBulkInvites(g.id)}
                          disabled={inviteSending || selectedInviteeIds.length === 0}
                          className="bg-teal border-[3px] border-navy press-2 press-navy px-4 py-2 rounded-xl font-display text-xs text-navy transition-all disabled:opacity-40"
                        >
                          {inviteSending ? "Sending..." : `Send Invites (${selectedInviteeIds.length})`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Feed Tab ── */}
              {detailTab === "feed" && (
                <GroupChatPanel
                  groupId={g.id}
                  userId={userId}
                  getAccessToken={getAccessToken}
                  initialOnlineUserIds={g.onlineMemberIds || []}
                  onPresenceChange={(onlineUserIds) => setSelectedGroup((prev) => prev ? { ...prev, onlineMemberIds: onlineUserIds } : prev)}
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
                                    <span>{s.meetupType === "online" ? "Online" : "Physical"}</span>
                                    {s.meetupType === "online"
                                      ? s.meetingLink && <span className="truncate max-w-[220px]">{s.meetingLink}</span>
                                      : s.location && <span>{s.location}</span>}
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
                                      <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd"/></svg>
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
                        <select
                          value={sessionMeetupType}
                          onChange={(e) => setSessionMeetupType(e.target.value as "physical" | "online")}
                          title="Meetup type"
                          className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy bg-snow focus:border-teal focus:outline-none"
                        >
                          <option value="physical">Physical meetup</option>
                          <option value="online">Online meetup</option>
                        </select>
                      </div>
                      {sessionMeetupType === "physical" ? (
                        <input
                          value={sessionLocation}
                          onChange={(e) => setSessionLocation(e.target.value)}
                          placeholder="Location"
                          maxLength={200}
                          className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-teal focus:outline-none"
                        />
                      ) : (
                        <input
                          value={sessionMeetingLink}
                          onChange={(e) => setSessionMeetingLink(e.target.value)}
                          placeholder="Meeting link (https://...)"
                          maxLength={500}
                          className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-teal focus:outline-none"
                        />
                      )}
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
                                <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd"/></svg>
                              ) : r.type === "document" ? (
                                <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" clipRule="evenodd"/></svg>
                              ) : (
                                <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M19.902 4.098a3.75 3.75 0 00-5.304 0l-4.5 4.5a3.75 3.75 0 001.035 6.037.75.75 0 01-.646 1.353 5.25 5.25 0 01-1.449-8.45l4.5-4.5a5.25 5.25 0 117.424 7.424l-1.757 1.757a.75.75 0 11-1.06-1.06l1.757-1.757a3.75 3.75 0 000-5.304zm-7.389 4.267a.75.75 0 011-.353 5.25 5.25 0 011.449 8.45l-4.5 4.5a5.25 5.25 0 11-7.424-7.424l1.757-1.757a.75.75 0 111.06 1.06l-1.757 1.757a3.75 3.75 0 105.304 5.304l4.5-4.5a3.75 3.75 0 00-1.035-6.037.75.75 0 01-.354-1z" clipRule="evenodd"/></svg>
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
                                <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>
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
                  <div className="relative w-8 h-8 rounded-full bg-navy text-snow flex items-center justify-center font-display font-bold text-sm">
                    {m.firstName?.[0]}{m.lastName?.[0]}
                    {(g.onlineMemberIds || []).includes(m.userId) && (
                      <span className="absolute -bottom-0.5 -right-0.5 inline-flex w-2.5 h-2.5 rounded-full bg-teal border border-snow" />
                    )}
                  </div>
                  <p className="font-medium text-navy text-sm truncate">
                    {m.firstName} {m.lastName}
                    {m.userId === g.createdBy && <span className="ml-1 text-[9px] font-bold uppercase text-lavender bg-lavender-light px-1.5 py-0.5 rounded">Head</span>}
                  </p>
                  {m.userId !== userId && (
                    <Link
                      href={buildMessagesHref({
                        userId: m.userId,
                        userName: `${m.firstName} ${m.lastName}`,
                        context: "study_group_preview",
                        contextId: g.id,
                        contextLabel: g.name,
                      })}
                      className="ml-auto text-[10px] font-bold bg-lime border-2 border-navy rounded-lg px-2 py-1 text-navy press-1 press-navy shrink-0"
                    >
                      Message
                    </Link>
                  )}
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
        <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

          {/* Visibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-label text-navy mb-1 block">
                Visibility <span className="text-coral">*</span>
              </label>
              <select
                value={formVisibility}
                onChange={(e) => setFormVisibility(e.target.value as "public" | "private")}
                title="Group visibility"
                className="w-full px-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors bg-snow"
              >
                <option value="public">Public (discoverable in browse)</option>
                <option value="private">Private (hidden, invite-only)</option>
              </select>
            </div>
            {formVisibility === "public" ? (
              <div className="flex items-end">
                <label className="flex items-center gap-3 cursor-pointer pb-1">
                  <input
                    type="checkbox"
                    checked={formPublicJoinRequiresApproval}
                    onChange={(e) => setFormPublicJoinRequiresApproval(e.target.checked)}
                    title="Require approval"
                    className="w-5 h-5 rounded accent-sunny"
                  />
                  <span className="font-display font-bold text-sm text-navy">Require Approval to Join</span>
                </label>
              </div>
            ) : (
              <div className="flex items-end">
                <p className="text-xs text-slate">Private groups always require approval.</p>
              </div>
            )}
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
                title="Group level"
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
                title="Maximum members"
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
      <ConfirmModal
        isOpen={Boolean(deleteTargetGroupId)}
        onClose={() => setDeleteTargetGroupId(null)}
        onConfirm={async () => {
          if (!deleteTargetGroupId) return;
          await deleteGroup(deleteTargetGroupId, true);
          setDeleteTargetGroupId(null);
        }}
        title="Delete study group"
        message="Delete this study group? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={actionLoading}
      />
      <ConfirmModal
        isOpen={Boolean(removeMemberTarget)}
        onClose={() => setRemoveMemberTarget(null)}
        onConfirm={async () => {
          if (!removeMemberTarget) return;
          await removeMember(removeMemberTarget.groupId, removeMemberTarget.memberId, true);
          setRemoveMemberTarget(null);
        }}
        title="Remove member"
        message="Remove this member from the group?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="warning"
        isLoading={actionLoading}
      />
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
            <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              <p className="text-xs text-slate mt-0.5">{groups.filter((g) => g.isOpen && getGroupVisibility(g) === "public").length} open public</p>
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
                  ? "bg-navy text-snow border-lime"
                  : "bg-snow text-navy border-navy/20 hover:border-navy"
              }`}
            >
              Browse All
            </button>
            <button
              onClick={() => setView("my-groups")}
              className={`px-5 py-2.5 rounded-xl font-display text-sm border-[3px] transition-all ${
                view === "my-groups"
                  ? "bg-navy text-snow border-lime"
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
                  placeholder="Search groups by name, topic, or tags..."
                  className="w-full pl-12 pr-4 py-3 border-[3px] border-navy/20 rounded-xl text-navy focus:border-coral focus:outline-none transition-colors"
                />
              </div>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                title="Filter by level"
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
                <svg aria-hidden="true" className="w-16 h-16 mx-auto text-cloud mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                  className="bg-transparent border-[3px] border-navy px-6 py-3 rounded-xl font-display text-navy hover:bg-navy hover:text-lime hover:border-lime transition-all"
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
          Public study groups are visible to all logged-in students. Private groups are hidden and invite-only.
          Your name and matric number are shared with group members.
          Data refreshes every 30 seconds.
        </div>
      </main>
    </div>
  );
}
