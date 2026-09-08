"use client";

import React, { useState, useMemo, useId } from "react";
import {
  Mail,
  Sparkles,
  Trash2,
  Copy,
  Check,
  Plus,
  ArrowUpDown,
  Layers,
  Search,
  CheckCircle2,
  Globe,
  UserCheck,
  ClipboardPaste,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";

interface RegisteredStudentInfo {
  email: string;
  name: string;
  matricNumber: string;
  level: string;
  department: string;
}

interface CustomEmailListManagerProps {
  emails: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
}

export const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;

export function parseAndFormatEmailBlob(raw: string): {
  uniqueEmails: string[];
  totalExtracted: number;
  duplicatesRemoved: number;
} {
  if (!raw) return { uniqueEmails: [], totalExtracted: 0, duplicatesRemoved: 0 };
  const matches = raw.match(EMAIL_REGEX) || [];
  const uniqueSet = new Set<string>();
  const uniqueEmails: string[] = [];

  for (const m of matches) {
    const cleaned = m.toLowerCase().trim();
    if (cleaned && !uniqueSet.has(cleaned)) {
      uniqueSet.add(cleaned);
      uniqueEmails.push(cleaned);
    }
  }

  return {
    uniqueEmails,
    totalExtracted: matches.length,
    duplicatesRemoved: matches.length - uniqueEmails.length,
  };
}

export function CustomEmailListManager({
  emails = [],
  onChange,
  disabled = false,
}: CustomEmailListManagerProps) {
  const pasteTextareaId = useId();
  const singleEmailInputId = useId();
  const searchFilterInputId = useId();
  const [pasteInput, setPasteInput] = useState("");
  const [singleInput, setSingleInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [registeredMap, setRegisteredMap] = useState<Record<string, RegisteredStudentInfo>>({});
  const [showPasteZone, setShowPasteZone] = useState(emails.length === 0);

  // Live preview of what's in the paste box
  const pastePreview = useMemo(() => {
    return parseAndFormatEmailBlob(pasteInput);
  }, [pasteInput]);

  // Breakdown of domains in current list
  const domainStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const email of emails) {
      const parts = email.split("@");
      const domain = parts[1] || "other";
      stats[domain] = (stats[domain] || 0) + 1;
    }
    return stats;
  }, [emails]);

  // Filtered emails based on search & selected domain
  const displayedEmails = useMemo(() => {
    return emails.filter((email) => {
      const matchesSearch = !searchQuery || email.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const domain = email.split("@")[1] || "other";
      const matchesDomain = selectedDomain === "all" || domain === selectedDomain;
      return matchesSearch && matchesDomain;
    });
  }, [emails, searchQuery, selectedDomain]);

  // Handle parsing paste zone and adding to list
  const handleApplyPaste = () => {
    if (!pasteInput.trim()) {
      toast.error("Please paste or type some emails first");
      return;
    }

    const { uniqueEmails, totalExtracted, duplicatesRemoved } = parseAndFormatEmailBlob(pasteInput);

    if (uniqueEmails.length === 0) {
      toast.error("No valid email addresses found in the pasted content");
      return;
    }

    // Merge with existing list
    const combinedSet = new Set(emails);
    let newlyAdded = 0;
    for (const e of uniqueEmails) {
      if (!combinedSet.has(e)) {
        combinedSet.add(e);
        newlyAdded++;
      }
    }

    const updated = Array.from(combinedSet);
    onChange(updated);
    setPasteInput("");
    setShowPasteZone(false);

    const dupMsg = duplicatesRemoved > 0 ? ` (${duplicatesRemoved} duplicate${duplicatesRemoved > 1 ? "s" : ""} removed)` : "";
    toast.success(`Smartly arranged ${newlyAdded} new email${newlyAdded === 1 ? "" : "s"}!${dupMsg}`);

    // Trigger background check for registered students
    verifyRegisteredEmails(updated);
  };

  // Add single email
  const handleAddSingle = () => {
    const trimmed = singleInput.toLowerCase().trim();
    if (!trimmed) return;

    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (emails.includes(trimmed)) {
      toast.info("This email is already in your recipient list");
      setSingleInput("");
      return;
    }

    const next = [...emails, trimmed];
    onChange(next);
    setSingleInput("");
    toast.success(`Added ${trimmed}`);
  };

  // Remove one email
  const handleRemoveEmail = (emailToRemove: string) => {
    const next = emails.filter((e) => e !== emailToRemove);
    onChange(next);
  };

  // Clear all emails
  const handleClearAll = () => {
    if (emails.length === 0) return;
    if (confirm(`Remove all ${emails.length} custom recipient emails?`)) {
      onChange([]);
      setRegisteredMap({});
      setShowPasteZone(true);
      toast.info("Recipient list cleared");
    }
  };

  // Sort A-Z
  const handleSortAZ = () => {
    const sorted = [...emails].sort((a, b) => a.localeCompare(b));
    onChange(sorted);
    toast.success("Sorted A-Z");
  };

  // Group by Domain
  const handleGroupByDomain = () => {
    const sorted = [...emails].sort((a, b) => {
      const domainA = a.split("@")[1] || "";
      const domainB = b.split("@")[1] || "";
      if (domainA !== domainB) return domainA.localeCompare(domainB);
      return a.localeCompare(b);
    });
    onChange(sorted);
    toast.success("Grouped and sorted by domain");
  };

  // Copy clean list
  const handleCopyCleanList = async () => {
    if (emails.length === 0) return;
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setCopied(true);
      toast.success(`Copied ${emails.length} clean emails to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Fast verify against registered students in backend
  const verifyRegisteredEmails = async (emailList: string[]) => {
    if (emailList.length === 0) return;
    setIsVerifying(true);
    try {
      const res = await apiClient.post<{
        registeredStudents?: RegisteredStudentInfo[];
      }>("/api/v1/announcements/parse-custom-emails", {
        emails: emailList,
      }, { showErrorToast: false });

      const students = res?.registeredStudents;
      if (students && Array.isArray(students)) {
        const map: Record<string, RegisteredStudentInfo> = {};
        for (const st of students) {
          map[st.email.toLowerCase()] = st;
        }
        setRegisteredMap(map);
      }
    } catch {
      // Non-blocking: background check fails silently
    } finally {
      setIsVerifying(false);
    }
  };

  const registeredCount = useMemo(() => {
    return emails.filter((e) => Boolean(registeredMap[e])).length;
  }, [emails, registeredMap]);

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-[2.5px] border-navy dark:border-white/20 rounded-xl shadow-[3px_3px_0_0_#1E293B] dark:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-yellow-400 text-navy rounded-lg font-black shadow-[2px_2px_0_0_#1E293B]">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-navy dark:text-white uppercase tracking-wider flex items-center gap-2">
                Custom Recipient List
                {emails.length > 0 && (
                  <span className="px-2 py-0.5 text-xs font-black bg-navy text-white dark:bg-white dark:text-navy rounded-full">
                    {emails.length} email{emails.length === 1 ? "" : "s"}
                  </span>
                )}
              </h4>
              <p className="text-xs text-charcoal/70 dark:text-white/60 font-medium">
                Paste messy text, spreadsheets, or comma-separated emails. We clean, format, and personalize automatically.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPasteZone(!showPasteZone)}
              className="px-3 py-1.5 text-xs font-black uppercase rounded-lg border-2 border-navy dark:border-white/30 bg-white dark:bg-navy text-navy dark:text-white hover:bg-yellow-300 dark:hover:bg-navy-light transition-all flex items-center gap-1.5 shadow-[2px_2px_0_0_#1E293B]"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              {showPasteZone ? "Hide Paste Zone" : "Paste / Import Emails"}
            </button>

            {emails.length > 0 && (
              <button
                type="button"
                onClick={handleCopyCleanList}
                className="px-3 py-1.5 text-xs font-black uppercase rounded-lg border-2 border-navy dark:border-white/30 bg-white dark:bg-navy text-navy dark:text-white hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-all flex items-center gap-1.5 shadow-[2px_2px_0_0_#1E293B]"
                title="Copy clean formatted list to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy List"}
              </button>
            )}
          </div>
        </div>

        {/* Registered Students badge summary */}
        {emails.length > 0 && (
          <div className="mt-3 pt-3 border-t border-navy/15 dark:border-white/10 flex flex-wrap items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                <UserCheck className="w-3.5 h-3.5" />
                {registeredCount > 0 ? (
                  <>
                    <strong className="underline decoration-emerald-500 underline-offset-2">{registeredCount}</strong> registered student{registeredCount === 1 ? "" : "s"} recognized
                  </>
                ) : (
                  <span>Checking registered profiles...</span>
                )}
              </span>
              <span className="text-charcoal/40 dark:text-white/30">•</span>
              <span className="text-charcoal/70 dark:text-white/60">
                {emails.length - registeredCount} external / guest recipient{emails.length - registeredCount === 1 ? "" : "s"}
              </span>
            </div>

            {isVerifying && (
              <span className="text-xs text-blue-600 font-semibold animate-pulse">
                Verifying student profiles...
              </span>
            )}
          </div>
        )}
      </div>

      {/* PASTE & SMART ARRANGE ZONE */}
      {showPasteZone && (
        <div className="p-4 bg-white dark:bg-navy-light/40 border-[2.5px] border-navy dark:border-white/20 rounded-xl shadow-[4px_4px_0_0_#1E293B] space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor={pasteTextareaId} className="text-xs font-black uppercase tracking-wider text-navy dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              Smart Paste Box (Any Format Accepted)
            </label>
            {pastePreview.totalExtracted > 0 && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500">
                ✨ Detected {pastePreview.uniqueEmails.length} valid email{pastePreview.uniqueEmails.length === 1 ? "" : "s"}
                {pastePreview.duplicatesRemoved > 0 && ` (${pastePreview.duplicatesRemoved} duplicate${pastePreview.duplicatesRemoved === 1 ? "" : "s"} stripped)`}
              </span>
            )}
          </div>

          <textarea
            id={pasteTextareaId}
            value={pasteInput}
            onChange={(e) => setPasteInput(e.target.value)}
            disabled={disabled}
            rows={4}
            placeholder={`Paste messy text with emails, e.g.:\njohn.doe@ui.edu.ng, Jane <jane.smith@gmail.com>; 219800@stu.ui.edu.ng\nOr copy-paste directly from an Excel/Sheets column!`}
            className="w-full text-xs font-mono p-3 bg-snow dark:bg-navy border-2 border-navy dark:border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-charcoal/40 dark:placeholder:text-white/30"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-charcoal/60 dark:text-white/50">
              Supports commas, semicolons, lines, spaces, and &quot;Name &lt;email&gt;&quot; format.
            </p>

            <div className="flex items-center gap-2">
              {pasteInput && (
                <button
                  type="button"
                  onClick={() => setPasteInput("")}
                  className="px-3 py-1 text-xs font-bold text-charcoal/70 hover:text-red-600 dark:text-white/70 transition-colors"
                >
                  Clear Box
                </button>
              )}
              <button
                type="button"
                onClick={handleApplyPaste}
                disabled={disabled || !pasteInput.trim()}
                className="px-4 py-2 text-xs font-black uppercase rounded-lg border-2 border-navy dark:border-white/20 bg-yellow-400 text-navy hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[2px_2px_0_0_#1E293B] flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Format & Add to List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK SINGLE ADD & SEARCH FILTER BAR */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Single email add */}
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40 dark:text-white/40" />
            <input
              id={singleEmailInputId}
              type="email"
              value={singleInput}
              onChange={(e) => setSingleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddSingle();
                }
              }}
              disabled={disabled}
              placeholder="Add single email (e.g. user@ui.edu.ng)"
              className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-white dark:bg-navy border-2 border-navy dark:border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          <button
            type="button"
            onClick={handleAddSingle}
            disabled={disabled || !singleInput.trim()}
            className="px-3 py-2 text-xs font-black uppercase bg-navy text-white dark:bg-white dark:text-navy rounded-lg border-2 border-navy dark:border-white/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1 shadow-[2px_2px_0_0_#1E293B]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {/* Search inside list if list > 4 */}
        {emails.length > 4 && (
          <div className="relative sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40 dark:text-white/40" />
            <input
              id={searchFilterInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in recipients..."
              className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-white dark:bg-navy border-2 border-navy dark:border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
        )}
      </div>

      {/* DOMAIN FILTER PILLS & ACTION TOOLBAR */}
      {emails.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Domain tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedDomain("all")}
              className={`px-2.5 py-1 text-[11px] font-black rounded-md border-2 transition-all ${
                selectedDomain === "all"
                  ? "bg-navy text-white border-navy dark:bg-white dark:text-navy"
                  : "bg-white dark:bg-navy text-charcoal/80 dark:text-white/80 border-navy/20 hover:border-navy"
              }`}
            >
              All ({emails.length})
            </button>

            {Object.entries(domainStats).map(([dom, count]) => (
              <button
                key={dom}
                type="button"
                onClick={() => setSelectedDomain(dom)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md border-2 transition-all flex items-center gap-1 ${
                  selectedDomain === dom
                    ? "bg-navy text-white border-navy dark:bg-white dark:text-navy"
                    : "bg-white dark:bg-navy text-charcoal/80 dark:text-white/80 border-navy/20 hover:border-navy"
                }`}
              >
                <Globe className="w-3 h-3 opacity-60" />
                {dom} ({count})
              </button>
            ))}
          </div>

          {/* Quick arranging tools */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSortAZ}
              className="px-2 py-1 text-[11px] font-bold bg-white dark:bg-navy border border-navy/30 dark:border-white/20 rounded hover:bg-snow dark:hover:bg-navy-light flex items-center gap-1"
              title="Sort Alphabetically"
            >
              <ArrowUpDown className="w-3 h-3" />
              Sort A-Z
            </button>
            <button
              type="button"
              onClick={handleGroupByDomain}
              className="px-2 py-1 text-[11px] font-bold bg-white dark:bg-navy border border-navy/30 dark:border-white/20 rounded hover:bg-snow dark:hover:bg-navy-light flex items-center gap-1"
              title="Group by email domain"
            >
              <Layers className="w-3 h-3" />
              Group by Domain
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2 py-1 text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-900 rounded hover:bg-red-100 flex items-center gap-1"
              title="Remove all recipients"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* RECIPIENT CHIPS LIST */}
      {emails.length > 0 ? (
        <div className="max-h-72 overflow-y-auto p-3 bg-snow/80 dark:bg-navy/30 border-2 border-navy dark:border-white/20 rounded-xl space-y-1.5 scrollbar-thin">
          {displayedEmails.length === 0 ? (
            <p className="text-center py-6 text-xs text-charcoal/50 dark:text-white/50">
              No emails matching your filter or search query.
            </p>
          ) : (
            displayedEmails.map((email, idx) => {
              const domain = email.split("@")[1] || "";
              const student = registeredMap[email];

              return (
                <div
                  key={email}
                  className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-navy rounded-lg border border-navy/20 dark:border-white/10 hover:border-navy dark:hover:border-white/30 transition-all text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-charcoal/40 dark:text-white/30 w-5 text-right shrink-0">
                      {idx + 1}.
                    </span>

                    <span className="font-mono font-bold text-navy dark:text-white truncate">
                      {email}
                    </span>

                    {/* Domain badge */}
                    <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-charcoal/5 dark:bg-white/10 text-charcoal/70 dark:text-white/60 rounded">
                      @{domain}
                    </span>

                    {/* Student profile tag if registered */}
                    {student && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        {student.name} ({student.level || "Student"})
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(email)}
                    disabled={disabled}
                    className="p-1 text-charcoal/40 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                    title={`Remove ${email}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="p-8 text-center border-2 border-dashed border-navy/30 dark:border-white/20 rounded-xl bg-white/40 dark:bg-navy/20 space-y-2">
          <Mail className="w-8 h-8 mx-auto text-charcoal/40 dark:text-white/40" />
          <p className="text-xs font-black uppercase text-navy dark:text-white">
            No recipient emails added yet
          </p>
          <p className="text-xs text-charcoal/60 dark:text-white/60 max-w-sm mx-auto">
            Click &quot;Paste / Import Emails&quot; above or type an email address to build your custom target audience.
          </p>
        </div>
      )}
    </div>
  );
}
