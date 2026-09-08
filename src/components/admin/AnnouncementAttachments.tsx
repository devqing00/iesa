"use client";

import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { AnnouncementAttachment } from "@/lib/api/types";

interface AnnouncementAttachmentsProps {
  attachments: AnnouncementAttachment[];
  onChange: (attachments: AnnouncementAttachment[]) => void;
  className?: string;
}

export default function AnnouncementAttachments({
  attachments = [],
  onChange,
  className = "",
}: AnnouncementAttachmentsProps) {
  const { getAccessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Reset input
    e.target.value = "";

    const token = await getAccessToken();
    setUploading(true);

    let successCount = 0;
    const newAttachments = [...attachments];

    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`File "${file.name}" exceeds 15MB size limit.`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(getApiUrl("/api/v1/announcements/upload-media"), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }

        const data = await res.json();
        newAttachments.push({
          id: data.id || Math.random().toString(36).substring(2, 9),
          name: data.name || file.name,
          url: data.url,
          type: data.type || "document",
          size: data.size || file.size,
        });
        successCount++;
      } catch (err) {
        console.error(err);
        toast.error(`Failed to upload "${file.name}"`);
      }
    }

    setUploading(false);
    if (successCount > 0) {
      onChange(newAttachments);
      toast.success(`${successCount} file(s) attached successfully`);
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    onChange(attachments.filter((_, idx) => idx !== indexToRemove));
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  const getIcon = (type?: string) => {
    if (type === "image") {
      return (
        <div className="w-8 h-8 rounded-lg bg-teal-light text-teal flex items-center justify-center shrink-0 border border-teal/40">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      );
    }
    if (type === "pdf") {
      return (
        <div className="w-8 h-8 rounded-lg bg-coral-light text-coral flex items-center justify-center shrink-0 border border-coral/40">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-6-6H7zm7 1.5L18.5 8H14V3.5zM8 14h8v2H8v-2zm0-3h8v2H8v-2zm0 6h5v2H8v-2z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-lavender-light text-lavender flex items-center justify-center shrink-0 border border-lavender/40">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-navy flex items-center gap-2">
          <span>Attachments & Media</span>
          {attachments.length > 0 && (
            <span className="text-xs bg-navy text-snow px-2 py-0.5 rounded-full font-black">
              {attachments.length}
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-[2px] border-navy bg-snow text-xs font-bold text-navy hover:bg-lime/30 transition-colors press-2 press-navy disabled:opacity-50"
        >
          {uploading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-navy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Add File(s)</span>
            </>
          )}
        </button>
      </div>

      {attachments.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-navy/25 hover:border-navy rounded-2xl p-4 text-center cursor-pointer bg-ghost/50 hover:bg-ghost transition-all"
        >
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-navy/70">
            <svg className="w-4 h-4 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.373L8.557 18.315a1.5 1.5 0 11-2.122-2.122l7.694-7.693" />
            </svg>
            <span>Attach PDFs, images, slides, or documents (max 15MB each)</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((att, idx) => (
            <div
              key={att.id || idx}
              className="flex items-center justify-between gap-3 p-2.5 bg-snow border-2 border-navy rounded-xl shadow-[2px_2px_0_0_#000]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {getIcon(att.type)}
                <div className="min-w-0">
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-navy hover:underline truncate block"
                    title={att.name}
                  >
                    {att.name}
                  </a>
                  <span className="text-[10px] text-slate font-medium">
                    {formatSize(att.size)} {att.type ? `· ${att.type.toUpperCase()}` : ""}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-slate hover:text-navy hover:bg-ghost transition-colors"
                  title="Open attachment in new tab"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="p-1.5 rounded-lg text-coral hover:bg-coral-light transition-colors"
                  title="Remove attachment"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
