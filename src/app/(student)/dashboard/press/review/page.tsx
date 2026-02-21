"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

interface FeedbackItem {
  id: string;
  reviewerName: string;
  message: string;
  createdAt: string;
}

interface Article {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  category: string;
  status: string;
  authorName: string;
  authorProfilePicture?: string;
  feedback: FeedbackItem[];
  viewCount: number;
  likeCount: number;
  publishedAt?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface PressStats {
  statusCounts: Record<string, number>;
  totalPublished: number;
  totalDrafts: number;
  pendingReview: number;
  totalViews: number;
  totalLikes: number;
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

export default function PressReviewPage() {
  const { user, getAccessToken } = useAuth();
  const toast = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState<PressStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"queue" | "all" | "published" | "approved">("queue");
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();

      // Fetch stats
      const statsRes = await fetch(getApiUrl("/api/v1/press/stats/overview"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statsRes.ok) {
        setStats(await statsRes.json());
      } else if (statsRes.status === 403) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      // Fetch articles based on view
      let url = "/api/v1/press/review-queue";
      if (activeView === "all") url = "/api/v1/press/all";
      else if (activeView === "published") url = "/api/v1/press/all?status=published";
      else if (activeView === "approved") url = "/api/v1/press/all?status=approved";

      const res = await fetch(getApiUrl(url), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setArticles(await res.json());
        setAccessDenied(false);
      } else if (res.status === 403) {
        setArticles([]);
        setAccessDenied(true);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, activeView, toast]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleAction = async (articleId: string, action: string, body?: object) => {
    try {
      setActionLoading(articleId);
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/press/${articleId}/${action}`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Action completed");
        setFeedbackText((prev) => ({ ...prev, [articleId]: "" }));
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.detail || "Action failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setActionLoading(null);
    }
  };

  const views = [
    { key: "queue" as const, label: "Review Queue", count: stats?.pendingReview },
    { key: "approved" as const, label: "Approved", count: stats?.statusCounts?.approved },
    { key: "published" as const, label: "Published", count: stats?.totalPublished },
    { key: "all" as const, label: "All Articles" },
  ];

  return (
    <div className="min-h-screen bg-ghost">
      <DashboardHeader title="Press Review" />
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">

    {accessDenied ? (
      <div className="bg-snow border-[4px] border-navy rounded-3xl p-10 shadow-[6px_6px_0_0_#000] text-center max-w-lg mx-auto mt-8">
        <svg className="w-14 h-14 text-coral/40 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        <h3 className="font-display font-black text-xl text-navy mb-2">Press Head Access Required</h3>
        <p className="text-sm text-slate mb-5">You need press review permissions to access this page. Contact your department admin if you believe this is an error.</p>
        <Link
          href="/dashboard/press"
          className="inline-flex bg-lime border-[3px] border-navy px-6 py-2.5 rounded-xl font-display font-bold text-navy shadow-[4px_4px_0_0_#0F0F2D] hover:shadow-[2px_2px_0_0_#0F0F2D] transition-all"
        >
          Back to Press
        </Link>
      </div>
    ) : (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display font-black text-3xl text-navy">Press Review</h1>
        <p className="text-sm text-slate mt-1">Review, approve, and manage press articles</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Pending Review", value: stats.pendingReview, color: "bg-sunny-light" },
            { label: "Approved", value: stats.statusCounts?.approved || 0, color: "bg-teal-light" },
            { label: "Published", value: stats.totalPublished, color: "bg-lime-light" },
            { label: "Total Views", value: stats.totalViews, color: "bg-lavender-light" },
            { label: "Total Likes", value: stats.totalLikes, color: "bg-coral-light" },
          ].map((s) => (
            <div key={s.label} className={`${s.color} border-[3px] border-navy rounded-2xl p-3 shadow-[4px_4px_0_0_#000]`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-navy/50">{s.label}</p>
              <p className="font-display font-black text-2xl text-navy">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* View Tabs */}
      <div className="flex flex-wrap gap-2">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setActiveView(v.key)}
            className={`px-4 py-1.5 text-[11px] font-display font-bold uppercase tracking-wider rounded-xl border-[2px] transition-all ${
              activeView === v.key
                ? "bg-navy text-lime border-navy shadow-[3px_3px_0_0_#C8F31D]"
                : "bg-snow text-navy border-navy/20 hover:border-navy"
            }`}
          >
            {v.label} {v.count != null ? `(${v.count})` : ""}
          </button>
        ))}
      </div>

      {/* Articles */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-snow border-[3px] border-navy/10 rounded-2xl p-6 animate-pulse">
              <div className="h-5 bg-cloud rounded w-1/3 mb-3" />
              <div className="h-4 bg-cloud rounded w-2/3 mb-2" />
              <div className="h-4 bg-cloud rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-snow border-[4px] border-navy rounded-3xl p-10 shadow-[6px_6px_0_0_#000] text-center">
          <svg className="w-14 h-14 text-slate/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
          </svg>
          <h3 className="font-display font-black text-xl text-navy mb-2">
            {activeView === "queue" ? "No articles awaiting review" : "No articles found"}
          </h3>
          <p className="text-slate">
            {activeView === "queue" ? "All caught up! Check back later." : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => {
            const st = STATUS_STYLES[article.status] || STATUS_STYLES.draft;
            const isInQueue = ["submitted", "in_review"].includes(article.status);
            const isApproved = article.status === "approved";
            const isPublished = article.status === "published";
            const fb = feedbackText[article._id] || "";

            return (
              <div key={article._id} className="bg-snow border-[4px] border-navy rounded-3xl p-6 shadow-[6px_6px_0_0_#000]">
                {/* Title row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider rounded-lg ${st.bg} ${st.text}`}>
                        {st.label}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate">{article.category.replace("_", " ")}</span>
                    </div>
                    <Link href={`/dashboard/press/${article._id}`} className="font-display font-black text-xl text-navy hover:text-navy/70 transition-colors block leading-tight">
                      {article.title}
                    </Link>
                    <p className="text-xs text-slate mt-1">
                      By <span className="font-bold">{article.authorName}</span>
                      {article.submittedAt && ` · Submitted ${new Date(article.submittedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}`}
                    </p>
                    {article.excerpt && (
                      <p className="text-sm text-navy/60 mt-2 line-clamp-2">{article.excerpt}</p>
                    )}
                  </div>
                </div>

                {/* Review Actions */}
                {isInQueue && (
                  <div className="mt-4 pt-4 border-t-[2px] border-cloud space-y-3">
                    {/* Quick actions */}
                    <div className="flex flex-wrap gap-2">
                      {article.status === "submitted" && (
                        <button
                          onClick={() => handleAction(article._id, "start-review")}
                          disabled={actionLoading === article._id}
                          className="px-4 py-2 bg-lavender-light border-[2px] border-navy rounded-xl text-xs font-display font-bold text-navy hover:bg-lavender transition-all disabled:opacity-50"
                        >
                          Start Review
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(article._id, "approve")}
                        disabled={actionLoading === article._id}
                        className="px-4 py-2 bg-teal border-[2px] border-navy rounded-xl text-xs font-display font-bold text-navy hover:bg-teal/80 transition-all disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <Link
                        href={`/dashboard/press/${article._id}`}
                        className="px-4 py-2 bg-snow border-[2px] border-navy rounded-xl text-xs font-display font-bold text-navy hover:bg-ghost transition-all"
                      >
                        Read Full Article
                      </Link>
                    </div>

                    {/* Feedback input for revision / rejection */}
                    <div className="bg-ghost rounded-2xl p-4 border-[2px] border-navy/10">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate mb-2">Send feedback to author</p>
                      <textarea
                        value={fb}
                        onChange={(e) => setFeedbackText((prev) => ({ ...prev, [article._id]: e.target.value }))}
                        placeholder="Write feedback or revision notes..."
                        rows={2}
                        className="w-full px-3 py-2 bg-snow border-[2px] border-navy/20 rounded-xl text-sm text-navy placeholder:text-slate/50 focus:outline-none focus:border-navy resize-none mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (!fb.trim()) { toast.error("Please write feedback first"); return; }
                            handleAction(article._id, "request-revision", { message: fb });
                          }}
                          disabled={actionLoading === article._id || !fb.trim()}
                          className="px-3 py-1.5 bg-sunny border-[2px] border-navy rounded-xl text-xs font-display font-bold text-navy hover:bg-sunny/80 transition-all disabled:opacity-50"
                        >
                          Request Revision
                        </button>
                        <button
                          onClick={() => {
                            if (!fb.trim()) { toast.error("Please provide a reason"); return; }
                            handleAction(article._id, "reject", { message: fb });
                          }}
                          disabled={actionLoading === article._id || !fb.trim()}
                          className="px-3 py-1.5 bg-coral border-[2px] border-navy rounded-xl text-xs font-display font-bold text-snow hover:bg-coral/80 transition-all disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => {
                            if (!fb.trim()) { toast.error("Please write feedback"); return; }
                            handleAction(article._id, "feedback", { message: fb });
                          }}
                          disabled={actionLoading === article._id || !fb.trim()}
                          className="px-3 py-1.5 bg-snow border-[2px] border-navy/30 rounded-xl text-xs font-display font-bold text-navy hover:border-navy transition-all disabled:opacity-50"
                        >
                          Add Comment
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Approved actions */}
                {isApproved && (
                  <div className="mt-4 pt-4 border-t-[2px] border-cloud flex flex-wrap gap-2">
                    <button
                      onClick={() => handleAction(article._id, "publish")}
                      disabled={actionLoading === article._id}
                      className="px-4 py-2 bg-lime border-[3px] border-navy rounded-xl text-xs font-display font-bold text-navy shadow-[3px_3px_0_0_#0F0F2D] hover:shadow-[1px_1px_0_0_#0F0F2D] transition-all disabled:opacity-50"
                    >
                      Publish to Blog
                    </button>
                    <button
                      onClick={() => handleAction(article._id, "archive")}
                      disabled={actionLoading === article._id}
                      className="px-4 py-2 bg-snow border-[2px] border-navy/30 rounded-xl text-xs font-display font-bold text-slate hover:text-navy hover:border-navy transition-all disabled:opacity-50"
                    >
                      Archive
                    </button>
                  </div>
                )}

                {/* Published actions */}
                {isPublished && (
                  <div className="mt-4 pt-4 border-t-[2px] border-cloud flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-slate">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" /></svg>
                        {article.viewCount} views
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 01-.692 0l-.002-.001z" /></svg>
                        {article.likeCount} likes
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/blog/${article.slug}`}
                        target="_blank"
                        className="px-3 py-1.5 bg-teal-light border-[2px] border-navy rounded-xl text-xs font-display font-bold text-navy hover:bg-teal transition-all"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleAction(article._id, "unpublish")}
                        disabled={actionLoading === article._id}
                        className="px-3 py-1.5 bg-snow border-[2px] border-navy/30 rounded-xl text-xs font-display font-bold text-slate hover:text-navy hover:border-navy transition-all disabled:opacity-50"
                      >
                        Unpublish
                      </button>
                      <button
                        onClick={() => handleAction(article._id, "archive")}
                        disabled={actionLoading === article._id}
                        className="px-3 py-1.5 bg-snow border-[2px] border-coral/50 rounded-xl text-xs font-display font-bold text-coral hover:bg-coral-light transition-all disabled:opacity-50"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                )}

                {/* Previous feedback */}
                {article.feedback.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate mb-2">Previous Feedback ({article.feedback.length})</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {article.feedback.slice(-3).map((fb, idx) => (
                        <div key={fb.id || idx} className="bg-ghost border border-navy/5 rounded-xl p-2.5 text-xs">
                          <span className="font-bold text-navy">{fb.reviewerName}</span>
                          <span className="text-slate ml-2">{new Date(fb.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}</span>
                          <p className="text-navy/70 mt-1">{fb.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
