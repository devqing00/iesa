"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { useDM } from "@/context/DMContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/Modal";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

/* ─── Types ─────────────────────────────────────────────────────── */

interface Conversation {
  conversationKey: string;
  otherUserId: string;
  otherUserName: string;
  otherUserEmail: string;
  lastMessage: string;
  lastSenderId: string;
  lastAt: string;
  unreadCount: number;
  isBlocked?: boolean;
}

interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface SearchUser {
  id: string;
  name: string;
  email: string;
  level?: string;
  connectionStatus?: "connected" | "pending" | "none";
}

interface MessageRequest {
  requestId: string;
  user: { id: string; name: string; email: string; level?: string };
  message: string;
  createdAt: string;
}

interface ConnectionRequest {
  requestId: string;
  user: { id: string; name: string; email: string; level?: string };
  createdAt: string;
}

interface ConnectedUser {
  connectionId: string;
  user: { id: string; name: string; email: string; level?: string };
  connectedAt: string;
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* ─── Tabs ──────────────────────────────────────────────────────── */

type SidebarTab = "chats" | "requests" | "connections";

/* ─── Component ─────────────────────────────────────────────────── */

export default function MessagesPage() {
  const { getAccessToken, userProfile } = useAuth();
  const { showHelp, openHelp, closeHelp } = useToolHelp("messages");
  const toast = useToast();
  const { subscribe, setMessagesPageOpen, syncTotalUnread } = useDM();
  const currentUserId = userProfile?.id || "";
  // Stable ref so event handler closures always read the latest value
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  /* ── State: Core ── */
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);

  /* ── State: Tabs ── */
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chats");

  /* ── State: Search ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── State: Requests ── */
  const [msgRequests, setMsgRequests] = useState<MessageRequest[]>([]);
  const [connRequests, setConnRequests] = useState<ConnectionRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  /* ── State: Connections ── */
  const [connections, setConnections] = useState<ConnectedUser[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);

  /* ── State: Mute ── */
  const [muteInfo, setMuteInfo] = useState<{
    muted: boolean;
    mutedUntil?: string;
    reason?: string;
  } | null>(null);

  /* ── State: Modals ── */
  const [blockModal, setBlockModal] = useState<{
    open: boolean;
    userId: string;
    name: string;
  }>({ open: false, userId: "", name: "" });
  const [reportModal, setReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  /* ── Mobile view toggle ── */
  const [showThread, setShowThread] = useState(false);

  /* ── Scroll ref ── */
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ── selectedConv stable ref (for WS event handlers) ── */
  const selectedConvRef = useRef<Conversation | null>(null);
  selectedConvRef.current = selectedConv;

  /* ═══ API Helpers ═══ */

  const apiFetch = useCallback(
    async (path: string, opts?: RequestInit) => {
      const token = await getAccessToken();
      return fetch(getApiUrl(path), {
        ...opts,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(opts?.headers || {}),
        },
      });
    },
    [getAccessToken]
  );

  /* ── Fetch conversations ── */
  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/messages/conversations");
      if (!res.ok) throw new Error();
      const data: Conversation[] = await res.json();
      setConversations(data);
      // Keep context badge in sync with actual unread totals from the API
      syncTotalUnread(data.reduce((s, c) => s + c.unreadCount, 0));
    } catch {
      /* silent */
    } finally {
      setLoadingConvs(false);
    }
  }, [apiFetch, syncTotalUnread]);

  /* ── Fetch mute status ── */
  const fetchMuteStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/messages/mute-status");
      if (res.ok) setMuteInfo(await res.json());
    } catch {
      /* silent */
    }
  }, [apiFetch]);

  /* ── Fetch messages for a conversation ── */
  const fetchMessages = useCallback(
    async (otherUserId: string) => {
      setLoadingMsgs(true);
      try {
        const res = await apiFetch(
          `/api/v1/messages/conversation/${otherUserId}?pageSize=50`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setMessages(data.messages || []);
        setOtherUser(data.otherUser || null);
        setIsConnected(data.isConnected ?? false);
        setIsBlocked(data.isBlocked ?? false);
        setBlockedByMe(data.blockedByMe ?? false);

        // Mark as read
        await apiFetch(
          `/api/v1/messages/conversation/${otherUserId}/read`,
          { method: "POST" }
        );
        fetchConversations();
      } catch {
        toast.error("Failed to load messages");
      } finally {
        setLoadingMsgs(false);
      }
    },
    [apiFetch, fetchConversations, toast]
  );

  /* ── Fetch requests ── */
  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const [msgRes, connRes] = await Promise.all([
        apiFetch("/api/v1/messages/requests"),
        apiFetch("/api/v1/messages/connections/pending"),
      ]);
      if (msgRes.ok) setMsgRequests(await msgRes.json());
      if (connRes.ok) setConnRequests(await connRes.json());
    } catch {
      /* silent */
    } finally {
      setLoadingRequests(false);
    }
  }, [apiFetch]);

  /* ── Fetch connections ── */
  const fetchConnectionsList = useCallback(async () => {
    setLoadingConnections(true);
    try {
      const res = await apiFetch("/api/v1/messages/connections");
      if (res.ok) setConnections(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoadingConnections(false);
    }
  }, [apiFetch]);

  /* ═══ Actions ═══ */

  /* ── Send message ── */
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConv || sending) return;

    const content = newMessage.trim();
    setSending(true);
    setNewMessage("");
    try {
      const res = await apiFetch("/api/v1/messages/send", {
        method: "POST",
        body: JSON.stringify({
          recipientId: selectedConv.otherUserId,
          content,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed to send");
      }
      const data = await res.json();
      if (data.messageRequest) {
        toast.info("Message request sent! They need to accept before you can chat.");
      }
    } catch (e) {
      setNewMessage(content);
      toast.error(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  /* ── Connect / Follow ── */
  const handleConnect = async (userId: string) => {
    try {
      const res = await apiFetch("/api/v1/messages/connections/request", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed");
      }
      const data = await res.json();
      const msg = data.status === "accepted"
          ? "Connected! You can now message each other."
          : "Connection request sent!";
      toast.success(msg);
      fetchConnectionsList();
      fetchRequests();
      // Update search results in-place
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, connectionStatus: data.status === "accepted" ? "connected" : "pending" }
            : u
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send request");
    }
  };

  /* ── Respond to connection request ── */
  const respondConnection = async (requestId: string, action: "accept" | "decline") => {
    try {
      const res = await apiFetch(
        `/api/v1/messages/connections/${requestId}/respond`,
        { method: "POST", body: JSON.stringify({ action }) }
      );
      if (!res.ok) throw new Error();
      if (action === "accept") toast.success("Connection accepted!");
      else toast.info("Request declined");
      fetchRequests();
      fetchConnectionsList();
    } catch {
      toast.error("Failed to respond");
    }
  };

  /* ── Respond to message request ── */
  const respondMessageRequest = async (requestId: string, action: "accept" | "decline") => {
    try {
      const res = await apiFetch(
        `/api/v1/messages/requests/${requestId}/respond`,
        { method: "POST", body: JSON.stringify({ action }) }
      );
      if (!res.ok) throw new Error();
      if (action === "accept") toast.success("Request accepted! You can now chat.");
      else toast.info("Request declined");
      fetchRequests();
      fetchConversations();
      fetchConnectionsList();
    } catch {
      toast.error("Failed to respond");
    }
  };

  /* ── Block user ── */
  const handleBlock = async () => {
    if (!blockModal.userId) return;
    try {
      const res = await apiFetch("/api/v1/messages/block", {
        method: "POST",
        body: JSON.stringify({ userId: blockModal.userId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed");
      }
      toast.success(`${blockModal.name} has been blocked`);
      setBlockModal({ open: false, userId: "", name: "" });
      // If viewing their conversation, update state
      if (selectedConv?.otherUserId === blockModal.userId) {
        setIsBlocked(true);
        setBlockedByMe(true);
      }
      fetchConversations();
      fetchConnectionsList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to block");
    }
  };

  /* ── Unblock user ── */
  const handleUnblock = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/v1/messages/block/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("User unblocked");
      if (selectedConv?.otherUserId === userId) {
        setIsBlocked(false);
        setBlockedByMe(false);
      }
      fetchConversations();
    } catch {
      toast.error("Failed to unblock");
    }
  };

  /* ── Report user ── */
  const handleReport = async () => {
    if (!selectedConv || !reportReason.trim()) return;
    setReportSubmitting(true);
    try {
      const res = await apiFetch("/api/v1/messages/report", {
        method: "POST",
        body: JSON.stringify({
          reportedUserId: selectedConv.otherUserId,
          reason: reportReason.trim(),
          messageIds: messages
            .filter((m) => m.senderId === selectedConv.otherUserId)
            .slice(-5)
            .map((m) => m.id),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed");
      }
      toast.success("Report submitted. An admin will review it.");
      setReportModal(false);
      setReportReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to report");
    } finally {
      setReportSubmitting(false);
    }
  };

  /* ── Remove connection ── */
  const handleRemoveConnection = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/v1/messages/connections/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.info("Connection removed");
      fetchConnectionsList();
    } catch {
      toast.error("Failed to remove connection");
    }
  };

  /* ═══ Navigation ═══ */

  const startConversation = (user: { id: string; name: string; email: string }) => {
    const existingConv = conversations.find((c) => c.otherUserId === user.id);
    const conv: Conversation = existingConv || {
      conversationKey: "",
      otherUserId: user.id,
      otherUserName: user.name,
      otherUserEmail: user.email,
      lastMessage: "",
      lastSenderId: "",
      lastAt: new Date().toISOString(),
      unreadCount: 0,
    };
    setSelectedConv(conv);
    setOtherUser({ id: user.id, name: user.name, email: user.email });
    setSearchQuery("");
    setSearchResults([]);
    setShowThread(true);
    fetchMessages(user.id);
  };

  const selectConversation = (conv: Conversation) => {
    setSelectedConv(conv);
    setShowThread(true);
    fetchMessages(conv.otherUserId);
  };

  /* ═══ Effects ═══ */

  /* ── Search users ── */
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(
          `/api/v1/messages/search-users?q=${encodeURIComponent(searchQuery)}`
        );
        if (res.ok) setSearchResults(await res.json());
      } catch {
        /* silent */
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, apiFetch]);

  /* ── Tab data loading ── */
  useEffect(() => {
    if (sidebarTab === "requests") fetchRequests();
    if (sidebarTab === "connections") fetchConnectionsList();
  }, [sidebarTab, fetchRequests, fetchConnectionsList]);

  /* ── Initial load + WS ── */
  useEffect(() => {
    // Tell context this page is open so it stops double-counting unreads
    setMessagesPageOpen(true);
    fetchConversations();
    fetchMuteStatus();
    return () => {
      setMessagesPageOpen(false);
    };
  }, [setMessagesPageOpen, fetchConversations, fetchMuteStatus]);

  /* ── Subscribe to global DM WebSocket events from DMContext ── */
  useEffect(() => {
    return subscribe((packet) => {
      if (packet.type === "new_message") {
        const msg = packet.data;
        const activeConv = selectedConvRef.current;
        const meId = currentUserIdRef.current;

        // Append message to thread if conversation is open
        if (
          activeConv &&
          (msg.senderId === activeConv.otherUserId ||
            msg.recipientId === activeConv.otherUserId)
        ) {
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: msg.id,
                    senderId: msg.senderId,
                    recipientId: msg.recipientId,
                    content: msg.content,
                    isRead: msg.isRead,
                    createdAt: msg.createdAt,
                  },
                ]
          );
        }

        // Update conversation list with latest message + unread count
        setConversations((prev) => {
          const otherUserId =
            msg.senderId === meId ? msg.recipientId : msg.senderId;
          const existing = prev.find((c) => c.otherUserId === otherUserId);
          const currentActive = selectedConvRef.current;

          if (existing) {
            const updated: Conversation = {
              ...existing,
              lastMessage: msg.content.slice(0, 100),
              lastSenderId: msg.senderId,
              lastAt: msg.createdAt,
              unreadCount:
                msg.senderId !== meId &&
                currentActive?.otherUserId !== otherUserId
                  ? existing.unreadCount + 1
                  : existing.unreadCount,
            };
            return [updated, ...prev.filter((c) => c !== existing)];
          }

          return [
            {
              conversationKey: msg.conversationKey,
              otherUserId,
              otherUserName: msg.senderName || "Unknown",
              otherUserEmail: "",
              lastMessage: msg.content.slice(0, 100),
              lastSenderId: msg.senderId,
              lastAt: msg.createdAt,
              unreadCount: msg.senderId !== meId ? 1 : 0,
            },
            ...prev,
          ];
        });
      }

      if (packet.type === "messages_read") {
        const { conversationKey, readBy } = packet.data;
        const activeConv = selectedConvRef.current;

        if (activeConv?.conversationKey === conversationKey) {
          setMessages((prev) =>
            prev.map((m) =>
              m.recipientId === readBy && !m.isRead
                ? { ...m, isRead: true }
                : m
            )
          );
        }

        setConversations((prev) =>
          prev.map((c) =>
            c.conversationKey === conversationKey
              ? { ...c, unreadCount: 0 }
              : c
          )
        );
      }

      if (
        packet.type === "connection_request" ||
        packet.type === "message_request"
      ) {
        fetchRequests();
      }

      if (
        packet.type === "connection_accepted" ||
        packet.type === "message_request_accepted"
      ) {
        fetchConnectionsList();
        fetchConversations();
      }

      if (packet.type === "muted") {
        fetchMuteStatus();
      }
    });
  }, [subscribe, fetchRequests, fetchConnectionsList, fetchConversations, fetchMuteStatus]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Group messages by date ── */
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  let lastDate = "";
  for (const msg of messages) {
    const d = formatDate(msg.createdAt);
    if (d !== lastDate) {
      groupedMessages.push({ date: d, msgs: [msg] });
      lastDate = d;
    } else {
      groupedMessages[groupedMessages.length - 1].msgs.push(msg);
    }
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);
  const totalRequests = msgRequests.length + connRequests.length;

  /* ═══ Render ═══ */
  return (
    <main id="main-content" className="min-h-screen bg-ghost">
      <DashboardHeader title="Messages" />
      <ToolHelpModal toolId="messages" isOpen={showHelp} onClose={closeHelp} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-end mb-3"><HelpButton onClick={openHelp} /></div>
        {/* ── Mute Banner ── */}
        {muteInfo?.muted && (
          <div className="mb-4 bg-coral-light border-[3px] border-coral rounded-2xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-coral shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.499-2.599 4.499H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-bold text-navy text-sm">Messaging Suspended</p>
              <p className="text-navy-muted text-xs mt-0.5">
                Your messaging privileges are suspended until{" "}
                {new Date(muteInfo.mutedUntil!).toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" })}.
                {muteInfo.reason && ` Reason: ${muteInfo.reason}`}
              </p>
            </div>
          </div>
        )}

        {/* ── Top Bar ── */}
        <div className="mb-6">
          <h1 className="font-display font-black text-display-md text-navy">
            Messages
          </h1>
          <p className="text-slate text-sm mt-1">
            Connect and chat with fellow students
            {totalUnread > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-coral text-snow text-xs font-bold">
                {totalUnread} unread
              </span>
            )}
          </p>
        </div>

        {/* ── Layout ── */}
        <div className="flex gap-4 h-[calc(100vh-16rem)]">
          {/* ═══ SIDEBAR ═══ */}
          <div
            className={`w-full md:w-[22rem] md:shrink-0 flex flex-col bg-snow border-[3px] border-navy rounded-2xl overflow-hidden ${
              showThread ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Sidebar Tabs */}
            <div className="flex border-b-[2px] border-cloud">
              {(
                [
                  { key: "chats", label: "Chats", badge: totalUnread },
                  { key: "requests", label: "Requests", badge: totalRequests },
                  { key: "connections", label: "People", badge: 0 },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSidebarTab(tab.key)}
                  className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative ${
                    sidebarTab === tab.key
                      ? "text-navy border-b-[3px] border-lime -mb-[2px]"
                      : "text-slate hover:text-navy"
                  }`}
                >
                  {tab.label}
                  {tab.badge > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-coral text-snow text-[9px] font-bold">
                      {tab.badge > 9 ? "9+" : tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Chats Tab ── */}
            {sidebarTab === "chats" && (
              <>
                {/* Search bar */}
                <div className="p-3 border-b-[2px] border-cloud">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search students to chat..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-ghost border-[2px] border-cloud rounded-xl text-sm text-navy placeholder:text-slate focus:border-navy focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Search results */}
                  {(searchResults.length > 0 || searching) && (
                    <div className="mt-2 bg-snow border-[2px] border-navy rounded-xl shadow-[4px_4px_0_0_#000] overflow-hidden max-h-56 overflow-y-auto">
                      {searching ? (
                        <div className="p-3 text-center text-slate text-sm">
                          Searching...
                        </div>
                      ) : (
                        searchResults.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between px-3 py-2.5 border-b border-cloud last:border-0 hover:bg-ghost transition-colors"
                          >
                            <button
                              onClick={() => startConversation(u)}
                              className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                            >
                              <div className="w-8 h-8 rounded-full bg-lavender-light border-[2px] border-navy flex items-center justify-center shrink-0">
                                <span className="font-display font-black text-[10px] text-navy">
                                  {initials(u.name)}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-navy truncate">{u.name}</div>
                                <div className="text-[10px] text-slate truncate">
                                  {u.email}
                                  {u.level && <span className="ml-1 text-lavender font-medium">{u.level}</span>}
                                </div>
                              </div>
                            </button>
                            {/* Connection button in search */}
                            {u.connectionStatus === "connected" ? (
                              <span className="text-[9px] font-bold text-teal bg-teal-light px-1.5 py-0.5 rounded-lg shrink-0">
                                Connected
                              </span>
                            ) : u.connectionStatus === "pending" ? (
                              <span className="text-[9px] font-bold text-sunny bg-sunny-light px-1.5 py-0.5 rounded-lg shrink-0">
                                Pending
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConnect(u.id);
                                }}
                                className="text-[9px] font-bold text-navy bg-lime px-1.5 py-0.5 rounded-lg shrink-0 hover:bg-lime-dark transition-colors"
                              >
                                Connect
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto">
                  {loadingConvs ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-4 border-lime border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-lavender-light flex items-center justify-center mb-3">
                        <svg className="w-7 h-7 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-2.234a4.75 4.75 0 0 1-1.087-3.275V10.66a4.795 4.795 0 0 1 0-7.893Z" />
                          <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
                        </svg>
                      </div>
                      <p className="font-bold text-navy text-sm">No conversations yet</p>
                      <p className="text-slate text-xs mt-1">
                        Search for a student to start chatting
                      </p>
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <button
                        key={conv.conversationKey || conv.otherUserId}
                        onClick={() => selectConversation(conv)}
                        className={`w-full text-left px-3 py-3 border-b border-cloud/80 hover:bg-ghost/60 transition-colors ${
                          selectedConv?.otherUserId === conv.otherUserId
                            ? "bg-lime-light/50"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className={`w-10 h-10 rounded-full border-[2px] border-navy flex items-center justify-center shrink-0 ${
                            conv.isBlocked ? "bg-cloud" : "bg-lavender-light"
                          }`}>
                            <span className="font-display font-black text-xs text-navy">
                              {initials(conv.otherUserName)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className={`font-bold text-sm truncate ${
                                conv.isBlocked ? "text-slate line-through" : "text-navy"
                              }`}>
                                {conv.otherUserName}
                              </span>
                              <span className="text-[10px] text-slate ml-2 shrink-0">
                                {timeAgo(conv.lastAt)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-xs text-slate truncate">
                                {conv.lastSenderId === currentUserId && (
                                  <span className="text-navy-muted">You: </span>
                                )}
                                {conv.isBlocked ? "Blocked" : conv.lastMessage}
                              </span>
                              {conv.unreadCount > 0 && (
                                <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-coral text-snow text-[10px] font-bold px-1 shrink-0">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {/* ── Requests Tab ── */}
            {sidebarTab === "requests" && (
              <div className="flex-1 overflow-y-auto">
                {loadingRequests ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-lime border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : msgRequests.length === 0 && connRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-teal-light flex items-center justify-center mb-3">
                      <svg className="w-7 h-7 text-teal" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6.25 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM3.25 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM19.75 7.5a.75.75 0 0 0-1.5 0v2.25H16a.75.75 0 0 0 0 1.5h2.25v2.25a.75.75 0 0 0 1.5 0v-2.25H22a.75.75 0 0 0 0-1.5h-2.25V7.5Z" />
                      </svg>
                    </div>
                    <p className="font-bold text-navy text-sm">No pending requests</p>
                    <p className="text-slate text-xs mt-1">
                      Connection and message requests will appear here
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Message Requests */}
                    {msgRequests.length > 0 && (
                      <div>
                        <div className="px-3 pt-3 pb-1">
                          <span className="text-label text-slate">Message Requests</span>
                        </div>
                        {msgRequests.map((req) => (
                          <div key={req.requestId} className="px-3 py-3 border-b border-cloud">
                            <div className="flex items-start gap-2.5">
                              <div className="w-9 h-9 rounded-full bg-sunny-light border-[2px] border-navy flex items-center justify-center shrink-0">
                                <span className="font-display font-black text-[10px] text-navy">
                                  {initials(req.user.name)}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-xs text-navy">{req.user.name}</div>
                                <div className="text-[10px] text-slate">{req.user.email}</div>
                                {req.message && (
                                  <p className="mt-1.5 text-xs text-navy bg-ghost rounded-lg px-2.5 py-1.5 italic">
                                    &ldquo;{req.message}&rdquo;
                                  </p>
                                )}
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => respondMessageRequest(req.requestId, "accept")}
                                    className="text-[10px] font-bold bg-lime text-navy px-3 py-1 rounded-lg border-[2px] border-navy press-2 press-navy"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => respondMessageRequest(req.requestId, "decline")}
                                    className="text-[10px] font-bold bg-ghost text-navy px-3 py-1 rounded-lg border-[2px] border-cloud hover:border-coral hover:bg-coral-light transition-colors"
                                  >
                                    Decline
                                  </button>
                                </div>
                              </div>
                              <span className="text-[9px] text-slate shrink-0">{timeAgo(req.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Connection Requests */}
                    {connRequests.length > 0 && (
                      <div>
                        <div className="px-3 pt-3 pb-1">
                          <span className="text-label text-slate">Connection Requests</span>
                        </div>
                        {connRequests.map((req) => (
                          <div key={req.requestId} className="px-3 py-3 border-b border-cloud">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-full bg-lavender-light border-[2px] border-navy flex items-center justify-center shrink-0">
                                <span className="font-display font-black text-[10px] text-navy">
                                  {initials(req.user.name)}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-xs text-navy">{req.user.name}</div>
                                <div className="text-[10px] text-slate">{req.user.email}</div>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  onClick={() => respondConnection(req.requestId, "accept")}
                                  className="text-[10px] font-bold bg-lime text-navy px-2.5 py-1 rounded-lg border-[2px] border-navy press-2 press-navy"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => respondConnection(req.requestId, "decline")}
                                  className="text-[10px] font-bold bg-ghost text-navy px-2.5 py-1 rounded-lg border-[2px] border-cloud hover:border-coral transition-colors"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Connections Tab ── */}
            {sidebarTab === "connections" && (
              <div className="flex-1 overflow-y-auto">
                {loadingConnections ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-lime border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : connections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-lime-light flex items-center justify-center mb-3">
                      <svg className="w-7 h-7 text-lime-dark" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="font-bold text-navy text-sm">No connections yet</p>
                    <p className="text-slate text-xs mt-1">
                      Search for students and send connection requests
                    </p>
                  </div>
                ) : (
                  connections.map((conn) => (
                    <div
                      key={conn.connectionId}
                      className="flex items-center gap-2.5 px-3 py-3 border-b border-cloud hover:bg-ghost/50 transition-colors"
                    >
                      <button
                        onClick={() => startConversation(conn.user)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-teal-light border-[2px] border-navy flex items-center justify-center shrink-0">
                          <span className="font-display font-black text-[10px] text-navy">
                            {initials(conn.user.name)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-navy truncate">{conn.user.name}</div>
                          <div className="text-[10px] text-slate truncate">{conn.user.email}</div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleRemoveConnection(conn.user.id)}
                        className="text-[9px] font-bold text-slate hover:text-coral px-1.5 py-0.5 rounded transition-colors shrink-0"
                        title="Remove connection"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ═══ THREAD ═══ */}
          <div
            className={`flex-1 flex flex-col bg-snow border-[3px] border-navy rounded-2xl overflow-hidden ${
              showThread ? "flex" : "hidden md:flex"
            }`}
          >
            {selectedConv ? (
              <>
                {/* Thread header */}
                <div className="px-4 py-3 border-b-[2px] border-cloud flex items-center gap-3">
                  <button
                    onClick={() => setShowThread(false)}
                    className="md:hidden p-1 rounded-lg hover:bg-ghost transition-colors"
                    aria-label="Back to conversations"
                  >
                    <svg className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className={`w-9 h-9 rounded-full border-[2px] border-navy flex items-center justify-center shrink-0 ${
                    isBlocked ? "bg-cloud" : "bg-teal-light"
                  }`}>
                    <span className="font-display font-black text-xs text-navy">
                      {initials(otherUser?.name || selectedConv.otherUserName)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-navy truncate">
                      {otherUser?.name || selectedConv.otherUserName}
                    </div>
                    <div className="text-[10px] text-slate">
                      {isBlocked
                        ? blockedByMe
                          ? "You blocked this user"
                          : "This user has blocked you"
                        : isConnected
                          ? "Connected"
                          : "Not connected — messages go as requests"}
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Report */}
                    {!isBlocked && (
                      <button
                        onClick={() => setReportModal(true)}
                        className="p-1.5 rounded-lg text-slate hover:text-coral hover:bg-coral-light transition-colors"
                        title="Report user"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M3 2.25a.75.75 0 0 1 .75.75v.54l1.838-.46a9.75 9.75 0 0 1 6.725.738l.108.054a8.25 8.25 0 0 0 5.58.652l3.109-.732a.75.75 0 0 1 .917.81 47.784 47.784 0 0 0 .005 10.337.75.75 0 0 1-.574.812l-3.114.733a9.75 9.75 0 0 1-6.594-.77l-.108-.054a8.25 8.25 0 0 0-5.69-.625l-1.81.452A.75.75 0 0 1 3 14.175V3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    {/* Block / Unblock */}
                    {blockedByMe ? (
                      <button
                        onClick={() => handleUnblock(selectedConv.otherUserId)}
                        className="text-[10px] font-bold text-teal bg-teal-light px-2 py-1 rounded-lg hover:bg-teal/20 transition-colors"
                      >
                        Unblock
                      </button>
                    ) : !isBlocked ? (
                      <button
                        onClick={() =>
                          setBlockModal({
                            open: true,
                            userId: selectedConv.otherUserId,
                            name: otherUser?.name || selectedConv.otherUserName,
                          })
                        }
                        className="p-1.5 rounded-lg text-slate hover:text-coral hover:bg-coral-light transition-colors"
                        title="Block user"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {loadingMsgs ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-8 h-8 border-4 border-lime border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-16 h-16 rounded-2xl bg-lime-light flex items-center justify-center mb-3">
                        <svg className="w-8 h-8 text-lime-dark" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-2.234a4.75 4.75 0 0 1-1.087-3.275V10.66a4.795 4.795 0 0 1 0-7.893Z" />
                          <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
                        </svg>
                      </div>
                      <p className="font-bold text-navy text-sm">Start the conversation</p>
                      <p className="text-slate text-xs mt-1">
                        {isConnected
                          ? `Send a message to ${otherUser?.name || selectedConv.otherUserName}`
                          : "You're not connected yet — your first message will be sent as a request"}
                      </p>
                    </div>
                  ) : (
                    groupedMessages.map((group) => (
                      <div key={group.date}>
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-cloud" />
                          <span className="text-[10px] text-slate font-medium uppercase tracking-wider">
                            {group.date}
                          </span>
                          <div className="flex-1 h-px bg-cloud" />
                        </div>

                        {group.msgs.map((msg) => {
                          const isMine = msg.senderId === currentUserId;
                          return (
                            <div
                              key={msg.id}
                              className={`flex mb-2 ${isMine ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                                  isMine
                                    ? "bg-lime text-navy rounded-br-md"
                                    : "bg-ghost text-navy rounded-bl-md"
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                  {msg.content}
                                </p>
                                <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                                  <span className="text-[10px] text-navy-muted">
                                    {formatTime(msg.createdAt)}
                                  </span>
                                  {isMine && (
                                    <svg
                                      className={`w-3 h-3 ${msg.isRead ? "text-teal" : "text-navy-muted"}`}
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth={2.5}
                                    >
                                      {msg.isRead ? (
                                        <path d="M18 7l-8.5 8.5L5 11M22 7l-8.5 8.5" />
                                      ) : (
                                        <path d="M20 6L9 17l-5-5" />
                                      )}
                                    </svg>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message input */}
                {isBlocked ? (
                  <div className="px-4 py-4 border-t-[2px] border-cloud text-center">
                    <p className="text-slate text-sm">
                      {blockedByMe
                        ? "You blocked this user. Unblock to resume chatting."
                        : "You can't reply to this conversation."}
                    </p>
                  </div>
                ) : muteInfo?.muted ? (
                  <div className="px-4 py-4 border-t-[2px] border-cloud text-center">
                    <p className="text-coral text-sm font-bold">Messaging suspended</p>
                  </div>
                ) : (
                  <div className="px-4 py-3 border-t-[2px] border-cloud">
                    {!isConnected && (
                      <div className="mb-2 flex items-center gap-2 px-3 py-1.5 bg-sunny-light rounded-xl">
                        <svg className="w-3.5 h-3.5 text-sunny shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[10px] text-navy-muted">
                          Not connected — this will be sent as a message request
                        </span>
                      </div>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                      }}
                      className="flex items-end gap-2"
                    >
                      <textarea
                        value={newMessage}
                        onChange={(e) => {
                          setNewMessage(e.target.value);
                          // Auto-resize textarea
                          const el = e.target;
                          el.style.height = "auto";
                          el.style.height = Math.min(el.scrollHeight, 120) + "px";
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder={isConnected ? "Type a message... (Shift+Enter for new line)" : "Write your message request..."}
                        rows={1}
                        className="flex-1 resize-none px-4 py-2.5 bg-ghost border-[2px] border-cloud rounded-xl text-sm text-navy placeholder:text-slate focus:border-navy focus:outline-none transition-colors"
                        style={{ maxHeight: "120px" }}
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="shrink-0 w-10 h-10 rounded-xl bg-lime border-[2px] border-navy flex items-center justify-center press-3 press-navy disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        aria-label="Send message"
                      >
                        {sending ? (
                          <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-5 h-5 text-navy" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                          </svg>
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </>
            ) : (
              /* No conversation selected */
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-20 h-20 rounded-2xl bg-lavender-light flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-lavender" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-2.234a4.75 4.75 0 0 1-1.087-3.275V10.66a4.795 4.795 0 0 1 0-7.893Z" />
                    <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
                  </svg>
                </div>
                <h2 className="font-display font-black text-lg text-navy">
                  Select a conversation
                </h2>
                <p className="text-slate text-sm mt-1 max-w-xs">
                  Choose a conversation from the left, or search for a student to start chatting
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Modals ═══ */}

      {/* Block Confirm Modal */}
      <ConfirmModal
        isOpen={blockModal.open}
        onClose={() => setBlockModal({ open: false, userId: "", name: "" })}
        onConfirm={handleBlock}
        title="Block User"
        message={`Are you sure you want to block ${blockModal.name}? They won't be able to message you, and your connection will be removed.`}
        confirmLabel="Block"
        variant="danger"
      />

      {/* Report Modal */}
      {reportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm px-4"
          onClick={() => !reportSubmitting && setReportModal(false)}
        >
          <div
            className="bg-snow border-[3px] border-navy rounded-2xl shadow-[8px_8px_0_0_#000] w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-black text-lg text-navy mb-1">
              Report User
            </h3>
            <p className="text-slate text-sm mb-4">
              Report{" "}
              <span className="font-bold text-navy">
                {otherUser?.name || selectedConv?.otherUserName}
              </span>{" "}
              for abusive behaviour. An admin will review this.
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe the issue (min 5 characters)..."
              rows={4}
              className="w-full px-4 py-3 bg-ghost border-[2px] border-cloud rounded-xl text-sm text-navy placeholder:text-slate focus:border-navy focus:outline-none transition-colors resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setReportModal(false);
                  setReportReason("");
                }}
                disabled={reportSubmitting}
                className="px-4 py-2 text-sm font-bold text-navy bg-ghost rounded-xl border-[2px] border-cloud hover:border-navy transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                disabled={reportReason.trim().length < 5 || reportSubmitting}
                className="px-4 py-2 text-sm font-bold text-snow bg-coral rounded-xl border-[2px] border-navy press-3 press-navy disabled:opacity-50 transition-all"
              >
                {reportSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
