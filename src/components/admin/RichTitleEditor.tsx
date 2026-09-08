"use client";

import React, { useRef } from "react";
import { PersonalizationTag } from "@/components/ui/RichTextEditor";

interface RichTitleEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  availableVariables?: PersonalizationTag[];
  className?: string;
}

export default function RichTitleEditor({
  value,
  onChange,
  error,
  placeholder = "Announcement title...",
  availableVariables = [
    { tag: "{{first_name}}", label: "First Name", desc: "e.g. Alex" },
    { tag: "{{student_name}}", label: "Full Name", desc: "e.g. Alex Adetayo" },
    { tag: "{{level}}", label: "Level", desc: "e.g. 400L" },
    { tag: "{{matric_no}}", label: "Matric No", desc: "e.g. 219800" },
    { tag: "{{department}}", label: "Department", desc: "Industrial Engineering" },
  ],
  className = "",
}: RichTitleEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const insertTag = (tag: string) => {
    const input = inputRef.current;
    if (!input) {
      onChange(value ? `${value} ${tag}` : tag);
      return;
    }

    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const nextValue = value.slice(0, start) + tag + value.slice(end);
    onChange(nextValue);

    // Re-focus and set cursor position after inserted tag
    setTimeout(() => {
      input.focus();
      const newPos = start + tag.length;
      input.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Check if title uses any personalization variables
  const detectedTags = availableVariables.filter((v) => {
    const tag = v.tag || v.value || "";
    return tag && value.includes(tag);
  });

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-4 py-3 rounded-2xl bg-ghost border-[3px] text-navy font-bold text-base placeholder:text-slate/60 focus:outline-none transition-all ${
            error ? "border-coral" : "border-navy focus:border-navy"
          }`}
          maxLength={300}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          <span className="text-[11px] font-mono font-bold text-slate/60">
            {value.length}/300
          </span>
        </div>
      </div>

      {/* Quick Insert Variable Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate shrink-0">
          Insert Tag:
        </span>
        {availableVariables.map((v, idx) => {
          const tagValue = v.tag || v.value || "";
          const desc = v.desc || v.description || tagValue;
          return (
            <button
              key={tagValue || idx}
              type="button"
              onClick={() => insertTag(tagValue)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-navy bg-snow border-[2px] border-navy/20 hover:border-navy hover:bg-lime/20 transition-all cursor-pointer press-1 press-navy"
              title={`Insert ${v.label} (${desc})`}
            >
              <span className="text-navy font-mono text-[11px]">{tagValue}</span>
              <span className="text-slate text-[10px]">({v.label})</span>
            </button>
          );
        })}
      </div>

      {/* Detected Tags Resolution Hint */}
      {detectedTags.length > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-lime/20 border border-lime/60 text-[11px] text-navy">
          <svg className="w-3.5 h-3.5 text-navy shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
          </svg>
          <span>
            Personalized title detected:{" "}
            <strong>{detectedTags.map((t) => t.label).join(", ")}</strong> will auto-fill for each student!
          </span>
        </div>
      )}

      {error && <p className="text-xs text-coral font-bold">{error}</p>}
    </div>
  );
}
