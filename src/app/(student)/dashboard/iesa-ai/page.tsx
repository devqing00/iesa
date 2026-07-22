"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";
import { HelpButton, ToolHelpModal, useToolHelp } from "@/components/ui/ToolHelpModal";

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

interface AIUsage {
  hourly_used?: number;
  hourly_limit: number;
  daily_used?: number;
  daily_limit: number;
  hourly_remaining?: number | null;
  daily_remaining?: number | null;
  reset_at?: string;
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
    query: "What dues do I owe and which have I paid?",
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
    query: "Show my full class timetable for the week",
  },
  {
    label: "IEPOD Hub",
    color: "bg-lime",
    query: "Tell me what IEPOD is and what students do there",
  },
  {
    label: "Growth tools",
    color: "bg-ghost",
    query: "What growth tools are available and what do they do?",
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
  const { showHelp, openHelp, closeHelp } = useToolHelp("iesa-ai");
  const { isExpanded } = useSidebar();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setUserContext] = useState<UserContext | null>(null);
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
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const chatRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const conversationSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesLengthRef = useRef(0);
  const conversationsRef = useRef(conversations);

  /* ── speech recognition setup ── */
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        setSpeechSupported(true);
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = responseLanguage === "pcm" ? "en-NG" : responseLanguage === "yo" ? "yo-NG" : "en-US";
        rec.onstart = () => setIsListening(true);
        rec.onresult = (e: any) => {
          const text = Array.from(e.results)
            .map((r: any) => r[0].transcript)
            .join("");
          setInput(text);
        };
        rec.onerror = () => setIsListening(false);
        rec.onend = () => setIsListening(false);
        recognitionRef.current = rec;
      }
    }
  }, [responseLanguage]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Voice input is not supported in this browser");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        setHandsFreeMode(true);
        recognitionRef.current.start();
      } catch {
        setIsListening(false);
      }
    }
  };

  /* ── scroll helper ── */
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }
    });
  }, []);

  /* ── text-to-speech ── */
  const speakMessage = (text: string, messageId: number) => {
    if (!("speechSynthesis" in window)) {
      toast.warning(
        "Not Supported",
        { description: "Text-to-speech is not supported in your browser" },
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
      if (conversationSyncTimeoutRef.current) {
        clearTimeout(conversationSyncTimeoutRef.current);
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

  // Keep conversationsRef in sync with state (no side effects, just a mirror)
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  /* ── data effects ── */
  useEffect(() => {
    // Only scroll to bottom when a new message bubble is added (length grows),
    // not during the typing animation which updates text in an existing bubble.
    if (messages.length !== messagesLengthRef.current) {
      messagesLengthRef.current = messages.length;
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

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
        text: `Hey ${user.firstName || "there"}! What can I help you with?`,
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

  const syncConversationsToAccount = useCallback(
    async (convs: ChatConversation[]) => {
      try {
        await fetch(getApiUrl("/api/v1/iesa-ai/conversations/sync"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getAccessToken()}`,
          },
          body: JSON.stringify({ conversations: convs }),
        });
      } catch {
      }
    },
    [getAccessToken],
  );

  const scheduleConversationSync = useCallback(
    (convs: ChatConversation[]) => {
      if (conversationSyncTimeoutRef.current) {
        clearTimeout(conversationSyncTimeoutRef.current);
      }
      conversationSyncTimeoutRef.current = setTimeout(() => {
        void syncConversationsToAccount(convs);
      }, 700);
    },
    [syncConversationsToAccount],
  );

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/v1/iesa-ai/usage"), {
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
        },
      });
      if (!res.ok) return;
      const data: AIUsage = await res.json();
      const derivedHourlyUsed =
        typeof data.hourly_used === "number"
          ? data.hourly_used
          : typeof data.hourly_remaining === "number"
            ? Math.max(0, data.hourly_limit - data.hourly_remaining)
            : 0;
      setUsage(data);
      setRequestCount(derivedHourlyUsed);
    } catch {
    }
  }, [getAccessToken]);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const res = await fetch(getApiUrl("/api/v1/iesa-ai/conversations"), {
          headers: {
            Authorization: `Bearer ${await getAccessToken()}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const serverConversations = Array.isArray(data?.conversations)
            ? data.conversations
            : [];
          setConversations(serverConversations);
          if (serverConversations.length > 0) {
            setCurrentConversationId(serverConversations[0].id);
          }
          localStorage.setItem(
            "iesa-ai-conversations",
            JSON.stringify(serverConversations),
          );
          return;
        }
      } catch {
      }

      const saved = localStorage.getItem("iesa-ai-conversations");
      if (saved) {
        try {
          setConversations(JSON.parse(saved));
        } catch {
        }
      }
    };

    void loadConversations();
    void fetchUsage();
  }, [fetchUsage, getAccessToken]);

  useEffect(() => {
    const poll = setInterval(() => {
      void fetchUsage();
    }, 15000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchUsage();
      }
    };

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchUsage]);

  useEffect(() => {
    if (messages.length > 0 && currentConversationId) {
      const updated = conversationsRef.current.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages, updatedAt: new Date().toISOString() }
          : conv,
      );
      localStorage.setItem("iesa-ai-conversations", JSON.stringify(updated));
      scheduleConversationSync(updated);
    }
  }, [messages, currentConversationId, scheduleConversationSync]);

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
        // Scroll every tick so the message stays in view as it types
        if (chatRef.current) {
          chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
      } else {
        clearInterval(interval);
        setIsTyping(false);
        if (handsFreeMode) {
          speakMessage(fullText, messageId);
        }
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
      scheduleConversationSync(updatedConvs);
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

    setRequestCount((prev) => prev + 1);
    setUsage((prev) =>
      prev
        ? {
            ...prev,
            hourly_used: Math.min(prev.hourly_limit, (prev.hourly_used ?? 0) + 1),
          }
        : prev,
    );

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
      
    } catch {
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
      void fetchUsage();
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
      toast.error("Could not copy message");
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
      scheduleConversationSync(updated);
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
    scheduleConversationSync(updatedConvs);
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
    scheduleConversationSync(updated);
    if (currentConversationId === id) clearChat();
  };

  /* ═══════════════════════════════════════════
     JSX
  ═══════════════════════════════════════════ */
  return (
    <div className="min-h-screen flex flex-col bg-ghost overflow-x-hidden relative">
      <ToolHelpModal toolId="iesa-ai" isOpen={showHelp} onClose={closeHelp} />
      {/* ── diamond sparkles ── */}
      {[
        "top-10 left-[6%] w-5 h-5 text-lavender/14",
        "top-32 right-[10%] w-4 h-4 text-teal/12",
        "top-[50%] left-[3%] w-6 h-6 text-coral/10",
        "top-[60%] right-[5%] w-5 h-5 text-sunny/14",
        "bottom-36 left-[12%] w-4 h-4 text-navy/8",
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

            {/* right: action buttons — desktop inline */}
            <div className="hidden md:flex items-center gap-2">
              <HelpButton onClick={openHelp} />

              {/* Token usage display */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 border-[3px] border-navy rounded-xl shadow-[2px_2px_0_0_#000] ${
                  requestCount >= (usage?.hourly_limit || 20)
                    ? "bg-coral-light"
                    : requestCount >= Math.max(1, Math.floor((usage?.hourly_limit || 20) * 0.75))
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
                  {requestCount}/{usage?.hourly_limit || 20}
                </span>
              </div>

              {/* Chats button with clean bold message bubbles icon */}
              <button
                onClick={() => setShowConversations(!showConversations)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-snow border-[3px] border-navy rounded-xl font-bold text-[10px] text-navy uppercase tracking-[0.08em] shadow-[2px_2px_0_0_#000] press-2 press-black hover:bg-cloud transition-all"
              >
                <svg
                  className="w-4 h-4 text-navy"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path fillRule="evenodd" d="M4.8 3h14.4A1.8 1.8 0 0121 4.8v10.4a1.8 1.8 0 01-1.8 1.8H12l-4.5 4.5V17H4.8A1.8 1.8 0 013 15.2V4.8A1.8 1.8 0 014.8 3z" clipRule="evenodd" />
                </svg>
                Chats ({conversations.length})
              </button>

              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-snow border-[3px] border-navy rounded-xl font-bold text-[10px] text-navy uppercase tracking-[0.08em] shadow-[2px_2px_0_0_#000] press-2 press-black hover:bg-cloud transition-all"
              >
                <svg
                  className="w-4 h-4 text-navy"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 5a.75.75 0 01.75.75v3.5h3.5a.75.75 0 010 1.5h-3.5v3.5a.75.75 0 01-1.5 0v-3.5h-3.5a.75.75 0 010-1.5h3.5v-3.5A.75.75 0 0110 5z" />
                </svg>
                New Chat
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
                  <span className="hidden lg:inline">
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
                      className="fixed inset-0 z-[70]"
                      onClick={() => setShowLanguageMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 bg-snow border-[3px] border-navy rounded-xl z-[70] min-w-40 shadow-[4px_4px_0_0_#000] overflow-hidden">
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
            </div>

            {/* mobile menu trigger (<md) */}
            <div className="flex md:hidden items-center gap-2">
              <div
                className={`flex items-center gap-1 px-2 py-1 border-[2px] border-navy rounded-lg ${
                  requestCount >= (usage?.hourly_limit || 20)
                    ? "bg-coral-light"
                    : requestCount >= Math.max(1, Math.floor((usage?.hourly_limit || 20) * 0.75))
                      ? "bg-sunny-light"
                      : "bg-lavender-light"
                }`}
                title="Messages sent this hour"
              >
                <span className="text-[10px] font-bold text-navy">
                  {requestCount}/{usage?.hourly_limit || 20}
                </span>
              </div>
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
                      className="fixed inset-0 z-[70]"
                      onClick={() => setShowMobileMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 bg-snow border-[3px] border-navy rounded-xl z-[70] w-56 shadow-[4px_4px_0_0_#000] overflow-hidden">
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
            className="fixed inset-0 bg-navy/50 z-[70]"
            onClick={() => setShowConversations(false)}
          />
          <div className="fixed top-0 right-0 h-full w-full sm:w-80 bg-ghost border-l-[4px] border-navy z-[70] flex flex-col">
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
                      title="Clear search"
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
                          <p className="text-body font-bold text-sm text-navy truncate">
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
            {/* Centered Date Separator */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-[1px] bg-cloud" />
              <span className="text-[10px] font-bold text-slate uppercase tracking-widest px-3 py-1 rounded-full bg-snow border border-cloud">
                {new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
              </span>
              <div className="flex-1 h-[1px] bg-cloud" />
            </div>

            {messages.filter((m) => m.text || m.sender === "user").map((message) => (
              <div
                key={message.id}
                className={`flex gap-2.5 ${message.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    message.sender === "user"
                      ? "bg-navy text-snow border border-navy/20"
                      : "bg-lavender-light text-navy border border-lavender/40"
                  }`}
                >
                  {message.sender === "user" ? (
                    <span className="text-xs font-bold">
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
                  className={`flex-1 max-w-[85%] md:max-w-[72%] space-y-1.5 ${message.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`px-4 py-3.5 relative ${
                      message.sender === "user"
                        ? "bg-lavender text-snow rounded-2xl rounded-tr-xs shadow-[3px_3px_0_0_#000] border-[3px] border-navy"
                        : "bg-snow text-navy border-[3px] border-navy shadow-[3px_3px_0_0_#000] rounded-2xl rounded-tl-xs"
                    }`}
                  >
                    {/* Voice Note audio player box if voice message */}
                    {(message as any).isVoice && (
                      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2.5 flex items-center gap-3 mb-2 border border-white/20">
                        <div className="w-9 h-9 rounded-xl bg-lime flex items-center justify-center text-navy shrink-0 shadow-sm">
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-0.5 mb-1 h-3">
                            {[40, 60, 30, 80, 50, 90, 70, 40, 60, 30, 80, 50, 40, 70, 30, 50, 80].map((h, i) => (
                              <div key={i} className="w-1 bg-snow/80 rounded-full" style={{ height: `${h / 6}px` }} />
                            ))}
                          </div>
                          <div className="text-[10px] text-snow/90 font-mono truncate">
                            voice-note.webm · 0:03
                          </div>
                        </div>
                      </div>
                    )}

                    <div className={`text-body font-medium text-sm leading-relaxed ${message.sender === "user" ? "text-snow" : "text-navy"}`}>
                      {message.sender === "ai"
                        ? formatAIResponse(message.text)
                        : message.text}
                    </div>

                    {/* Suggestions inside AI bubble */}
                    {message.sender === "ai" &&
                      message.suggestions &&
                      message.suggestions.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-cloud/60 space-y-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate">
                            <svg
                              className="w-3.5 h-3.5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 00.572.729 6.016 6.016 0 002.856 0A.75.75 0 0012 15.1v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.863 17.414a.75.75 0 00-.226 1.483 9.066 9.066 0 002.726 0 .75.75 0 00-.226-1.483 7.553 7.553 0 01-2.274 0z" />
                            </svg>
                            Quick actions
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {message.suggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                onClick={() =>
                                  handleSuggestionClick(suggestion)
                                }
                                className="px-3 py-1 bg-lavender-light text-navy border border-lavender/40 hover:bg-lavender/20 font-bold text-[10px] uppercase tracking-[0.05em] transition-all rounded-full"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Inside bubble bottom timestamp & checkmarks */}
                    {message.sender === "user" ? (
                      <div className="flex items-center justify-end gap-1 mt-1.5 text-[10px] text-snow/90 font-medium">
                        <span>{message.time}</span>
                        <svg className="w-3.5 h-3.5 text-snow/90 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 12l5 5L18 6" />
                          <path d="M7 12l5 5L22 6" />
                        </svg>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-cloud/50 text-[10px] text-slate">
                        <span>{message.time}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopy(message.text, message.id)}
                            className="p-1 hover:bg-cloud transition-colors rounded"
                            aria-label="Copy message"
                          >
                            {copiedId === message.id ? (
                              <svg className="w-3 h-3 text-teal" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 011.43 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3 text-slate hover:text-navy" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                                <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => speakMessage(message.text, message.id)}
                            className="p-1 hover:bg-cloud transition-colors rounded"
                            aria-label="Listen"
                          >
                            {isSpeaking && speakingMessageId === message.id ? (
                              <svg className="w-3 h-3 text-coral animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5.25 3A2.25 2.25 0 003 5.25v9.5A2.25 2.25 0 0017 14.75v-9.5A2.25 2.25 0 0014.75 3h-9.5z" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3 text-slate hover:text-navy" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 3.75a.75.75 0 00-1.264-.546L4.703 7H3.167a.75.75 0 00-.7.48A6.985 6.985 0 002 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h1.535l4.033 3.796A.75.75 0 0010 16.25V3.75zM15.95 5.05a.75.75 0 00-1.06 1.061 5.5 5.5 0 010 7.778.75.75 0 001.06 1.06 7 7 0 000-9.899z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading */}
            {loading && (
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
                      <span className="text-slate text-sm text-body font-medium">
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
                        <p className="text-body font-medium text-sm text-navy">
                          {suggestion}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Scroll anchor */}
            <div className="h-px" />
          </div>

          {/* ════════════════════════════════════════
              FIXED INPUT AREA (NEO-BRUTALIST DESIGN SYSTEM)
          ════════════════════════════════════════ */}
          <div
            className={`fixed bottom-16 md:bottom-0 left-0 right-0 bg-ghost/95 backdrop-blur-sm border-t-[3px] border-navy z-20 transition-all duration-300 ${
              isExpanded ? "md:left-[260px]" : "md:left-[72px]"
            }`}
          >
            <div className="max-w-5xl mx-auto px-4 md:px-8 py-3.5 space-y-3">
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
                      className="flex items-center gap-2 px-3 py-2 bg-snow border-[3px] border-navy rounded-xl font-display font-bold text-[10px] text-navy uppercase tracking-[0.08em] shadow-[3px_3px_0_0_#000] press-3 press-black transition-all"
                    >
                      <div className={`w-2 h-2 rounded-full ${action.color}`} />
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {isListening && (
                <div className="flex items-center justify-between px-3.5 py-2 bg-coral-light border-[3px] border-navy rounded-xl text-navy font-bold text-xs shadow-[3px_3px_0_0_#000]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-coral animate-ping" />
                    <span>Listening... speak your question now</span>
                  </div>
                  <button onClick={toggleListening} className="text-[10px] uppercase tracking-wider underline hover:text-coral font-bold">
                    Cancel
                  </button>
                </div>
              )}

              {/* Input Card Container */}
              <div className="flex items-start gap-2">
                {/* Voice Input Button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-3.5 border-[3px] border-navy rounded-xl transition-all shrink-0 press-2 shadow-[2px_2px_0_0_#000] ${
                    isListening
                      ? "bg-coral text-snow shadow-[3px_3px_0_0_#000] animate-pulse"
                      : "bg-snow text-navy hover:bg-lime-light"
                  }`}
                  title={isListening ? "Stop voice listening" : "Hands-Free Voice Mode"}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z" />
                    <path d="M19 11a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.92V20H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.08A7 7 0 0 0 19 11z" />
                  </svg>
                </button>

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
                    placeholder="Ask IESA AI anything about your courses, dues, or timetable..."
                    className="w-full px-4 py-3 bg-snow border-[3px] border-navy font-display font-normal text-sm text-navy placeholder:text-slate focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/20 resize-none transition-all min-h-12 max-h-30 scrollbar-none rounded-xl shadow-[3px_3px_0_0_#000]"
                    disabled={loading}
                  />
                </div>

                {/* Send Button */}
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="px-4 py-3.5 bg-navy border-[3px] border-lavender press-3 press-lime font-display font-black text-xs uppercase tracking-wider text-lavender disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0 rounded-xl shadow-[3px_3px_0_0_#000]"
                  aria-label="Send message"
                >
                  <svg
                    className="w-4 h-4 text-lavender"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M3.105 2.288a.75.75 0 00-.826.95l1.414 4.926A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.897 28.897 0 0015.293-7.155.75.75 0 000-1.114A28.897 28.897 0 003.105 2.288z" />
                  </svg>
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>

              <p className="text-[10px] text-slate text-center font-medium">
                IESA AI integrates live department records · Always double-check official notices.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
