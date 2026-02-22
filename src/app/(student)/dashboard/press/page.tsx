"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

interface Article {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  category: string;
  status: string;
  viewCount: number;
  likeCount: number;
  feedback: { id: string; reviewerName: string; message: string; createdAt: string }[];
  publishedAt?: string;
  submittedAt?: string;
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

export default function PressDashboardPage() {
  const { user, getAccessToken } = useAuth();
  const toast = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [accessDenied, setAccessDenied] = useState(false);
  const [isHead, setIsHead] = useState(false);

  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const params = activeTab !== "all" ? `?status=${activeTab}` : "";
      const res = await fetch(getApiUrl(`/api/v1/press/my-articles${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setArticles(await res.json());
        setAccessDenied(false);
      } else if (res.status === 403) {
        setArticles([]);
        setAccessDenied(true);
      }

      // Check if user is press head (stats endpoint requires head permissions)
      const statsRes = await fetch(getApiUrl("/api/v1/press/stats/overview"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsHead(statsRes.ok);
    } catch {
      toast.error("Failed to load articles");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, activeTab, toast]);

  useEffect(() => {
    if (user) fetchArticles();
  }, [user, fetchArticles]);

  const handleSubmit = async (id: string) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/press/${id}/submit`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Article submitted for review!");
        fetchArticles();
      } else {
        const err = await res.json();
        toast.error(err.detail || "Submit failed");
      }
    } catch {
      toast.error("Failed to submit");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/press/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Article deleted");
        fetchArticles();
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const tabs = [
    { key: "all", label: "All" },
    { key: "draft", label: "Drafts" },
    { key: "submitted", label: "Submitted" },
    { key: "revision_requested", label: "Needs Revision" },
    { key: "published", label: "Published" },
  ];

  const stats = {
    total: articles.length,
    published: articles.filter((a) => a.status === "published").length,
    pending: articles.filter((a) => ["submitted", "in_review"].includes(a.status)).length,
    drafts: articles.filter((a) => a.status === "draft").length,
    needsRevision: articles.filter((a) => a.status === "revision_requested").length,
  };

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Association Press" />
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">

    {accessDenied ? (
      <div className="bg-snow border-[4px] border-navy rounded-3xl p-10 shadow-[4px_4px_0_0_#000] text-center max-w-lg mx-auto mt-8">
        <svg className="w-14 h-14 text-lavender/40 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6V7.5Z" />
        </svg>
        <h3 className="font-display font-black text-xl text-navy mb-2">Press Unit Access Required</h3>
        <p className="text-sm text-slate mb-5">You need to be enrolled in the Press unit to write and manage articles. Contact your department admin or press unit head to get access.</p>
        <Link
          href="/dashboard"
          className="inline-flex bg-lime border-[3px] border-navy px-6 py-2.5 rounded-xl font-display font-bold text-navy press-3 press-navy transition-all"
        >
          Back to Dashboard
        </Link>
      </div>
    ) : (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-3xl text-navy">Association Press</h1>
          <p className="text-sm text-slate mt-1">Write and manage your articles</p>
        </div>
        <div className="flex items-center gap-2">
          {isHead && (
            <Link
              href="/dashboard/press/review"
              className="inline-flex items-center gap-2 bg-lavender-light border-[3px] border-navy px-5 py-2.5 rounded-2xl font-display font-bold text-sm text-navy hover:bg-lavender transition-all"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-.673-.05A3 3 0 0 0 15 1.5h-1.5a3 3 0 0 0-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6ZM13.5 3A1.5 1.5 0 0 0 12 4.5h4.5A1.5 1.5 0 0 0 15 3h-1.5Z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 0 1 3 20.625V9.375Zm9.586 4.594a.75.75 0 0 0-1.172-.938l-2.476 3.096-.908-.907a.75.75 0 0 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.116-.062l3-3.75Z" clipRule="evenodd" />
              </svg>
              Review Dashboard
            </Link>
          )}
          <Link
            href="/dashboard/press/write"
          className="inline-flex items-center gap-2 bg-lime border-[4px] border-navy px-6 py-3 rounded-2xl font-display font-bold text-navy press-3 press-navy transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Article
        </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "bg-snow" },
          { label: "Published", value: stats.published, color: "bg-lime-light" },
          { label: "Pending", value: stats.pending, color: "bg-sunny-light" },
          { label: "Drafts", value: stats.drafts, color: "bg-cloud" },
          { label: "Needs Revision", value: stats.needsRevision, color: "bg-coral-light" },
        ].map((s) => (
          <div key={s.label} className={`${s.color} border-[3px] border-navy rounded-2xl p-3 shadow-[3px_3px_0_0_#000]`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-navy/50">{s.label}</p>
            <p className="font-display font-black text-2xl text-navy">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 text-[11px] font-display font-bold uppercase tracking-wider rounded-xl border-[2px] transition-all ${
              activeTab === tab.key
                ? "bg-navy text-lime border-navy shadow-[3px_3px_0_0_#C8F31D]"
                : "bg-snow text-navy border-navy/20 hover:border-navy"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Articles list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-snow border-[3px] border-navy/10 rounded-2xl p-5 animate-pulse">
              <div className="h-5 bg-cloud rounded w-1/3 mb-3" />
              <div className="h-4 bg-cloud rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-10 shadow-[4px_4px_0_0_#000] text-center">
          <svg className="w-14 h-14 text-slate/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          <h3 className="font-display font-black text-xl text-navy mb-2">No articles yet</h3>
          <p className="text-slate mb-5">Start writing your first article for the IESA blog.</p>
          <Link
            href="/dashboard/press/write"
            className="inline-flex bg-lime border-[3px] border-navy px-6 py-2.5 rounded-xl font-display font-bold text-navy press-3 press-navy transition-all"
          >
            Write Article
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => {
            const st = STATUS_STYLES[article.status] || STATUS_STYLES.draft;
            const hasFeedback = article.feedback && article.feedback.length > 0;
            const latestFeedback = hasFeedback ? article.feedback[article.feedback.length - 1] : null;

            return (
              <div
                key={article._id}
                className="bg-snow border-[3px] border-navy rounded-2xl p-5 press-3 press-black transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider rounded-lg ${st.bg} ${st.text}`}>
                        {st.label}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate">{article.category.replace("_", " ")}</span>
                    </div>
                    <Link href={`/dashboard/press/${article._id}`} className="font-display font-black text-lg text-navy hover:text-navy/70 transition-colors block leading-tight">
                      {article.title}
                    </Link>
                    {article.excerpt && (
                      <p className="text-xs text-slate mt-1 line-clamp-1">{article.excerpt}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate">
                      <span>Updated {new Date(article.updatedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}</span>
                      {article.status === "published" && (
                        <>
                          <span className="flex items-center gap-0.5">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" /></svg>
                            {article.viewCount}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 01-.692 0l-.002-.001z" /></svg>
                            {article.likeCount}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Latest feedback banner */}
                    {article.status === "revision_requested" && latestFeedback && (
                      <div className="mt-3 bg-coral-light border-[2px] border-coral rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-coral mb-1">Feedback from {latestFeedback.reviewerName}</p>
                        <p className="text-xs text-navy/80 line-clamp-2">{latestFeedback.message}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {(article.status === "draft" || article.status === "revision_requested") && (
                      <>
                        <Link
                          href={`/dashboard/press/write?edit=${article._id}`}
                          className="px-3 py-1.5 bg-snow border-[2px] border-navy rounded-xl text-xs font-display font-bold text-navy hover:bg-ghost transition-all"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleSubmit(article._id)}
                          className="px-3 py-1.5 bg-lime border-[2px] border-navy rounded-xl text-xs font-display font-bold text-navy hover:bg-lime-dark transition-all"
                        >
                          Submit
                        </button>
                      </>
                    )}
                    {article.status === "published" && (
                      <Link
                        href={`/blog/${article.slug}`}
                        target="_blank"
                        className="px-3 py-1.5 bg-teal-light border-[2px] border-navy rounded-xl text-xs font-display font-bold text-navy hover:bg-teal transition-all"
                      >
                        View Live
                      </Link>
                    )}
                    {(article.status === "draft" || article.status === "rejected") && (
                      <button
                        onClick={() => handleDelete(article._id)}
                        className="px-3 py-1.5 bg-snow border-[2px] border-coral rounded-xl text-xs font-display font-bold text-coral hover:bg-coral-light transition-all"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    )}
    </div>
    </div>
  );
}
