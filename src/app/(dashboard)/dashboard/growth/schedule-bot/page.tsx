"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, MoreVertical, Copy, MoreHorizontal } from "lucide-react";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
  time?: string;
}

export default function ScheduleBotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [openMessageId, setOpenMessageId] = useState<number | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = chatRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const nowTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now(),
      text: input.trim(),
      sender: "user",
      time: nowTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/schedule-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userMessage.text }),
      });

      const data = await response.json();

      const botMessage: Message = {
        id: Date.now() + 1,
        text: data?.reply ?? "Sorry, I could not process that.",
        sender: "bot",
        time: nowTime(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "Sorry, something went wrong.",
          sender: "bot",
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
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  };

  const clearChat = () => setMessages([]);

  const exportChat = async () => {
    const text = messages
      .map((m) => `${m.time ?? ""} ${m.sender.toUpperCase()}: ${m.text}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text || "");
      setExportStatus("Copied to clipboard");
      setTimeout(() => setExportStatus(null), 2000);
    } catch (err) {
      setExportStatus("Failed to copy");
      setTimeout(() => setExportStatus(null), 2000);
    }
  };

  return (
    <div className="min-h-[60vh] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
            Academic Schedule Bot
          </h1>
          <div className="relative">
            <button
              onClick={() => setHeaderMenuOpen((v) => !v)}
              aria-label="Open menu"
              className="p-2 rounded-md hover:bg-foreground/5 transition"
            >
              <MoreVertical className="w-5 h-5 text-foreground/70" />
            </button>

            {headerMenuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-background border border-[var(--glass-border)] rounded-md shadow-lg py-1 z-50">
                <button
                  onClick={async () => {
                    setHeaderMenuOpen(false);
                    await exportChat();
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-foreground/5"
                >
                  <Copy className="inline-block mr-2 w-4 h-4" /> Export Chat
                </button>
                <button
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    clearChat();
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-foreground/5"
                >
                  Clear Chat
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] p-4">
          <div
            id="chat-box"
            ref={chatRef}
            aria-live="polite"
            className="h-auto md:h-96 lg:h-[60vh] overflow-y-auto mb-8 py-4 rounded-lg flex flex-col gap-3"
          >
            {messages.length === 0 && (
              <div className="text-foreground/60 text-center">
                Ask me anything about your schedule — e.g., &quot;When is my
                next exam?&quot;
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className="flex items-end gap-3 max-w-full relative"
              >
                {message.sender === "bot" && (
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 text-foreground text-xs font-bold">
                    B
                  </div>
                )}

                <div
                  className={`p-3 rounded-xl shadow-sm max-w-[70%] ${
                    message.sender === "user"
                      ? "ml-auto bg-primary text-background"
                      : "bg-foreground/10 text-foreground"
                  }`}
                >
                  <div className="whitespace-pre-wrap text-xs">{message.text}</div>
                  <div className="flex flex-row items-center gap-2 justify-between">
                    <div className={`text-[11px] ${message.sender === "user" ? "text-background/70" : "text-foreground/60"} text-right`}>
                      {message.time}
                    </div>
                    {/* per-message options */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenMessageId(
                            openMessageId === message.id ? null : message.id
                          )
                        }
                        className="px-1 rounded hover:bg-foreground/5 transition"
                        aria-label="Message options"
                      >
                        <MoreHorizontal className={`w-4 h-4 ${message.sender === "user" ? "text-background/70" : "text-foreground/60"}`} />
                      </button>

                      {openMessageId === message.id && (
                        <div className="absolute top-4 right-0 mt-2 w-32 bg-background border border-[var(--glass-border)] rounded-md shadow-md py-1 z-50">
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  message.text
                                );
                                setCopiedMessageId(message.id);
                                setTimeout(
                                  () => setCopiedMessageId(null),
                                  1500
                                );
                              } catch {
                                /* ignore */
                              } finally {
                                setOpenMessageId(null);
                              }
                            }}
                            className="w-full text-foreground text-left px-3 py-2 text-[10px] hover:bg-foreground/5"
                          >
                            <Copy className="inline-block mr-2 w-4 h-4" /> Copy
                            message
                          </button>
                        </div>
                      )}
                      {copiedMessageId === message.id && (
                        <div className="absolute top-4 right-0 text-[11px] w-32 bg-background border border-[var(--glass-border)] rounded-md shadow-md py-1 z-50 text-primary mt-1">
                          Copied
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {message.sender === "user" && (
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    U
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 text-foreground text-xs font-bold">
                  B
                </div>
                <div className="p-3 rounded-xl bg-foreground/10 text-foreground">
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-foreground/60 animate-pulse"
                      style={{ animationDelay: "0s" }}
                    />
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-foreground/60 animate-pulse"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-foreground/60 animate-pulse"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the schedule... (Enter to send, Shift+Enter for newline)"
              className="flex-1 min-h-[58px] max-h-[240px] px-4 py-3 rounded-lg bg-background/50 text-xs text-foreground placeholder-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary resize-none overflow-auto"
              disabled={loading}
            />

            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="px-4 py-2 bg-primary text-background rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span className="sr-only">Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
