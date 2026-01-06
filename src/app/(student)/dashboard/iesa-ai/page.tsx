"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { getApiUrl } from "@/lib/api";

// Web Speech API types for TypeScript
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

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

// Simple markdown-like formatter for AI responses
function formatAIResponse(text: string): React.ReactNode {
  // Split by code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    // Handle code blocks
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
          className="my-2 p-3 bg-bg-secondary border border-border overflow-x-auto text-xs"
        >
          {language && (
            <div className="text-text-muted text-[10px] mb-2 uppercase">
              {language}
            </div>
          )}
          <code>{codeContent}</code>
        </pre>
      );
    }

    // Handle inline formatting
    return (
      <span key={i}>
        {part.split("\n").map((line, lineIdx) => {
          // Headers
          if (line.startsWith("### ")) {
            return (
              <h4 key={lineIdx} className="font-display text-base mt-3 mb-1">
                {line.slice(4)}
              </h4>
            );
          }
          if (line.startsWith("## ")) {
            return (
              <h3 key={lineIdx} className="font-display text-lg mt-3 mb-1">
                {line.slice(3)}
              </h3>
            );
          }
          if (line.startsWith("# ")) {
            return (
              <h2 key={lineIdx} className="font-display text-xl mt-3 mb-1">
                {line.slice(2)}
              </h2>
            );
          }

          // Lists - wrap in ul/ol
          if (line.match(/^[-*]\s/)) {
            return (
              <ul key={lineIdx} className="ml-4 list-disc">
                <li>{formatInline(line.slice(2))}</li>
              </ul>
            );
          }
          if (line.match(/^\d+\.\s/)) {
            return (
              <ol key={lineIdx} className="ml-4 list-decimal">
                <li>{formatInline(line.replace(/^\d+\.\s/, ""))}</li>
              </ol>
            );
          }

          // Regular line with inline formatting
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

function formatInline(text: string): React.ReactNode {
  // Bold: **text** or __text__
  // Italic: *text* or _text_
  // Code: `code`
  const regex = /(\*\*.*?\*\*|__.*?__|`.*?`|\*.*?\*|_.*?_)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("__") && part.endsWith("__")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-1.5 py-0.5 bg-bg-secondary text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    ) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

// Quick action shortcuts
const QUICK_ACTIONS = [
  { label: "Check my dues", icon: "💳", query: "What's my payment status?" },
  {
    label: "Today's classes",
    icon: "📅",
    query: "What classes do I have today?",
  },
  { label: "Upcoming events", icon: "🎉", query: "What events are coming up?" },
  { label: "My timetable", icon: "🕐", query: "Show my class timetable" },
];

// Language options for responses
const LANGUAGE_OPTIONS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "pcm", label: "Pidgin", flag: "🇳🇬" },
  { code: "yo", label: "Yorùbá", flag: "🇳🇬" },
] as const;

type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["code"];

export default function IESAAIPage() {
  const { user } = useAuth();
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
  const [isListening, setIsListening] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [responseLanguage, setResponseLanguage] = useState<LanguageCode>("en");
  const [languageLocked, setLanguageLocked] = useState(false); // Lock language after first message
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(
    null
  );
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = chatRef.current;
    if (el) {
      setTimeout(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }, 100);
    }
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = false; // Changed to false - more reliable
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const results = event.results;
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < results.length; i++) {
          const transcript = results[i][0].transcript;
          if (results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setInput((prev) => {
          if (finalTranscript) {
            return prev + finalTranscript;
          }
          // Show interim results
          const words = prev.trim().split(" ");
          const baseText = words.length > 0 ? words.slice(0, -1).join(" ") : "";
          return baseText + (baseText ? " " : "") + interimTranscript;
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        const errorMessages: Record<string, string> = {
          "no-speech": "No speech detected. Please try again.",
          "audio-capture": "No microphone found. Please check your microphone.",
          "not-allowed":
            "Microphone permission denied. Please allow microphone access.",
          network: "Network error. Please check your connection.",
          aborted: "Speech recognition was aborted.",
          "service-not-allowed": "Speech service not allowed. Try using HTTPS.",
        };

        const message =
          errorMessages[event.error] ||
          `Speech recognition error: ${event.error}`;
        console.error("Speech recognition error:", event.error, event.message);

        if (event.error !== "aborted" && event.error !== "no-speech") {
          alert(message);
        }

        setIsListening(false);
      };
    }
  }, []);

  const toggleVoiceInput = async () => {
    if (!recognitionRef.current) {
      alert(
        "Voice input is not supported in your browser. Try using Chrome or Edge."
      );
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Request microphone permission first
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        alert(
          "Microphone access denied. Please allow microphone permissions in your browser settings."
        );
        return;
      }

      // Clear previous input when starting new recording
      setInput("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error("Failed to start speech recognition:", error);
        alert(
          "Could not start voice input. Please refresh the page and try again."
        );
      }
    }
  };

  // Text-to-Speech for AI responses
  const speakMessage = (text: string, messageId: number) => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in your browser");
      return;
    }

    // Stop any current speech
    window.speechSynthesis.cancel();

    if (isSpeaking && speakingMessageId === messageId) {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      return;
    }

    // Clean the text (remove markdown formatting and emojis)
    const cleanText = text
      .replace(/```[\s\S]*?```/g, "code block")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/_(.*?)_/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/#+\s/g, "")
      .replace(/[-*]\s/g, "")
      // Remove emojis - comprehensive regex for all emoji types
      .replace(/[\u{1F600}-\u{1F64F}]/gu, "") // Emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, "") // Misc Symbols and Pictographs
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, "") // Transport and Map
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "") // Flags
      .replace(/[\u{2600}-\u{26FF}]/gu, "") // Misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, "") // Dingbats
      .replace(/[\u{FE00}-\u{FE0F}]/gu, "") // Variation Selectors
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, "") // Supplemental Symbols
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "") // Chess Symbols
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "") // Symbols Extended-A
      .replace(/[\u{231A}-\u{231B}]/gu, "") // Watch, Hourglass
      .replace(/[\u{23E9}-\u{23F3}]/gu, "") // Various symbols
      .replace(/[\u{23F8}-\u{23FA}]/gu, "") // Various symbols
      .replace(/[\u{25AA}-\u{25AB}]/gu, "") // Squares
      .replace(/[\u{25B6}]/gu, "") // Play button
      .replace(/[\u{25C0}]/gu, "") // Reverse button
      .replace(/[\u{25FB}-\u{25FE}]/gu, "") // Squares
      .replace(/[\u{2614}-\u{2615}]/gu, "") // Umbrella, Hot beverage
      .replace(/[\u{2648}-\u{2653}]/gu, "") // Zodiac
      .replace(/[\u{267F}]/gu, "") // Wheelchair
      .replace(/[\u{2693}]/gu, "") // Anchor
      .replace(/[\u{26A1}]/gu, "") // High voltage
      .replace(/[\u{26AA}-\u{26AB}]/gu, "") // Circles
      .replace(/[\u{26BD}-\u{26BE}]/gu, "") // Soccer, Baseball
      .replace(/[\u{26C4}-\u{26C5}]/gu, "") // Snowman, Sun
      .replace(/[\u{26CE}]/gu, "") // Ophiuchus
      .replace(/[\u{26D4}]/gu, "") // No entry
      .replace(/[\u{26EA}]/gu, "") // Church
      .replace(/[\u{26F2}-\u{26F3}]/gu, "") // Fountain, Golf
      .replace(/[\u{26F5}]/gu, "") // Sailboat
      .replace(/[\u{26FA}]/gu, "") // Tent
      .replace(/[\u{26FD}]/gu, "") // Fuel pump
      .replace(/[\u{2702}]/gu, "") // Scissors
      .replace(/[\u{2705}]/gu, "") // Check mark
      .replace(/[\u{2708}-\u{270D}]/gu, "") // Airplane, etc
      .replace(/[\u{270F}]/gu, "") // Pencil
      .replace(/[\u{2712}]/gu, "") // Black nib
      .replace(/[\u{2714}]/gu, "") // Check mark
      .replace(/[\u{2716}]/gu, "") // X mark
      .replace(/[\u{271D}]/gu, "") // Latin cross
      .replace(/[\u{2721}]/gu, "") // Star of David
      .replace(/[\u{2728}]/gu, "") // Sparkles
      .replace(/[\u{2733}-\u{2734}]/gu, "") // Eight spoked asterisk
      .replace(/[\u{2744}]/gu, "") // Snowflake
      .replace(/[\u{2747}]/gu, "") // Sparkle
      .replace(/[\u{274C}]/gu, "") // Cross mark
      .replace(/[\u{274E}]/gu, "") // Cross mark
      .replace(/[\u{2753}-\u{2755}]/gu, "") // Question marks
      .replace(/[\u{2757}]/gu, "") // Exclamation mark
      .replace(/[\u{2763}-\u{2764}]/gu, "") // Heart exclamation, Heart
      .replace(/[\u{2795}-\u{2797}]/gu, "") // Plus, Minus, Division
      .replace(/[\u{27A1}]/gu, "") // Right arrow
      .replace(/[\u{27B0}]/gu, "") // Curly loop
      .replace(/[\u{27BF}]/gu, "") // Double curly loop
      .replace(/[\u{2934}-\u{2935}]/gu, "") // Arrows
      .replace(/[\u{2B05}-\u{2B07}]/gu, "") // Arrows
      .replace(/[\u{2B1B}-\u{2B1C}]/gu, "") // Squares
      .replace(/[\u{2B50}]/gu, "") // Star
      .replace(/[\u{2B55}]/gu, "") // Circle
      .replace(/[\u{3030}]/gu, "") // Wavy dash
      .replace(/[\u{303D}]/gu, "") // Part alternation mark
      .replace(/[\u{3297}]/gu, "") // Circled Ideograph Congratulation
      .replace(/[\u{3299}]/gu, "") // Circled Ideograph Secret
      .replace(/\s+/g, " ") // Collapse multiple spaces
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    speechSynthRef.current = utterance;

    // Find the best voice for the selected language
    const findBestVoice = (lang: LanguageCode): SpeechSynthesisVoice | null => {
      const voices =
        availableVoices.length > 0
          ? availableVoices
          : window.speechSynthesis.getVoices();

      // Priority order for voice selection
      const langPreferences: Record<LanguageCode, string[]> = {
        en: ["en-GB", "en-NG", "en-US", "en-AU", "en"],
        pcm: ["en-NG", "en-GB", "en-US", "en"], // Pidgin - prefer Nigerian English
        yo: ["yo-NG", "yo", "en-NG", "en-GB", "en"], // Yoruba with fallback to Nigerian English
      };

      const prefs = langPreferences[lang];

      // Try to find premium/natural voices first (they usually have "Natural", "Neural", or "Premium" in name)
      for (const pref of prefs) {
        const premiumVoice = voices.find(
          (v) =>
            v.lang.startsWith(pref) &&
            (v.name.includes("Natural") ||
              v.name.includes("Neural") ||
              v.name.includes("Premium") ||
              v.name.includes("Google"))
        );
        if (premiumVoice) return premiumVoice;
      }

      // Fall back to any matching voice
      for (const pref of prefs) {
        const voice = voices.find((v) => v.lang.startsWith(pref));
        if (voice) return voice;
      }

      // Last resort: use default
      return voices[0] || null;
    };

    const selectedVoice = findBestVoice(responseLanguage);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      // Fallback language codes
      const langMap: Record<LanguageCode, string> = {
        en: "en-GB",
        pcm: "en-NG",
        yo: "yo-NG",
      };
      utterance.lang = langMap[responseLanguage];
    }

    // Optimize speech settings for clarity
    utterance.rate = 0.95; // Slightly slower for clarity
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

  // Load available voices
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
      }
    };

    // Load voices immediately if available
    loadVoices();

    // Also listen for voiceschanged event (required for some browsers)
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  // Stop speech when component unmounts
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Export chat as text file
  const exportChat = () => {
    if (messages.length === 0) return;

    const chatContent = messages
      .map((msg) => {
        const sender = msg.sender === "user" ? "You" : "IESA AI";
        return `[${msg.time}] ${sender}:\n${msg.text}\n`;
      })
      .join("\n---\n\n");

    const header = `IESA AI Conversation Export\nDate: ${new Date().toLocaleDateString()}\nUser: ${
      user?.displayName || "Student"
    }\n\n${"=".repeat(50)}\n\n`;
    const fullContent = header + chatContent;

    const blob = new Blob([fullContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iesa-ai-chat-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const saved = localStorage.getItem("iesa-ai-conversations");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConversations(parsed);
      } catch (e) {
        console.error("Failed to parse saved conversations:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0 && currentConversationId) {
      const updatedConversations = conversations.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages, updatedAt: new Date().toISOString() }
          : conv
      );
      setConversations(updatedConversations);
      localStorage.setItem(
        "iesa-ai-conversations",
        JSON.stringify(updatedConversations)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentConversationId]);

  useEffect(() => {
    fetch(getApiUrl("/api/v1/iesa-ai/suggestions"))
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

  useEffect(() => {
    if (messages.length === 0 && user) {
      const welcomeMsg: Message = {
        id: Date.now(),
        text: `Hey ${
          user.displayName?.split(" ")[0] || "there"
        }! I'm IESA AI, your smart campus assistant. I already know everything about you — your level, payment status, upcoming events, and more. Just ask me anything, and I'll give you personalized answers without needing to ask for details. What would you like to know?`,
        sender: "ai",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        suggestions: quickSuggestions.slice(0, 4),
      };
      setMessages([welcomeMsg]);
    }
  }, [user, quickSuggestions.length, messages.length, quickSuggestions]);

  const nowTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Clear suggestions from last AI message
  const clearLastSuggestions = () => {
    setMessages((prev) =>
      prev.map((msg, idx) =>
        idx === prev.length - 1 && msg.sender === "ai" && msg.suggestions
          ? { ...msg, suggestions: undefined }
          : msg
      )
    );
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || loading) return;

    // Lock language after first user message
    if (!languageLocked) {
      setLanguageLocked(true);
    }

    // Clear suggestions when sending any message
    clearLastSuggestions();

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
      localStorage.setItem(
        "iesa-ai-conversations",
        JSON.stringify(updatedConvs)
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

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const conversationHistory = messages.slice(-10).map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text,
      }));

      const response = await fetch(getApiUrl("/api/v1/iesa-ai/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user?.getIdToken()}`,
        },
        body: JSON.stringify({
          message: textToSend,
          conversationHistory,
          language: responseLanguage, // Send language preference to backend
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

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
    sendMessage(suggestion);
  };

  const handleCopy = async (text: string, id: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
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
    if (messages.length > 1 && currentConversationId) {
      const title =
        messages.find((m) => m.sender === "user")?.text.slice(0, 50) ||
        "New Chat";
      const updatedConversations = conversations.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, title, messages, updatedAt: new Date().toISOString() }
          : conv
      );
      setConversations(updatedConversations);
      localStorage.setItem(
        "iesa-ai-conversations",
        JSON.stringify(updatedConversations)
      );
    }

    const newId = Date.now().toString();
    const newConversation: ChatConversation = {
      id: newId,
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedConvs = [newConversation, ...conversations];
    setConversations(updatedConvs);
    setCurrentConversationId(newId);
    localStorage.setItem("iesa-ai-conversations", JSON.stringify(updatedConvs));

    setMessages([]);
    setLanguageLocked(false); // Unlock language for new chat
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
    if (currentConversationId === id) {
      clearChat();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      <DashboardHeader title="IESA AI" />

      {/* Sub-header with actions */}
      <div className="bg-bg-primary border-b border-border sticky top-16 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 md:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-charcoal dark:bg-cream flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-cream dark:text-charcoal"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-label-sm text-text-muted">
                  Your Smart Campus Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {userContext && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-border">
                  <svg
                    className="w-3.5 h-3.5 text-text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                  <span className="text-label-sm text-text-secondary">
                    {userContext.level} · {userContext.matric}
                  </span>
                </div>
              )}

              <button
                onClick={() => setShowConversations(!showConversations)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-label-sm text-text-secondary hover:border-border-dark hover:text-text-primary transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                  />
                </svg>
                <span className="hidden sm:inline">
                  Chats ({conversations.length})
                </span>
              </button>

              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-label-sm text-text-secondary hover:border-border-dark hover:text-text-primary transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
                <span className="hidden sm:inline">New</span>
              </button>

              {/* Language Selector */}
              <div className="relative">
                <button
                  onClick={() =>
                    !languageLocked && setShowLanguageMenu(!showLanguageMenu)
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 border text-label-sm transition-colors ${
                    languageLocked
                      ? "border-border/50 text-text-muted cursor-not-allowed"
                      : "border-border text-text-secondary hover:border-border-dark hover:text-text-primary"
                  }`}
                  title={
                    languageLocked
                      ? "Language locked for this chat. Start a new chat to change language."
                      : "Response language"
                  }
                >
                  <span>
                    {
                      LANGUAGE_OPTIONS.find((l) => l.code === responseLanguage)
                        ?.flag
                    }
                  </span>
                  <span className="hidden sm:inline">
                    {
                      LANGUAGE_OPTIONS.find((l) => l.code === responseLanguage)
                        ?.label
                    }
                  </span>
                  {languageLocked ? (
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
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
                    <div className="absolute right-0 top-full mt-1 bg-bg-card border border-border shadow-lg z-50 min-w-36">
                      <div className="px-3 py-2 border-b border-border">
                        <p className="text-[10px] text-text-muted">
                          Language will be locked after your first message
                        </p>
                      </div>
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setResponseLanguage(lang.code);
                            setShowLanguageMenu(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-label-sm text-left transition-colors ${
                            responseLanguage === lang.code
                              ? "bg-bg-secondary text-text-primary"
                              : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                          }`}
                        >
                          <span>{lang.flag}</span>
                          <span>{lang.label}</span>
                          {responseLanguage === lang.code && (
                            <svg
                              className="w-3 h-3 ml-auto"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-label-sm text-text-secondary hover:border-border-dark hover:text-text-primary transition-colors"
                  title="Export conversation"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                  <span className="hidden sm:inline">Export</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conversations Sidebar */}
      {showConversations && (
        <>
          <div
            className="fixed inset-0 bg-charcoal/50 dark:bg-black/50 z-40"
            onClick={() => setShowConversations(false)}
          />
          <div className="fixed top-0 right-0 h-full w-full sm:w-80 bg-bg-primary border-l border-border z-50 flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-lg text-text-primary">
                Conversations
              </h2>
              <button
                onClick={() => setShowConversations(false)}
                className="p-2 hover:bg-bg-secondary transition-colors"
                title="Close sidebar"
              >
                <svg
                  className="w-5 h-5 text-text-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {conversations.length === 0 ? (
                <p className="text-label-sm text-text-muted text-center py-8">
                  No conversations yet
                </p>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group p-3 border transition-colors cursor-pointer ${
                      currentConversationId === conv.id
                        ? "border-border-dark bg-bg-secondary"
                        : "border-border hover:border-border-dark"
                    }`}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-body text-sm text-text-primary truncate">
                          {conv.title}
                        </p>
                        <p className="text-label-sm text-text-muted mt-1">
                          {new Date(conv.updatedAt).toLocaleDateString()} ·{" "}
                          {conv.messages.length} messages
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                        title="Delete conversation"
                      >
                        <svg
                          className="w-4 h-4 text-red-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
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

      {/* Chat Area - with padding for fixed input */}
      <div className="flex-1 overflow-hidden relative">
        <div className="max-w-5xl mx-auto h-full flex flex-col px-4 md:px-8">
          {/* Messages container */}
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto space-y-6 py-6 pb-44 md:pb-36 scroll-smooth"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.sender === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 flex items-center justify-center shrink-0 bg-charcoal dark:bg-cream">
                  {message.sender === "user" ? (
                    <span className="text-cream dark:text-charcoal text-sm font-display">
                      {user?.displayName?.[0] || "U"}
                    </span>
                  ) : (
                    <svg
                      className="w-4 h-4 text-cream dark:text-charcoal"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                      />
                    </svg>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`flex-1 max-w-[85%] md:max-w-[75%] space-y-2 ${
                    message.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`px-4 py-3 ${
                      message.sender === "user"
                        ? "bg-charcoal dark:bg-cream text-cream dark:text-charcoal"
                        : "bg-bg-card border border-border text-text-primary"
                    }`}
                  >
                    <div className="text-body text-sm leading-relaxed">
                      {message.sender === "ai"
                        ? formatAIResponse(message.text)
                        : message.text}
                    </div>

                    {/* Suggestions - inside AI bubble only */}
                    {message.sender === "ai" &&
                      message.suggestions &&
                      message.suggestions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border space-y-2">
                          <div className="flex items-center gap-1.5 text-label-sm text-text-muted">
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                              />
                            </svg>
                            <span>Quick actions:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {message.suggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                onClick={() =>
                                  handleSuggestionClick(suggestion)
                                }
                                className="px-3 py-1.5 border border-border text-label-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Metadata - time & actions */}
                  <div
                    className={`flex items-center gap-2 px-1 ${
                      message.sender === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <span className="text-[10px] text-text-muted">
                      {message.time}
                    </span>

                    {/* Copy button - for both user and AI */}
                    <button
                      onClick={() => handleCopy(message.text, message.id)}
                      className="p-1 hover:bg-bg-secondary transition-colors"
                      title="Copy message"
                    >
                      {copiedId === message.id ? (
                        <svg
                          className="w-3 h-3 text-green-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-3 h-3 text-text-muted hover:text-text-primary"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                          />
                        </svg>
                      )}
                    </button>

                    {/* Feedback buttons - AI only */}
                    {message.sender === "ai" && (
                      <div className="flex items-center gap-1">
                        {/* Speak button */}
                        <button
                          onClick={() => speakMessage(message.text, message.id)}
                          className={`p-1 hover:bg-bg-secondary transition-colors ${
                            isSpeaking && speakingMessageId === message.id
                              ? "bg-bg-secondary"
                              : ""
                          }`}
                          title={
                            isSpeaking && speakingMessageId === message.id
                              ? "Stop speaking"
                              : "Listen to response"
                          }
                        >
                          {isSpeaking && speakingMessageId === message.id ? (
                            <svg
                              className="w-3 h-3 text-red-500 animate-pulse"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-3 h-3 text-text-muted hover:text-text-primary"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
                              />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleFeedback(message.id, "up")}
                          className="p-1 hover:bg-bg-secondary transition-colors"
                          title="Helpful"
                        >
                          <svg
                            className="w-3 h-3 text-text-muted hover:text-green-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleFeedback(message.id, "down")}
                          className="p-1 hover:bg-bg-secondary transition-colors"
                          title="Not helpful"
                        >
                          <svg
                            className="w-3 h-3 text-text-muted hover:text-red-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 01-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 00.303-.54m.023-8.25H16.48a4.5 4.5 0 01-1.423-.23l-3.114-1.04a4.5 4.5 0 00-1.423-.23H6.504c-.618 0-1.217.247-1.605.729A11.95 11.95 0 002.25 12c0 .434.023.863.068 1.285C2.427 14.306 3.346 15 4.372 15h3.126c.618 0 .991.724.725 1.282A7.471 7.471 0 007.5 19.5a2.25 2.25 0 002.25 2.25.75.75 0 00.75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 002.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-charcoal dark:bg-cream flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-cream dark:text-charcoal animate-pulse"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                    />
                  </svg>
                </div>
                <div className="border border-border bg-bg-card px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted text-sm">
                      IESA AI is thinking
                    </span>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Suggestions - Empty state */}
            {messages.length === 0 && quickSuggestions.length > 0 && (
              <div className="mt-8 space-y-4">
                <p className="text-label-sm text-text-muted text-center">
                  Try asking me about:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {quickSuggestions.slice(0, 6).map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="p-4 border border-border hover:border-border-dark transition-colors text-left group"
                    >
                      <p className="text-body text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                        {suggestion}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Fixed Input Area */}
          <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-64 bg-bg-primary border-t border-border z-20">
            <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 space-y-3">
              {/* Quick Actions */}
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
                      className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-border hover:border-border-dark text-label-sm text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <span>{action.icon}</span>
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-start">
                {/* Voice Input Button */}
                <button
                  onClick={toggleVoiceInput}
                  disabled={loading}
                  className={`p-3 border transition-all shrink-0 ${
                    isListening
                      ? "bg-red-500 border-red-500 text-white animate-pulse"
                      : "border-border hover:border-border-dark text-text-secondary hover:text-text-primary"
                  }`}
                  title={isListening ? "Stop listening" : "Voice input"}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    {isListening ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                      />
                    )}
                  </svg>
                </button>

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
                    placeholder={
                      isListening
                        ? "Listening..."
                        : "Ask me anything about IESA..."
                    }
                    className="w-full px-4 py-3 bg-bg-card border border-border text-body text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-dark resize-none transition-colors min-h-12 max-h-30 scrollbar-none"
                    disabled={loading || isListening}
                  />
                </div>

                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="px-4 py-4 bg-charcoal dark:bg-cream text-cream dark:text-charcoal text-label-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-2 shrink-0"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                    />
                  </svg>
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>

              <p className="text-[10px] text-text-muted text-center">
                {isListening ? (
                  <span className="text-red-500">
                    ● Recording... Click mic to stop
                  </span>
                ) : (
                  "IESA AI can make mistakes. Verify important information."
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
