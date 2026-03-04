"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useToast } from "@/components/ui/Toast";

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

/* ─── Component ─────────────────────────────────────────────────── */

export default function MessagesPage() {
  const { getAccessToken, userProfile } = useAuth();
  const { showToast } = useToast();
  const currentUserId = userProfile?.id || "";

  /* ── State ── */
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

  /* ── Search ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Mobile view toggle ── */
  const [showThread, setShowThread] = useState(false);

  /* ── Scroll ref ── */
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fetch conversations ── */
  const fetchConversations = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/messages/conversations"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load conversations");
      const data: Conversation[] = await res.json();
      setConversations(data);
    } catch {
      /* silent on poll */
    } finally {
      setLoadingConvs(false);
    }
  }, [getAccessToken]);

  /* ── Fetch messages for a conversation ── */
  const fetchMessages = useCallback(
    async (otherUserId: string) => {
      setLoadingMsgs(true);
      try {
        const token = await getAccessToken();
        const res = await fetch(
          getApiUrl(`/api/v1/messages/conversation/${otherUserId}?pageSize=50`),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error("Failed to load messages");
        const data = await res.json();
        setMessages(data.messages || []);
        setOtherUser(data.otherUser || null);

        // Mark as read
        await fetch(
          getApiUrl(`/api/v1/messages/conversation/${otherUserId}/read`),
          { method: "POST", headers: { Authorization: `Bearer ${token}` } }
        );

        // Refresh unread counts
        fetchConversations();
      } catch {
        showToast("Failed to load messages", "error");
      } finally {
        setLoadingMsgs(false);
      }
    },
    [getAccessToken, fetchConversations, showToast]
  );

  /* ── Send message ── */
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConv || sending) return;

    setSending(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl("/api/v1/messages/send"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientId: selectedConv.otherUserId,
          content: newMessage.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed to send");
      }
      setNewMessage("");
      await fetchMessages(selectedConv.otherUserId);
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Failed to send message",
        "error"
      );
    } finally {
      setSending(false);
    }
  };

  /* ── Start new conversation from search ── */
  const startConversation = (user: SearchUser) => {
    const existingConv = conversations.find(
      (c) => c.otherUserId === user.id
    );
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

  /* ── Select conversation ── */
  const selectConversation = (conv: Conversation) => {
    setSelectedConv(conv);
    setShowThread(true);
    fetchMessages(conv.otherUserId);
  };

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
        const token = await getAccessToken();
        const res = await fetch(
          getApiUrl(
            `/api/v1/messages/search-users?q=${encodeURIComponent(searchQuery)}`
          ),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          setSearchResults(await res.json());
        }
      } catch {
        /* silent */
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, getAccessToken]);

  /* ── Initial load + polling ── */
  useEffect(() => {
    fetchConversations();
    pollRef.current = setInterval(fetchConversations, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchConversations]);

  /* ── Poll active thread ── */
  useEffect(() => {
    if (!selectedConv) return;
    const id = setInterval(() => fetchMessages(selectedConv.otherUserId), 10000);
    return () => clearInterval(id);
  }, [selectedConv, fetchMessages]);

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

  /* ── Total unread ── */
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <main id="main-content" className="min-h-screen bg-ghost">
      <DashboardHeader title="Messages" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Top Bar ── */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display font-black text-display-md text-navy">
              Messages
            </h1>
            <p className="text-slate text-sm mt-1">
              Chat with fellow students
              {totalUnread > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-coral text-snow text-xs font-bold">
                  {totalUnread} unread
                </span>
              )}
            </p>
          </div>
        </div>

        {/* ── Layout ── */}
        <div className="flex gap-4 h-[calc(100vh-16rem)]">
          {/* ── Sidebar: Conversations ── */}
          <div
            className={`w-full md:w-96 md:shrink-0 flex flex-col bg-snow border-[3px] border-navy rounded-2xl overflow-hidden ${
              showThread ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Search */}
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
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-ghost border-[2px] border-cloud rounded-xl text-sm text-navy placeholder:text-slate focus:border-navy focus:outline-none transition-colors"
                />
              </div>

              {/* Search results dropdown */}
              {(searchResults.length > 0 || searching) && (
                <div className="mt-2 bg-snow border-[2px] border-navy rounded-xl shadow-[4px_4px_0_0_#000] overflow-hidden max-h-48 overflow-y-auto">
                  {searching ? (
                    <div className="p-3 text-center text-slate text-sm">
                      Searching...
                    </div>
                  ) : (
                    searchResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => startConversation(u)}
                        className="w-full text-left px-4 py-3 hover:bg-lime-light transition-colors border-b border-cloud last:border-0"
                      >
                        <div className="font-bold text-sm text-navy">
                          {u.name}
                        </div>
                        <div className="text-xs text-slate">
                          {u.email}
                          {u.level && (
                            <span className="ml-2 text-lavender font-medium">
                              {u.level}
                            </span>
                          )}
                        </div>
                      </button>
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
                  <svg
                    className="w-16 h-16 text-cloud mb-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-2.234a4.75 4.75 0 0 1-1.087-3.275V10.66a4.795 4.795 0 0 1 0-7.893Z" />
                    <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
                  </svg>
                  <p className="font-bold text-navy text-sm">No messages yet</p>
                  <p className="text-slate text-xs mt-1">
                    Search for a student above to start chatting
                  </p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.conversationKey || conv.otherUserId}
                    onClick={() => selectConversation(conv)}
                    className={`w-full text-left px-4 py-3 border-b-[2px] border-cloud hover:bg-ghost transition-colors ${
                      selectedConv?.otherUserId === conv.otherUserId
                        ? "bg-lime-light"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-lavender-light border-[2px] border-navy flex items-center justify-center shrink-0">
                          <span className="font-display font-black text-sm text-navy">
                            {conv.otherUserName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-navy truncate">
                            {conv.otherUserName}
                          </div>
                          <div className="text-xs text-slate truncate max-w-48">
                            {conv.lastSenderId === currentUserId && (
                              <span className="text-navy-muted">You: </span>
                            )}
                            {conv.lastMessage}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                        <span className="text-[10px] text-slate">
                          {timeAgo(conv.lastAt)}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-coral text-snow text-[10px] font-bold">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Thread ── */}
          <div
            className={`flex-1 flex flex-col bg-snow border-[3px] border-navy rounded-2xl overflow-hidden ${
              showThread ? "flex" : "hidden md:flex"
            }`}
          >
            {selectedConv ? (
              <>
                {/* Thread header */}
                <div className="px-4 py-3 border-b-[2px] border-cloud flex items-center gap-3">
                  {/* Back button (mobile) */}
                  <button
                    onClick={() => setShowThread(false)}
                    className="md:hidden p-1 rounded-lg hover:bg-ghost transition-colors"
                    aria-label="Back to conversations"
                  >
                    <svg
                      className="w-5 h-5 text-navy"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="w-9 h-9 rounded-full bg-teal-light border-[2px] border-navy flex items-center justify-center shrink-0">
                    <span className="font-display font-black text-xs text-navy">
                      {(otherUser?.name || selectedConv.otherUserName)
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-sm text-navy">
                      {otherUser?.name || selectedConv.otherUserName}
                    </div>
                    <div className="text-xs text-slate">
                      {otherUser?.email || selectedConv.otherUserEmail}
                    </div>
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
                      <div className="w-16 h-16 rounded-full bg-lime-light flex items-center justify-center mb-3">
                        <svg
                          className="w-8 h-8 text-lime-dark"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-2.234a4.75 4.75 0 0 1-1.087-3.275V10.66a4.795 4.795 0 0 1 0-7.893Z" />
                          <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
                        </svg>
                      </div>
                      <p className="font-bold text-navy text-sm">
                        Start the conversation
                      </p>
                      <p className="text-slate text-xs mt-1">
                        Send a message to{" "}
                        {otherUser?.name || selectedConv.otherUserName}
                      </p>
                    </div>
                  ) : (
                    groupedMessages.map((group) => (
                      <div key={group.date}>
                        {/* Date separator */}
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-cloud" />
                          <span className="text-[10px] text-slate font-medium uppercase tracking-wider">
                            {group.date}
                          </span>
                          <div className="flex-1 h-px bg-cloud" />
                        </div>

                        {/* Messages */}
                        {group.msgs.map((msg) => {
                          const isMine = msg.senderId === currentUserId;
                          return (
                            <div
                              key={msg.id}
                              className={`flex mb-2 ${
                                isMine ? "justify-end" : "justify-start"
                              }`}
                            >
                              <div
                                className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                                  isMine
                                    ? "bg-lime text-navy rounded-br-md"
                                    : "bg-ghost text-navy rounded-bl-md"
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                                <div
                                  className={`flex items-center gap-1 mt-1 ${
                                    isMine ? "justify-end" : "justify-start"
                                  }`}
                                >
                                  <span className="text-[10px] text-navy-muted">
                                    {formatTime(msg.createdAt)}
                                  </span>
                                  {isMine && (
                                    <svg
                                      className={`w-3 h-3 ${
                                        msg.isRead
                                          ? "text-teal"
                                          : "text-navy-muted"
                                      }`}
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
                <div className="px-4 py-3 border-t-[2px] border-cloud">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex items-end gap-2"
                  >
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type a message..."
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
                        <svg
                          className="w-5 h-5 text-navy"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                        </svg>
                      )}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              /* No conversation selected */
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-20 h-20 rounded-full bg-lavender-light flex items-center justify-center mb-4">
                  <svg
                    className="w-10 h-10 text-lavender"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-2.234a4.75 4.75 0 0 1-1.087-3.275V10.66a4.795 4.795 0 0 1 0-7.893Z" />
                    <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
                  </svg>
                </div>
                <h2 className="font-display font-black text-lg text-navy">
                  Select a conversation
                </h2>
                <p className="text-slate text-sm mt-1">
                  Choose a conversation from the left or search for a student to
                  start chatting
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
