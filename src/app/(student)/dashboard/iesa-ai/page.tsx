"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Lightbulb,
  User,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface Message {
  id: number;
  text: string;
  sender: "user" | "ai";
  time: string;
  suggestions?: string[];
}

interface UserContext {
  level?: string;
  name?: string;
  matric?: string;
  session?: string;
  payment_status?: string;
  payment_amount?: number;
  upcoming_events?: Array<{ title: string; date: string }>;
}

interface ChatConversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export default function IESAAIPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = chatRef.current;
    if (el) {
      setTimeout(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }, 100);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load conversations from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('iesa-ai-conversations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConversations(parsed);
      } catch (e) {
        console.error('Failed to parse saved conversations:', e);
      }
    }
  }, []);

  // Save messages to current conversation
  useEffect(() => {
    if (messages.length > 0 && currentConversationId) {
      const updatedConversations = conversations.map(conv => 
        conv.id === currentConversationId 
          ? { ...conv, messages, updatedAt: new Date().toISOString() }
          : conv
      );
      setConversations(updatedConversations);
      localStorage.setItem('iesa-ai-conversations', JSON.stringify(updatedConversations));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentConversationId]);

  // Fetch quick suggestions on mount
  useEffect(() => {
    fetch("/api/v1/iesa-ai/suggestions")
      .then((res) => res.json())
      .then((data) => {
        if (data.suggestions) {
          setQuickSuggestions(data.suggestions);
        }
      })
      .catch(() => {
        setQuickSuggestions([
          "What events are coming up?",
          "How do I pay my dues?",
          "Show my timetable",
        ]);
      });
  }, []);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0 && user) {
      const welcomeMsg: Message = {
        id: Date.now(),
        text: `Hey ${
          user.displayName?.split(" ")[0] || "there"
        }! 👋 I'm IESA AI, your smart campus assistant. I already know everything about you — your level, payment status, upcoming events, and more. Just ask me anything, and I'll give you personalized answers without needing to ask for details. What would you like to know?`,
        sender: "ai",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        suggestions: quickSuggestions.slice(0, 4),
      };
      setMessages([welcomeMsg]);
    }
  }, [user, quickSuggestions.length, messages.length]);

  const nowTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || loading) return;

    // Create new conversation if this is the first message
    if (!currentConversationId) {
      const newId = Date.now().toString();
      const newConversation: ChatConversation = {
        id: newId,
        title: textToSend.slice(0, 50),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCurrentConversationId(newId);
      const updatedConvs = [newConversation, ...conversations];
      setConversations(updatedConvs);
      localStorage.setItem('iesa-ai-conversations', JSON.stringify(updatedConvs));
    }

    const userMessage: Message = {
      id: Date.now(),
      text: textToSend,
      sender: "user",
      time: nowTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      // Get conversation history (last 10 messages)
      const conversationHistory = messages.slice(-10).map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text,
      }));

      const response = await fetch("/api/v1/iesa-ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user?.getIdToken()}`,
        },
        body: JSON.stringify({
          message: textToSend,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      // Extract and store user context from backend response
      if (data.data?.user_context) {
        setUserContext(data.data.user_context);
      }

      const aiMessage: Message = {
        id: Date.now() + 1,
        text:
          data.reply ||
          "I'm not sure how to respond to that. Can you rephrase?",
        sender: "ai",
        time: nowTime(),
        suggestions: data.suggestions,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "Oops! I'm having trouble connecting right now. Please try again in a moment.",
          sender: "ai",
          time: nowTime(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  };

  const handleSuggestionClick = (suggestion: string) => {
    // Remove suggestions from the last AI message before sending
    setMessages(prev => prev.map((msg, idx) => 
      idx === prev.length - 1 && msg.sender === 'ai' && msg.suggestions
        ? { ...msg, suggestions: undefined }
        : msg
    ));
    sendMessage(suggestion);
  };

  const handleFeedback = async (messageId: number, rating: "up" | "down") => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    try {
      await fetch("/api/v1/iesa-ai/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user?.getIdToken()}`,
        },
        body: JSON.stringify({
          message: messages.find((m) => m.id === messageId - 1)?.text,
          response: message.text,
          rating: rating === "up" ? 1 : -1,
        }),
      });
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  };

  const clearChat = () => {
    // Save current conversation if it has messages
    if (messages.length > 1 && currentConversationId) {
      const title = messages.find(m => m.sender === 'user')?.text.slice(0, 50) || 'New Chat';
      const updatedConversations = conversations.map(conv =>
        conv.id === currentConversationId
          ? { ...conv, title, messages, updatedAt: new Date().toISOString() }
          : conv
      );
      setConversations(updatedConversations);
      localStorage.setItem('iesa-ai-conversations', JSON.stringify(updatedConversations));
    }

    // Create new conversation
    const newId = Date.now().toString();
    const newConversation: ChatConversation = {
      id: newId,
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const updatedConvs = [newConversation, ...conversations];
    setConversations(updatedConvs);
    setCurrentConversationId(newId);
    localStorage.setItem('iesa-ai-conversations', JSON.stringify(updatedConvs));
    
    // Reset messages (welcome message will be shown by useEffect)
    setMessages([]);
  };

  const loadConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setCurrentConversationId(id);
      setMessages(conv.messages);
      setShowConversations(false);
    }
  };

  const deleteConversation = (id: string) => {
    const updated = conversations.filter(c => c.id !== id);
    setConversations(updated);
    localStorage.setItem('iesa-ai-conversations', JSON.stringify(updated));
    if (currentConversationId === id) {
      clearChat();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border-b border-[var(--glass-border)] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 md:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">
                  IESA AI
                </h1>
                <p className="text-xs text-foreground/60">
                  Your Smart Campus Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {/* User Context Badge */}
              {userContext && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-primary">
                    {userContext.level} • {userContext.matric}
                  </span>
                </div>
              )}

              <button
                onClick={() => setShowConversations(!showConversations)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-foreground/5 transition-colors text-foreground/70"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="hidden sm:inline">Chats ({conversations.length})</span>
              </button>

              <button
                onClick={clearChat}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-foreground/5 transition-colors text-foreground/70"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Chat</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Conversations Sidebar */}
      {showConversations && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40 md:hidden"
            onClick={() => setShowConversations(false)}
          />
          <div className="fixed top-0 right-0 h-full w-80 bg-background border-l border-foreground/10 z-50 shadow-2xl flex flex-col">
            <div className="p-4 border-b border-foreground/10 flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg">Conversations</h2>
              <button
                onClick={() => setShowConversations(false)}
                className="p-2 hover:bg-foreground/5 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {conversations.length === 0 ? (
                <p className="text-sm text-foreground/50 text-center py-8">No conversations yet</p>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`group p-3 rounded-lg border transition-all cursor-pointer ${
                      currentConversationId === conv.id
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-foreground/5 border-foreground/10 hover:border-foreground/20'
                    }`}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {conv.title}
                        </p>
                        <p className="text-xs text-foreground/50 mt-1">
                          {new Date(conv.updatedAt).toLocaleDateString()} • {conv.messages.length} messages
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded transition-all"
                      >
                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-5xl mx-auto h-full flex flex-col px-4 md:px-8 py-6">
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto space-y-6 pb-4 scroll-smooth"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 ${
                  message.sender === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md ${
                    message.sender === "user"
                      ? "bg-linear-to-br from-primary to-primary/80"
                      : "bg-linear-to-br from-purple-500 to-pink-500"
                  }`}
                >
                  {message.sender === "user" ? (
                    <span className="text-white text-sm font-bold">
                      {user?.displayName?.[0] || "U"}
                    </span>
                  ) : (
                    <Sparkles className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`flex-1 max-w-[85%] md:max-w-[75%] space-y-2 ${
                    message.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 shadow-sm ${
                      message.sender === "user"
                        ? "bg-linear-to-br from-primary to-primary/90 text-white rounded-tr-sm"
                        : "bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] text-foreground rounded-tl-sm"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.text}
                    </p>

                    {/* Suggestions */}
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-foreground/10 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-foreground/60">
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span>Quick actions:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {message.suggestions.map((suggestion, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSuggestionClick(suggestion)}
                              className="px-3 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-xs font-medium transition-colors border border-foreground/10"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] text-foreground/40">
                      {message.time}
                    </span>

                    {/* Feedback buttons for AI messages */}
                    {message.sender === "ai" && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleFeedback(message.id, "up")}
                          className="p-1 rounded hover:bg-foreground/5 transition-colors"
                          title="Helpful"
                        >
                          <ThumbsUp className="w-3 h-3 text-foreground/30 hover:text-green-600" />
                        </button>
                        <button
                          onClick={() => handleFeedback(message.id, "down")}
                          className="p-1 rounded hover:bg-foreground/5 transition-colors"
                          title="Not helpful"
                        >
                          <ThumbsDown className="w-3 h-3 text-foreground/30 hover:text-red-600" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex gap-3 animate-in fade-in duration-300">
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            {/* Quick Suggestions (shown when no messages) */}
            {messages.length === 0 &&
              quickSuggestions.length > 0 && (
                <div className="mt-8 space-y-4">
                  <p className="text-sm text-foreground/60 text-center">
                    Try asking me about:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quickSuggestions.slice(0, 6).map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="p-4 rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                      >
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {suggestion}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Input Area */}
          <div className="pt-4 border-t border-[var(--glass-border)]">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    autoResize();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about IESA... (Press Enter to send)"
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] text-sm text-foreground placeholder-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-none transition-all min-h-[48px] max-h-[120px] scrollbar-hide"
                  disabled={loading}
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                />
              </div>

              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="px-4 py-3 bg-linear-to-r from-primary to-primary/80 text-white rounded-xl hover:from-primary/90 hover:to-primary/70 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center gap-2 font-medium"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Send</span>
              </button>
            </div>

            <p className="text-[10px] text-foreground/40 mt-2 text-center">
              IESA AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
