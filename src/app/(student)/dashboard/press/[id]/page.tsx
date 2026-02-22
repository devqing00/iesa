"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

interface FeedbackItem {
  id: string;
  reviewerId: string;
  reviewerName: string;
  message: string;
  createdAt: string;
}

interface ArticleDetail {
  _id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  category: string;
  tags: string[];
  coverImageUrl?: string;
  authorId: string;
  authorName: string;
  status: string;
  feedback: FeedbackItem[];
  viewCount: number;
  likeCount: number;
  publishedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-cloud", text: "text-slate", label: "Draft" },
  submitted: { bg: "bg-sunny-light", text: "text-navy", label: "Submitted" },
  in_review: { bg: "bg-lavender-light", text: "text-navy", label: "In Review" },
  revision_requested: { bg: "bg-coral-light", text: "text-navy", label: "Needs Revision" },
  approved: { bg: "bg-teal-light", text: "text-navy", label: "Approved" },
  published: { bg: "bg-lime-light", text: "text-navy", label: "Published" },
  rejected: { bg: "bg-coral", text: "text-snow", label: "Rejected" },
  archived: { bg: "bg-navy-muted", text: "text-snow", label: "Archived" },
};

export default function ArticleDetailPage() {
  const params = useParams();
  const articleId = params?.id as string;
  const { user, getAccessToken } = useAuth();
  const toast = useToast();

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchArticle = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/press/${articleId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setArticle(await res.json());
      } else {
        toast.error("Failed to load article");
      }
    } catch {
      toast.error("Error loading article");
    } finally {
      setLoading(false);
    }
  }, [articleId, getAccessToken, toast]);

  useEffect(() => {
    if (user && articleId) fetchArticle();
  }, [user, articleId, fetchArticle]);

  const handleSubmit = async () => {
    if (!article) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/press/${article._id}/submit`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Article submitted for review!");
        fetchArticle();
      } else {
        const err = await res.json();
        toast.error(err.detail || "Submit failed");
      }
    } catch {
      toast.error("Failed to submit");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ghost">
        <DashboardHeader title="Article" />
        <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          <div className="space-y-4 animate-pulse">
            <div className="h-6 bg-cloud rounded w-1/4" />
            <div className="h-10 bg-cloud rounded w-3/4" />
            <div className="h-64 bg-cloud rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-ghost">
        <DashboardHeader title="Article" />
        <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          <div className="bg-snow border-[4px] border-navy rounded-3xl p-10 shadow-[4px_4px_0_0_#000] text-center">
            <h3 className="font-display font-black text-xl text-navy mb-2">Article not found</h3>
            <Link href="/dashboard/press" className="text-sm font-display font-bold text-lavender hover:text-navy transition-colors">
              Back to Press
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const st = STATUS_STYLES[article.status] || STATUS_STYLES.draft;
  const isAuthor = user?.id === article.authorId;
  const canEdit = isAuthor && (article.status === "draft" || article.status === "revision_requested");
  const canSubmit = isAuthor && (article.status === "draft" || article.status === "revision_requested");

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Article Detail" />
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
    <div className="space-y-6 max-w-4xl">
      {/* Back + Status */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/press" className="inline-flex items-center gap-1 text-xs font-display font-bold text-slate hover:text-navy transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Press
        </Link>
        <span className={`px-3 py-1 text-[10px] font-display font-bold uppercase tracking-wider rounded-xl ${st.bg} ${st.text}`}>
          {st.label}
        </span>
      </div>

      {/* Title & Meta */}
      <div>
        <h1 className="font-display font-black text-3xl text-navy mb-2 leading-tight">{article.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate">
          <span>By {article.authorName}</span>
          <span>Category: {article.category.replace("_", " ")}</span>
          <span>Created: {new Date(article.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}</span>
          {article.publishedAt && <span>Published: {new Date(article.publishedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}</span>}
        </div>
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {article.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-ghost border border-navy/10 rounded-lg text-[10px] font-bold text-navy/60">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Link
            href={`/dashboard/press/write?edit=${article._id}`}
            className="px-4 py-2 bg-snow border-[3px] border-navy rounded-xl font-display font-bold text-sm text-navy press-3 press-black transition-all"
          >
            Edit Article
          </Link>
        )}
        {canSubmit && (
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-lime border-[3px] border-navy rounded-xl font-display font-bold text-sm text-navy press-3 press-navy transition-all"
          >
            Submit for Review
          </button>
        )}
        {article.status === "published" && (
          <Link
            href={`/blog/${article.slug}`}
            target="_blank"
            className="px-4 py-2 bg-teal-light border-[3px] border-navy rounded-xl font-display font-bold text-sm text-navy press-3 press-black transition-all"
          >
            View Live
          </Link>
        )}
      </div>

      {/* Preview */}
      <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 sm:p-8 shadow-[4px_4px_0_0_#000]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate mb-4">Article Preview</p>
        {article.excerpt && (
          <p className="text-sm text-navy/70 italic mb-4 pb-4 border-b border-cloud">{article.excerpt}</p>
        )}
        <article
          className="prose max-w-none text-navy/90 leading-relaxed
            [&_h2]:font-display [&_h2]:font-black [&_h2]:text-navy [&_h2]:mt-8 [&_h2]:mb-3
            [&_h3]:font-display [&_h3]:font-bold [&_h3]:text-navy
            [&_p]:mb-3 [&_a]:text-lavender [&_a]:font-bold
            [&_blockquote]:border-l-[3px] [&_blockquote]:border-lime [&_blockquote]:pl-4 [&_blockquote]:italic
            [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
          "
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </div>

      {/* Feedback Thread */}
      {article.feedback.length > 0 && (
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[4px_4px_0_0_#000]">
          <h2 className="font-display font-black text-lg text-navy mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-coral" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
            </svg>
            Reviewer Feedback ({article.feedback.length})
          </h2>
          <div className="space-y-3">
            {article.feedback.map((fb, idx) => (
              <div key={fb.id || idx} className="bg-ghost border-[2px] border-navy/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-display font-bold text-navy">{fb.reviewerName}</span>
                  <span className="text-[10px] text-slate">
                    {new Date(fb.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm text-navy/80 leading-relaxed">{fb.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats (if published) */}
      {article.status === "published" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-lime-light border-[3px] border-navy rounded-2xl p-4 shadow-[3px_3px_0_0_#000]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-navy/50">Views</p>
            <p className="font-display font-black text-3xl text-navy">{article.viewCount}</p>
          </div>
          <div className="bg-coral-light border-[3px] border-navy rounded-2xl p-4 shadow-[3px_3px_0_0_#000]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-navy/50">Likes</p>
            <p className="font-display font-black text-3xl text-navy">{article.likeCount}</p>
          </div>
        </div>
      )}
    </div>
    </div>
    </div>
  );
}
