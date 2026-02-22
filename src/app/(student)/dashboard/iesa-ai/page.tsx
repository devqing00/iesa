"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/* ═══════════════════════════════════════════
/* ═══════════════════════════════════════════
   Data interfaces
═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
   Markdown formatter
═══════════════════════════════════════════ */
function formatInline(text: string): React.ReactNode {
  const regex = /(\*\*.*?\*\*|__.*?__|`.*?`|\*.*?\*|_.*?_)/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("__") && part.endsWith("__"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={i} className="px-1.5 py-0.5 bg-cloud text-xs rounded">
          {part.slice(1, -1)}
        </code>
      );
    if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    )
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function formatAIResponse(text: string): React.ReactNode {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const code = part.slice(3, -3);
      const firstNewline = code.indexOf("\n");
      const language =
        firstNewline > 0 ? code.slice(0, firstNewline).trim() : "";
      const codeContent =
        firstNewline > 0 ? code.slice(firstNewline + 1) : code;
      return (
        <pre
          key={i}
          className="my-2 p-3 bg-cloud border-[3px] border-navy overflow-x-auto text-xs rounded-xl"
        >
          {language && (
            <div className="text-slate text-[10px] mb-2 uppercase font-bold tracking-wider">
              {language}
            </div>
          )}
          <code>{codeContent}</code>
        </pre>
      );
    }
    return (
      <span key={i}>
        {part.split("\n").map((line, lineIdx) => {
          if (line.startsWith("### "))
            return (
              <h4
                key={lineIdx}
                className="font-display font-black text-base mt-3 mb-1"
              >
                {line.slice(4)}
              </h4>
            );
          if (line.startsWith("## "))
            return (
              <h3
                key={lineIdx}
                className="font-display font-black text-lg mt-3 mb-1"
              >
                {line.slice(3)}
              </h3>
            );
          if (line.startsWith("# "))
            return (
              <h2
                key={lineIdx}
                className="font-display font-black text-xl mt-3 mb-1"
              >
                {line.slice(2)}
              </h2>
            );
          if (line.match(/^[-*]\s/))
            return (
              <ul key={lineIdx} className="ml-4 list-disc">
                <li>{formatInline(line.slice(2))}</li>
              </ul>
            );
          if (line.match(/^\d+\.\s/))
            return (
              <ol key={lineIdx} className="ml-4 list-decimal">
                <li>{formatInline(line.replace(/^\d+\.\s/, ""))}</li>
              </ol>
            );
          return (
            <span key={lineIdx}>
              {formatInline(line)}
              {lineIdx < part.split("\n").length - 1 && <br />}
            </span>
          );
        })}
      </span>
    );
  });
}

/* ═══════════════════════════════════════════
   Constants
═══════════════════════════════════════════ */
const QUICK_ACTIONS = [
  {
    label: "Check my dues",
    color: "bg-coral",
    query: "What's my payment status?",
  },
  {
    label: "Today's classes",
    color: "bg-teal",
    query: "What classes do I have today?",
  },
  {
    label: "Upcoming events",
    color: "bg-sunny",
    query: "What events are coming up?",
  },
  {
    label: "My timetable",
    color: "bg-lavender",
    query: "Show my class timetable",
  },
];

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English", flag: "EN" },
  { code: "pcm", label: "Pidgin", flag: "NG" },
  { code: "yo", label: "Yorùbá", flag: "NG" },
] as const;

type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["code"];

/* ═══════════════════════════════════════════
   Page component
═══════════════════════════════════════════ */
export default function IESAAIPage() {
  const { user, getAccessToken } = useAuth();
  const { isExpanded } = useSidebar();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [showConversations, setShowConversations] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [responseLanguage, setResponseLanguage] = useState<LanguageCode>("en");
  const [languageLocked, setLanguageLocked] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(
    null,
  );
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");

  const chatRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const toast = useToast();

  /* ── scroll helper ── */
  const scrollToBottom = useCallback(() => {
    const el = chatRef.current;
    if (el)
      setTimeout(
        () => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }),
        100,
      );
  }, []);

  /* ── text-to-speech ── */
  const speakMessage = (text: string, messageId: number) => {
    if (!("speechSynthesis" in window)) {
      toast.warning(
        "Not Supported",
        "Text-to-speech is not supported in your browser",
      );
      return;
    }
    window.speechSynthesis.cancel();
    if (isSpeaking && speakingMessageId === messageId) {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      return;
    }
    const cleanText = text
      .replace(/```[\s\S]*?```/g, "code block")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/_(.*?)_/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/#+\s/g, "")
      .replace(/[-*]\s/g, "")
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2728}\u{2705}\u{274C}\u{2764}]/gu,
        "",
      )
      .replace(/\s+/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    speechSynthRef.current = utterance;

    const findBestVoice = (lang: LanguageCode): SpeechSynthesisVoice | null => {
      const voices =
        availableVoices.length > 0
          ? availableVoices
          : window.speechSynthesis.getVoices();
      const langPreferences: Record<LanguageCode, string[]> = {
        en: ["en-GB", "en-NG", "en-US", "en-AU", "en"],
        pcm: ["en-NG", "en-GB", "en-US", "en"],
        yo: ["yo-NG", "yo", "en-NG", "en-GB", "en"],
      };
      const prefs = langPreferences[lang];
      for (const pref of prefs) {
        const v = voices.find(
          (v) =>
            v.lang.startsWith(pref) &&
            (v.name.includes("Natural") ||
              v.name.includes("Neural") ||
              v.name.includes("Google")),
        );
        if (v) return v;
      }
      for (const pref of prefs) {
        const v = voices.find((v) => v.lang.startsWith(pref));
        if (v) return v;
      }
      return voices[0] || null;
    };

    const selectedVoice = findBestVoice(responseLanguage);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = { en: "en-GB", pcm: "en-NG", yo: "yo-NG" }[
        responseLanguage
      ];
    }
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpeakingMessageId(messageId);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };
    window.speechSynthesis.speak(utterance);
  };

  /* ── load voices ── */
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) setAvailableVoices(voices);
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  /* ── export chat ── */
  const exportChat = () => {
    if (messages.length === 0) return;
    const chatContent = messages
      .map(
        (msg) =>
          `[${msg.time}] ${msg.sender === "user" ? "You" : "IESA AI"}:\n${msg.text}\n`,
      )
      .join("\n---\n\n");
    const header = `IESA AI Conversation Export\nDate: ${new Date().toLocaleDateString()}\nUser: ${user?.firstName || "Student"}\n\n${"=".repeat(50)}\n\n`;
    const blob = new Blob([header + chatContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iesa-ai-chat-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── data effects ── */
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const saved = localStorage.getItem("iesa-ai-conversations");
    if (saved) {
      try {
        setConversations(JSON.parse(saved));
      } catch {
        /* silent */
      }
    }
  }, []);

  /* ── request count tracking (reset every hour) ── */
  useEffect(() => {
    const savedCount = localStorage.getItem("iesa-ai-request-count");
    const savedTimestamp = localStorage.getItem("iesa-ai-request-timestamp");

    if (savedCount && savedTimestamp) {
      const hourAgo = Date.now() - 60 * 60 * 1000;
      if (parseInt(savedTimestamp) > hourAgo) {
        setRequestCount(parseInt(savedCount));
      } else {
        // Reset if over an hour old
        localStorage.removeItem("iesa-ai-request-count");
        localStorage.removeItem("iesa-ai-request-timestamp");
        setRequestCount(0);
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0 && currentConversationId) {
      const updated = conversations.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages, updatedAt: new Date().toISOString() }
          : conv,
      );
      setConversations(updated);
      localStorage.setItem("iesa-ai-conversations", JSON.stringify(updated));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentConversationId]);

  useEffect(() => {
    fetch(getApiUrl("/api/v1/iesa-ai/suggestions"))
      .then((res) => res.json())
      .then((data) => {
        if (data.suggestions) setQuickSuggestions(data.suggestions);
      })
      .catch(() =>
        setQuickSuggestions([
          "What events are coming up?",
          "How do I pay my dues?",
          "Show my timetable",
        ]),
      );
  }, []);

  useEffect(() => {
    if (messages.length === 0 && user) {
      const welcomeMsg: Message = {
        id: Date.now(),
        text: `Hey ${user.firstName || "there"}! I'm IESA AI, your smart campus assistant. I already know everything about you — your level, payment status, upcoming events, and more. Just ask me anything, and I'll give you personalized answers without needing to ask for details. What would you like to know?`,
        sender: "ai",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        suggestions: quickSuggestions.slice(0, 4),
      };
      setMessages([welcomeMsg]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, messages.length]);

  /* ── helpers ── */
  const nowTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const clearLastSuggestions = () => {
    setMessages((prev) =>
      prev.map((msg, idx) =>
        idx === prev.length - 1 && msg.sender === "ai" && msg.suggestions
          ? { ...msg, suggestions: undefined }
          : msg,
      ),
    );
  };

  /* ── typing animation ── */
  const typeMessage = (fullText: string, messageId: number, suggestions?: string[]) => {
    let index = 0;
    setIsTyping(true);
    
    const interval = setInterval(() => {
      if (index < fullText.length) {
        index += 2; // Type 2 characters at a time for smooth animation
        const currentText = fullText.substring(0, index);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, text: currentText } : m
          )
        );
      } else {
        clearInterval(interval);
        setIsTyping(false);
        // Add suggestions after typing completes
        if (suggestions) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, suggestions } : m
            )
          );
        }
      }
    }, 30); // 30ms per update = ~33 characters per second
    
    typingIntervalRef.current = interval;
  };

  /* ── send message ── */
  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || loading || isTyping) return;
    if (!languageLocked) setLanguageLocked(true);
    clearLastSuggestions();

    if (!currentConversationId) {
      const newId = Date.now().toString();
      const newConv: ChatConversation = {
        id: newId,
        title: textToSend.slice(0, 50),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCurrentConversationId(newId);
      const updatedConvs = [newConv, ...conversations];
      setConversations(updatedConvs);
      localStorage.setItem(
        "iesa-ai-conversations",
        JSON.stringify(updatedConvs),
      );
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
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Track request count
    const count = requestCount + 1;
    setRequestCount(count);
    localStorage.setItem("iesa-ai-request-count", count.toString());
    localStorage.setItem("iesa-ai-request-timestamp", Date.now().toString());

    // Create AI message placeholder
    const aiMessageId = Date.now() + 1;
    const aiMessage: Message = {
      id: aiMessageId,
      text: "",
      sender: "ai",
      time: nowTime(),
    };
    setMessages((prev) => [...prev, aiMessage]);

    try {
      const conversationHistory = messages.slice(-10).map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text,
      }));

      const response = await fetch(getApiUrl("/api/v1/iesa-ai/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({
          message: textToSend,
          conversationHistory,
          language: responseLanguage,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      
      if (data.user_context) {
        setUserContext(data.user_context);
      }
      
      // Start typing animation
      typeMessage(data.reply, aiMessageId, data.suggestions);
      
    } catch (error: unknown) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMessageId
            ? {
                ...m,
                text: "Oops! I'm having trouble connecting right now. Please try again in a moment.",
              }
            : m,
        ),
      );
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

  const handleSuggestionClick = (s: string) => sendMessage(s);

  const handleCopy = async (text: string, id: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* silent */
    }
  };

  const handleFeedback = async (messageId: number, rating: "up" | "down") => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;
    try {
      await fetch(getApiUrl("/api/v1/iesa-ai/feedback"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({
          message: messages.find((m) => m.id === messageId - 1)?.text,
          response: message.text,
          rating: rating === "up" ? 1 : -1,
        }),
      });
    } catch {
      /* silent */
    }
  };

  const clearChat = () => {
    if (messages.length > 1 && currentConversationId) {
      const title =
        messages.find((m) => m.sender === "user")?.text.slice(0, 50) ||
        "New Chat";
      const updated = conversations.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, title, messages, updatedAt: new Date().toISOString() }
          : conv,
      );
      setConversations(updated);
      localStorage.setItem("iesa-ai-conversations", JSON.stringify(updated));
    }
    const newId = Date.now().toString();
    const newConv: ChatConversation = {
      id: newId,
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updatedConvs = [newConv, ...conversations];
    setConversations(updatedConvs);
    setCurrentConversationId(newId);
    localStorage.setItem("iesa-ai-conversations", JSON.stringify(updatedConvs));
    setMessages([]);
    setLanguageLocked(false);
  };

  const loadConversation = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setCurrentConversationId(id);
      setMessages(conv.messages);
      setShowConversations(false);
    }
  };

  const deleteConversation = (id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    localStorage.setItem("iesa-ai-conversations", JSON.stringify(updated));
    if (currentConversationId === id) clearChat();
  };

  /* ═══════════════════════════════════════════
     JSX
  ═══════════════════════════════════════════ */
  return (
    <div className="min-h-screen flex flex-col bg-ghost overflow-x-hidden relative">
      {/* ── diamond sparkles ── */}
      {[
        "top-10 left-[6%] w-5 h-5 text-lavender/14",
        "top-32 right-[10%] w-4 h-4 text-teal/12",
        "top-[50%] left-[3%] w-6 h-6 text-coral/10",
        "top-[60%] right-[5%] w-5 h-5 text-sunny/14",
        "bottom-36 left-[12%] w-4 h-4 text-lime/12",
      ].map((cls, i) => (
        <svg
          key={i}
          className={`fixed ${cls} pointer-events-none z-0`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
        </svg>
      ))}

      {/* ════════════════════════════════════════
          COMPACT BENTO HEADER
      ════════════════════════════════════════ */}
      <div className="sticky top-0 z-30 bg-ghost/95 backdrop-blur-sm border-b-[3px] border-navy">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* left: AI branding */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-lavender border-[3px] border-navy shadow-[3px_3px_0_0_#000] flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-navy"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
              </div>
              <div>
                <h1 className="font-display font-black text-lg text-navy leading-tight">
                  IESA AI
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">
                  Smart Campus Assistant
                </p>
              </div>
            </div>

            {/* right: action buttons — desktop inline, mobile dropdown */}
            {/* desktop buttons (md+) */}
            <div className="hidden md:flex items-center gap-2">
              {/* Token usage display */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 border-[3px] border-navy rounded-xl ${
                  requestCount >= 20
                    ? "bg-coral-light"
                    : requestCount >= 15
                      ? "bg-sunny-light"
                      : "bg-lavender-light"
                }`}
                title="Messages sent this hour"
              >
                <svg
                  className="w-3 h-3 text-navy"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-navy">
                  {requestCount}/20
                </span>
              </div>
              <button
                onClick={() => setShowConversations(!showConversations)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-snow border-[3px] border-navy rounded-xl font-bold text-[10px] text-navy/60 uppercase tracking-[0.08em] hover:bg-cloud transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M3.505 2.365A41.369 41.369 0 019 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 00-.577-.069 43.141 43.141 0 00-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98A.75.75 0 015 17.25v-3.443c-.501-.048-1-.106-1.495-.172C2.033 13.438 1 12.162 1 10.72V5.28c0-1.441 1.033-2.717 2.505-2.914z" />
                  <path d="M14 6c.762 0 1.52.02 2.272.062 1.21.068 2.228 1.024 2.228 2.236v2.12c0 1.213-1.018 2.168-2.228 2.236a41.29 41.29 0 01-1.522.062l-2.97 2.97a.75.75 0 01-1.28-.53V14.5a41.075 41.075 0 01-1.005-.064c-1.21-.068-2.228-1.022-2.228-2.236V8.298c0-1.212 1.018-2.168 2.228-2.236A41.148 41.148 0 0114 6z" />
                </svg>
                Chats ({conversations.length})
              </button>
              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-snow border-[3px] border-navy rounded-xl font-bold text-[10px] text-navy/60 uppercase tracking-[0.08em] hover:bg-cloud transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 5a.75.75 0 01.75.75v3.5h3.5a.75.75 0 010 1.5h-3.5v3.5a.75.75 0 01-1.5 0v-3.5h-3.5a.75.75 0 010-1.5h3.5v-3.5A.75.75 0 0110 5z" />
                </svg>
                New
              </button>
              <div className="relative">
                <button
                  onClick={() =>
                    !languageLocked && setShowLanguageMenu(!showLanguageMenu)
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 border-[3px] rounded-xl font-bold text-[10px] uppercase tracking-[0.08em] transition-colors ${languageLocked ? "border-navy/40 text-slate cursor-not-allowed bg-cloud" : "border-navy text-navy/60 bg-snow hover:bg-cloud"}`}
                  title={
                    languageLocked
                      ? "Language locked. Start new chat to change."
                      : "Response language"
                  }
                >
                  <span>
                    {
                      LANGUAGE_OPTIONS.find((l) => l.code === responseLanguage)
                        ?.flag
                    }
                  </span>
                  <span>
                    {
                      LANGUAGE_OPTIONS.find((l) => l.code === responseLanguage)
                        ?.label
                    }
                  </span>
                  {languageLocked ? (
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
                {showLanguageMenu && !languageLocked && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowLanguageMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 bg-snow border-[4px] border-navy rounded-xl z-50 min-w-40 shadow-[4px_4px_0_0_#000] overflow-hidden">
                      <div className="px-3 py-2 border-b-[3px] border-navy bg-lavender-light">
                        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-navy/60">
                          Locked after first message
                        </p>
                      </div>
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setResponseLanguage(lang.code);
                            setShowLanguageMenu(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 font-display font-bold text-xs text-left transition-colors ${responseLanguage === lang.code ? "bg-lavender-light text-navy" : "text-navy/60 hover:bg-cloud hover:text-navy"}`}
                        >
                          <span>{lang.flag}</span>
                          <span>{lang.label}</span>
                          {responseLanguage === lang.code && (
                            <svg
                              className="w-3.5 h-3.5 ml-auto text-lavender"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {messages.length > 0 && (
                <button
                  onClick={exportChat}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-snow border-[3px] border-navy rounded-xl font-bold text-[10px] text-navy/60 uppercase tracking-[0.08em] hover:bg-cloud transition-colors"
                  title="Export conversation"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                  </svg>
                  Export
                </button>
              )}
            </div>

            {/* mobile menu trigger (<md) */}
            <div className="flex md:hidden items-center gap-2">
              {/* language flag quick-access on mobile */}
              <span className="text-sm">
                {
                  LANGUAGE_OPTIONS.find((l) => l.code === responseLanguage)
                    ?.flag
                }
              </span>
              <div className="relative">
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="w-9 h-9 flex items-center justify-center bg-snow border-[3px] border-navy rounded-xl hover:bg-cloud transition-colors"
                  aria-label="Menu"
                >
                  <svg
                    className="w-4 h-4 text-navy"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                  </svg>
                </button>
                {showMobileMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowMobileMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 bg-snow border-[4px] border-navy rounded-xl z-50 w-56 shadow-[4px_4px_0_0_#000] overflow-hidden">
                      <button
                        onClick={() => {
                          setShowConversations(!showConversations);
                          setShowMobileMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-navy/70 hover:bg-cloud hover:text-navy transition-colors font-display font-bold text-xs"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M3.505 2.365A41.369 41.369 0 019 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 00-.577-.069 43.141 43.141 0 00-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98A.75.75 0 015 17.25v-3.443c-.501-.048-1-.106-1.495-.172C2.033 13.438 1 12.162 1 10.72V5.28c0-1.441 1.033-2.717 2.505-2.914z" />
                          <path d="M14 6c.762 0 1.52.02 2.272.062 1.21.068 2.228 1.024 2.228 2.236v2.12c0 1.213-1.018 2.168-2.228 2.236a41.29 41.29 0 01-1.522.062l-2.97 2.97a.75.75 0 01-1.28-.53V14.5a41.075 41.075 0 01-1.005-.064c-1.21-.068-2.228-1.022-2.228-2.236V8.298c0-1.212 1.018-2.168 2.228-2.236A41.148 41.148 0 0114 6z" />
                        </svg>
                        Conversations ({conversations.length})
                      </button>
                      <button
                        onClick={() => {
                          clearChat();
                          setShowMobileMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-navy/70 hover:bg-cloud hover:text-navy transition-colors font-display font-bold text-xs"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M10 5a.75.75 0 01.75.75v3.5h3.5a.75.75 0 010 1.5h-3.5v3.5a.75.75 0 01-1.5 0v-3.5h-3.5a.75.75 0 010-1.5h3.5v-3.5A.75.75 0 0110 5z" />
                        </svg>
                        New Chat
                      </button>
                      <div className="border-t-[3px] border-navy/10">
                        <div className="px-3 py-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-navy/40">
                            Language {languageLocked ? "(locked)" : ""}
                          </span>
                        </div>
                        {LANGUAGE_OPTIONS.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => {
                              if (!languageLocked) {
                                setResponseLanguage(lang.code);
                                setShowMobileMenu(false);
                              }
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 font-display font-bold text-xs transition-colors ${responseLanguage === lang.code ? "bg-lavender-light text-navy" : languageLocked ? "text-navy/30 cursor-not-allowed" : "text-navy/60 hover:bg-cloud hover:text-navy"}`}
                          >
                            <span>{lang.flag}</span>
                            <span>{lang.label}</span>
                            {responseLanguage === lang.code && (
                              <svg
                                className="w-3 h-3 ml-auto text-lavender"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                      {messages.length > 0 && (
                        <button
                          onClick={() => {
                            exportChat();
                            setShowMobileMenu(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-navy/70 hover:bg-cloud hover:text-navy transition-colors font-display font-bold text-xs border-t-[3px] border-navy/10"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                            <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                          </svg>
                          Export Chat
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          CONVERSATIONS SIDEBAR
      ════════════════════════════════════════ */}
      {showConversations && (
        <>
          <div
            className="fixed inset-0 bg-navy/50 z-40"
            onClick={() => setShowConversations(false)}
          />
          <div className="fixed top-0 right-0 h-full w-full sm:w-80 bg-ghost border-l-[4px] border-navy z-50 flex flex-col">
            {/* sidebar header */}
            <div className="p-4 border-b-[4px] border-navy bg-lavender-light flex items-center justify-between">
              <h2 className="font-display font-black text-lg text-navy">
                Conversations
              </h2>
              <button
                onClick={() => setShowConversations(false)}
                className="w-8 h-8 flex items-center justify-center bg-snow border-[3px] border-navy rounded-xl hover:bg-cloud transition-colors"
                aria-label="Close conversations sidebar"
              >
                <svg
                  className="w-4 h-4 text-navy"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            {/* sidebar body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Search input */}
              <div className="sticky top-0 bg-ghost pb-2 z-10">
                <div className="relative">
                  <input
                    type="text"
                    value={conversationSearch}
                    onChange={(e) => setConversationSearch(e.target.value)}
                    placeholder="Search conversations..."
                    className="w-full px-3 py-2 pl-8 bg-snow border-[3px] border-navy rounded-xl text-navy font-display font-normal text-xs placeholder:text-slate focus:outline-none focus:border-teal transition-all"
                  />
                  <svg
                    className="w-4 h-4 text-slate absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {conversationSearch && (
                    <button
                      onClick={() => setConversationSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center hover:bg-cloud rounded transition-colors"
                    >
                      <svg
                        className="w-3 h-3 text-slate"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Conversations list */}
              {(() => {
                const filteredConvs = conversationSearch
                  ? conversations.filter(
                      (conv) =>
                        conv.title
                          .toLowerCase()
                          .includes(conversationSearch.toLowerCase()) ||
                        conv.messages.some((m) =>
                          m.text
                            .toLowerCase()
                            .includes(conversationSearch.toLowerCase()),
                        ),
                    )
                  : conversations;

                if (filteredConvs.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 rounded-2xl bg-cloud border-[3px] border-navy/20 flex items-center justify-center mx-auto mb-3">
                        <svg
                          className="w-6 h-6 text-slate"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M3.505 2.365A41.369 41.369 0 019 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 00-.577-.069 43.141 43.141 0 00-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98A.75.75 0 015 17.25v-3.443c-.501-.048-1-.106-1.495-.172C2.033 13.438 1 12.162 1 10.72V5.28c0-1.441 1.033-2.717 2.505-2.914z" />
                        </svg>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate">
                        {conversationSearch
                          ? "No matching conversations"
                          : "No conversations yet"}
                      </p>
                    </div>
                  );
                }

                return filteredConvs.map((conv, idx) => {
                  const accent = [
                    "border-l-teal",
                    "border-l-coral",
                    "border-l-lavender",
                    "border-l-sunny",
                  ][idx % 4];
                  return (
                    <div
                      key={conv.id}
                      className={`group p-3 border-[3px] border-navy border-l-[5px] ${accent} rounded-xl cursor-pointer transition-all press-3 press-black ${
                        currentConversationId === conv.id
                          ? "bg-lavender-light"
                          : "bg-snow hover:bg-cloud"
                      }`}
                      onClick={() => loadConversation(conv.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-bold text-sm text-navy truncate">
                            {conv.title}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate mt-1">
                            {new Date(conv.updatedAt).toLocaleDateString()} ·{" "}
                            {conv.messages.length} msgs
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center bg-coral-light border-[2px] border-coral rounded-lg transition-all"
                          aria-label="Delete conversation"
                        >
                          <svg
                            className="w-3.5 h-3.5 text-coral"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 01.7.797l-.5 6a.75.75 0 01-1.497-.124l.5-6a.75.75 0 01.797-.672zm3.54.797a.75.75 0 00-1.497-.124l-.5 6a.75.75 0 101.498.124l.5-6z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          CHAT AREA
      ════════════════════════════════════════ */}
      <div className="flex-1 overflow-hidden relative z-10">
        <div className="max-w-5xl mx-auto h-full flex flex-col px-4 md:px-8">
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto space-y-6 py-6 pb-44 md:pb-36 scroll-smooth"
          >
            {messages.filter((m) => m.text || m.sender === "user").map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 flex items-center justify-center shrink-0 ${
                    message.sender === "user"
                      ? "bg-navy border-[3px] border-teal rounded-xl"
                      : "bg-lavender border-[3px] border-navy rounded-2xl shadow-[2px_2px_0_0_#000]"
                  }`}
                >
                  {message.sender === "user" ? (
                    <span className="text-lime text-sm font-display font-black">
                      {user?.firstName?.[0] || "U"}
                    </span>
                  ) : (
                    <svg
                      className="w-4 h-4 text-navy"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`flex-1 max-w-[85%] md:max-w-[75%] space-y-2 ${message.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`px-4 py-3 ${
                      message.sender === "user"
                        ? "bg-navy border-[3px] border-teal text-ghost rounded-2xl rounded-tr-lg"
                        : "bg-snow border-[3px] border-navy text-navy rounded-2xl rounded-tl-lg shadow-[3px_3px_0_0_#000]"
                    }`}
                  >
                    <div className="font-display font-normal text-sm leading-relaxed">
                      {message.sender === "ai"
                        ? formatAIResponse(message.text)
                        : message.text}
                    </div>

                    {/* Suggestions */}
                    {message.sender === "ai" &&
                      message.suggestions &&
                      message.suggestions.length > 0 && (
                        <div className="mt-3 pt-3 border-t-[3px] border-navy/15 space-y-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate">
                            <svg
                              className="w-3.5 h-3.5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 00.572.729 6.016 6.016 0 002.856 0A.75.75 0 0012 15.1v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.863 17.414a.75.75 0 00-.226 1.483 9.066 9.066 0 002.726 0 .75.75 0 00-.226-1.483 7.553 7.553 0 01-2.274 0z" />
                            </svg>
                            Quick actions
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {message.suggestions.map((suggestion, idx) => {
                              const colors = [
                                "bg-teal-light text-teal border-teal",
                                "bg-coral-light text-coral border-coral",
                                "bg-lavender-light text-lavender border-lavender",
                                "bg-sunny-light text-sunny border-sunny",
                              ];
                              return (
                                <button
                                  key={idx}
                                  onClick={() =>
                                    handleSuggestionClick(suggestion)
                                  }
                                  className={`px-3 py-1.5 border-[2px] ${colors[idx % 4]} font-display font-bold text-[10px] uppercase tracking-[0.08em] hover:brightness-95 transition-all rounded-lg`}
                                >
                                  {suggestion}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Metadata */}
                  <div
                    className={`flex items-center gap-2 px-1 ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <span className="text-[10px] text-slate">
                      {message.time}
                    </span>

                    {/* Copy */}
                    <button
                      onClick={() => handleCopy(message.text, message.id)}
                      className="p-1 hover:bg-cloud transition-colors rounded"
                      aria-label="Copy message"
                    >
                      {copiedId === message.id ? (
                        <svg
                          className="w-3 h-3 text-teal"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-3 h-3 text-slate hover:text-navy"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                          <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                        </svg>
                      )}
                    </button>

                    {/* AI-only actions */}
                    {message.sender === "ai" && (
                      <div className="flex items-center gap-1">
                        {/* speak */}
                        <button
                          onClick={() => speakMessage(message.text, message.id)}
                          className="p-1 hover:bg-cloud transition-colors rounded"
                          aria-label={
                            isSpeaking && speakingMessageId === message.id
                              ? "Stop speaking"
                              : "Listen"
                          }
                        >
                          {isSpeaking && speakingMessageId === message.id ? (
                            <svg
                              className="w-3 h-3 text-coral animate-pulse"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M5.25 3A2.25 2.25 0 003 5.25v9.5A2.25 2.25 0 005.25 17h9.5A2.25 2.25 0 0017 14.75v-9.5A2.25 2.25 0 0014.75 3h-9.5z" />
                            </svg>
                          ) : (
                            <svg
                              className="w-3 h-3 text-slate hover:text-navy"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M10 3.75a.75.75 0 00-1.264-.546L4.703 7H3.167a.75.75 0 00-.7.48A6.985 6.985 0 002 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h1.535l4.033 3.796A.75.75 0 0010 16.25V3.75zM15.95 5.05a.75.75 0 00-1.06 1.061 5.5 5.5 0 010 7.778.75.75 0 001.06 1.06 7 7 0 000-9.899z" />
                              <path d="M13.829 7.172a.75.75 0 00-1.061 1.06 2.5 2.5 0 010 3.536.75.75 0 001.06 1.06 4 4 0 000-5.656z" />
                            </svg>
                          )}
                        </button>
                        {/* thumbs up */}
                        <button
                          onClick={() => handleFeedback(message.id, "up")}
                          className="p-1 hover:bg-cloud transition-colors rounded"
                          aria-label="Helpful"
                        >
                          <svg
                            className="w-3 h-3 text-slate hover:text-teal"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM7.25 3A.75.75 0 007 3.75v.763c0 .665-.24 1.308-.678 1.808l-.453.496A1.742 1.742 0 005 8.392V15.5A1.5 1.5 0 006.5 17h7.286a1.5 1.5 0 001.443-1.087l1.907-6.75A1.5 1.5 0 0015.693 7.5h-3.93a.75.75 0 01-.75-.809l.399-3.589A1.205 1.205 0 0010.226 2h-.081A1.894 1.894 0 008.25 3.895V4a.75.75 0 01-.75.75h-.25z" />
                          </svg>
                        </button>
                        {/* thumbs down */}
                        <button
                          onClick={() => handleFeedback(message.id, "down")}
                          className="p-1 hover:bg-cloud transition-colors rounded"
                          aria-label="Not helpful"
                        >
                          <svg
                            className="w-3 h-3 text-slate hover:text-coral"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M18.905 12.75a1.25 1.25 0 01-2.5 0v-7.5a1.25 1.25 0 112.5 0v7.5zM12.75 17a.75.75 0 00.75-.75v-.763c0-.665.24-1.308.678-1.808l.453-.496c.546-.6.872-1.367.872-2.184V4.5A1.5 1.5 0 0014 3H6.214a1.5 1.5 0 00-1.443 1.087l-1.907 6.75A1.5 1.5 0 004.307 12.5h3.93a.75.75 0 01.75.81l-.399 3.588A1.205 1.205 0 009.774 18h.081a1.894 1.894 0 001.895-1.895V16a.75.75 0 01.75-.75h.25z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading */}
            {(loading || isTyping) && (
              <div className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-2xl bg-lavender border-[3px] border-navy flex items-center justify-center shadow-[2px_2px_0_0_#000]">
                  <svg
                    className="w-4 h-4 text-navy animate-pulse"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="border-[3px] border-navy bg-snow px-4 py-3 rounded-2xl rounded-tl-lg shadow-[3px_3px_0_0_#000]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate text-sm font-display font-medium">
                        {isTyping ? "Typing" : "Thinking"}...
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-lavender animate-bounce [animation-delay:0ms]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-teal animate-bounce [animation-delay:150ms]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-coral animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state suggestions */}
            {messages.length === 0 && quickSuggestions.length > 0 && (
              <div className="mt-8 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate text-center">
                  Try asking me about
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {quickSuggestions.slice(0, 6).map((suggestion, idx) => {
                    const accents = [
                      "border-l-teal hover:bg-teal-light",
                      "border-l-coral hover:bg-coral-light",
                      "border-l-lavender hover:bg-lavender-light",
                      "border-l-sunny hover:bg-sunny-light",
                    ];
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`p-4 bg-snow border-[3px] border-navy border-l-[5px] ${accents[idx % 4]} rounded-xl text-left transition-all press-3 press-black`}
                      >
                        <p className="font-display font-medium text-sm text-navy">
                          {suggestion}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════
              FIXED INPUT AREA
          ════════════════════════════════════════ */}
          <div
            className={`fixed bottom-16 md:bottom-0 left-0 right-0 bg-ghost/95 backdrop-blur-sm border-t-[3px] border-navy z-20 transition-all duration-300 ${
              isExpanded ? "md:left-[260px]" : "md:left-[72px]"
            }`}
          >
            <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 space-y-3">
              {/* Quick Actions strip */}
              {showQuickActions && messages.length === 1 && (
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInput(action.query);
                        setShowQuickActions(false);
                        setTimeout(() => sendMessage(action.query), 100);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-snow border-[3px] border-navy rounded-xl font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em] press-3 press-black transition-all"
                    >
                      <div className={`w-2 h-2 rounded-full ${action.color}`} />
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-start">
                {/* Textarea */}
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
                    placeholder="Ask me anything about IESA..."
                    className="w-full px-4 py-3 bg-snow border-[3px] border-navy font-display font-normal text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 resize-none transition-all min-h-12 max-h-30 scrollbar-none rounded-xl"
                    disabled={loading}
                  />
                </div>

                {/* Send */}
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="px-4 py-3.5 bg-navy border-[3px] border-lavender press-3 press-black font-display font-black text-xs uppercase tracking-wider text-lavender disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0 rounded-xl"
                  aria-label="Send message"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M3.105 2.288a.75.75 0 00-.826.95l1.414 4.926A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.897 28.897 0 0015.293-7.155.75.75 0 000-1.114A28.897 28.897 0 003.105 2.288z" />
                  </svg>
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>

              <p className="text-[10px] text-slate text-center">
                IESA AI can make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
