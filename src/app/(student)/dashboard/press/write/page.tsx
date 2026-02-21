"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import RichTextEditor from "@/components/ui/RichTextEditor";

const CATEGORIES = [
  { value: "news", label: "News" },
  { value: "feature", label: "Feature" },
  { value: "opinion", label: "Opinion" },
  { value: "interview", label: "Interview" },
  { value: "event_coverage", label: "Event Coverage" },
  { value: "academic", label: "Academic" },
  { value: "campus_life", label: "Campus Life" },
  { value: "tech", label: "Tech" },
  { value: "sports", label: "Sports" },
  { value: "other", label: "Other" },
];

export default function WriteArticlePage() {
  const { user, getAccessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("news");
  const [tags, setTags] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  const fetchArticle = useCallback(async () => {
    if (!editId) return;
    try {
      setLoading(true);
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/press/${editId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTitle(data.title);
        setContent(data.content);
        setExcerpt(data.excerpt || "");
        setCategory(data.category);
        setTags((data.tags || []).join(", "));
        setCoverImageUrl(data.coverImageUrl || "");
      } else {
        toast.error("Failed to load article");
        router.push("/dashboard/press");
      }
    } catch {
      toast.error("Error loading article");
    } finally {
      setLoading(false);
    }
  }, [editId, getAccessToken, router, toast]);

  useEffect(() => {
    if (user && editId) fetchArticle();
  }, [user, editId, fetchArticle]);

  const handleSave = async (andSubmit = false) => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }

    try {
      if (andSubmit) setSubmitting(true);
      else setSaving(true);

      const token = await getAccessToken();
      const payload = {
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim() || null,
        category,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        coverImageUrl: coverImageUrl.trim() || null,
      };

      let articleId = editId;

      if (editId) {
        // Update existing
        const res = await fetch(getApiUrl(`/api/v1/press/${editId}`), {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to update");
        }
      } else {
        // Create new
        const res = await fetch(getApiUrl("/api/v1/press/"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to create");
        }
        const data = await res.json();
        articleId = data._id;
      }

      if (andSubmit && articleId) {
        const submitRes = await fetch(getApiUrl(`/api/v1/press/${articleId}/submit`), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!submitRes.ok) {
          const err = await submitRes.json();
          throw new Error(err.detail || "Submit failed");
        }
        toast.success("Article submitted for review!");
      } else {
        toast.success(editId ? "Article updated!" : "Draft saved!");
      }

      router.push("/dashboard/press");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ghost">
        <DashboardHeader title="Write Article" />
        <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-cloud rounded w-1/3" />
            <div className="h-12 bg-cloud rounded" />
            <div className="h-64 bg-cloud rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title={editId ? "Edit Article" : "Write Article"} />
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/press" className="inline-flex items-center gap-1 text-xs font-display font-bold text-slate hover:text-navy transition-colors mb-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Press
          </Link>
          <h1 className="font-display font-black text-2xl text-navy">{editId ? "Edit Article" : "Write New Article"}</h1>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate mb-1.5">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Your article title..."
            className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-2xl font-display font-bold text-lg text-navy placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-lime shadow-[4px_4px_0_0_#000]"
          />
        </div>

        {/* Excerpt */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate mb-1.5">Excerpt (optional)</label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="A short summary that appears on the blog cards..."
            rows={2}
            className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-2xl font-display text-sm text-navy placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-lime shadow-[4px_4px_0_0_#000] resize-none"
          />
        </div>

        {/* Category + Tags row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-2xl font-display font-bold text-sm text-navy focus:outline-none focus:ring-2 focus:ring-lime shadow-[4px_4px_0_0_#000] appearance-none cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate mb-1.5">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. engineering, campus, UI"
              className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-2xl font-display text-sm text-navy placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-lime shadow-[4px_4px_0_0_#000]"
            />
          </div>
        </div>

        {/* Cover Image URL */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate mb-1.5">Cover Image URL (optional)</label>
          <input
            type="url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-4 py-3 bg-snow border-[3px] border-navy rounded-2xl font-display text-sm text-navy placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-lime shadow-[4px_4px_0_0_#000]"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate mb-1.5">Content *</label>
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Start writing your article..."
          />
          <p className="text-[10px] text-slate mt-1.5">Use the toolbar to format text, add headings, lists, links, images, and more.</p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t-[3px] border-cloud">
          <button
            onClick={() => handleSave(false)}
            disabled={saving || submitting}
            className="px-6 py-3 bg-snow border-[3px] border-navy rounded-2xl font-display font-bold text-navy shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save as Draft"}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || submitting}
            className="px-6 py-3 bg-lime border-[4px] border-navy rounded-2xl font-display font-bold text-navy shadow-[5px_5px_0_0_#0F0F2D] hover:shadow-[3px_3px_0_0_#0F0F2D] hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Save & Submit for Review"}
          </button>
          <Link
            href="/dashboard/press"
            className="px-6 py-3 bg-transparent border-[3px] border-navy/20 rounded-2xl font-display font-bold text-slate text-center hover:border-navy hover:text-navy transition-all"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}
