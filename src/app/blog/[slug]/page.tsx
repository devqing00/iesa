"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface ArticleFull {
  _id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  category: string;
  tags: string[];
  coverImageUrl?: string;
  authorName: string;
  authorProfilePicture?: string;
  viewCount: number;
  likeCount: number;
  likedBy?: string[];
  publishedAt?: string;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  news: { bg: "bg-lime-light", text: "text-navy" },
  feature: { bg: "bg-lavender-light", text: "text-navy" },
  opinion: { bg: "bg-coral-light", text: "text-navy" },
  interview: { bg: "bg-teal-light", text: "text-navy" },
  event_coverage: { bg: "bg-sunny-light", text: "text-navy" },
  academic: { bg: "bg-lime-light", text: "text-navy" },
  campus_life: { bg: "bg-coral-light", text: "text-navy" },
  tech: { bg: "bg-lavender-light", text: "text-navy" },
  sports: { bg: "bg-teal-light", text: "text-navy" },
  other: { bg: "bg-cloud", text: "text-navy" },
};

export default function BlogArticlePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { user, getAccessToken } = useAuth();

  const [article, setArticle] = useState<ArticleFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const fetchArticle = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(getApiUrl(`/api/v1/press/published/${slug}`));
      if (res.ok) {
        const data = await res.json();
        setArticle(data);
        setLikeCount(data.likeCount || 0);
        if (user && data.likedBy?.includes(user.id)) {
          setLiked(true);
        }
      }
    } catch {
      console.error("Failed to fetch article");
    } finally {
      setLoading(false);
    }
  }, [slug, user]);

  useEffect(() => {
    if (slug) fetchArticle();
  }, [slug, fetchArticle]);

  const handleLike = async () => {
    if (!user || !article) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/press/${article._id}/like`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikeCount(data.likeCount);
      }
    } catch {
      toast.error("Failed to toggle like");
    }
  };

  return (
    <div className="min-h-screen bg-ghost text-navy overflow-x-hidden">
      {/* Sparkle decorators */}
      <svg className="fixed top-24 left-[6%] w-5 h-5 text-lime/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-[50%] right-[8%] w-6 h-6 text-coral/12 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>

      <Header />

      <main className="pt-28 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-display font-bold text-navy/60 hover:text-navy transition-colors mb-8">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </Link>

          {loading ? (
            <div className="animate-pulse">
              <div className="h-6 bg-cloud rounded w-24 mb-4" />
              <div className="h-12 bg-cloud rounded w-3/4 mb-6" />
              <div className="h-64 bg-cloud rounded-3xl mb-8" />
              <div className="space-y-3">
                <div className="h-4 bg-cloud rounded w-full" />
                <div className="h-4 bg-cloud rounded w-5/6" />
                <div className="h-4 bg-cloud rounded w-4/5" />
              </div>
            </div>
          ) : !article ? (
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-12 shadow-[3px_3px_0_0_#000] text-center">
              <h2 className="font-display font-black text-2xl text-navy mb-2">Article not found</h2>
              <p className="text-slate mb-6">This article may have been removed or the link is incorrect.</p>
              <Link href="/blog" className="bg-lime border-[3px] border-navy px-6 py-2.5 rounded-xl font-display font-bold text-navy press-3 press-navy transition-all">
                Browse Articles
              </Link>
            </div>
          ) : (
            <>
              {/* Category & Meta */}
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-3 py-1 text-[10px] font-display font-bold uppercase tracking-wider rounded-xl ${CATEGORY_COLORS[article.category]?.bg || "bg-cloud"} ${CATEGORY_COLORS[article.category]?.text || "text-navy"}`}>
                  {article.category.replace("_", " ")}
                </span>
                <span className="text-xs text-slate">
                  {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("en-NG", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : ""}
                </span>
              </div>

              {/* Title */}
              <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-navy mb-6 leading-[1.05]">
                {article.title}
              </h1>

              {/* Author bar */}
              <div className="flex items-center gap-3 mb-8 pb-6 border-b-[3px] border-cloud">
                <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center overflow-hidden border-[3px] border-navy">
                  {article.authorProfilePicture ? (
                    <Image src={article.authorProfilePicture} alt="" width={40} height={40} className="object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-navy">{article.authorName[0]}</span>
                  )}
                </div>
                <div>
                  <p className="font-display font-bold text-sm text-navy">{article.authorName}</p>
                  <p className="text-[10px] text-slate">IESA Press</p>
                </div>
                <div className="ml-auto flex items-center gap-4 text-xs text-slate">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" /></svg>
                    {article.viewCount} views
                  </span>
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-1 transition-colors ${liked ? "text-coral font-bold" : "hover:text-coral"}`}
                  >
                    <svg className="w-4 h-4" fill={liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {likeCount}
                  </button>
                </div>
              </div>

              {/* Cover Image */}
              {article.coverImageUrl && (
                <div className="relative h-64 sm:h-80 lg:h-96 mb-10 rounded-3xl overflow-hidden border-[4px] border-navy shadow-[3px_3px_0_0_#000]">
                  <Image src={article.coverImageUrl} alt={article.title} fill className="object-cover" />
                </div>
              )}

              {/* Article body */}
              <article
                className="prose prose-lg max-w-none leading-relaxed font-normal text-navy/90
                  [&_h2]:font-display [&_h2]:font-black [&_h2]:text-navy [&_h2]:mt-10 [&_h2]:mb-4
                  [&_h3]:font-display [&_h3]:font-bold [&_h3]:text-navy [&_h3]:mt-8 [&_h3]:mb-3
                  [&_p]:mb-4
                  [&_a]:text-lavender [&_a]:font-bold [&_a]:underline [&_a]:decoration-2
                  [&_blockquote]:border-l-[4px] [&_blockquote]:border-lime [&_blockquote]:pl-6 [&_blockquote]:italic [&_blockquote]:text-navy/70
                  [&_img]:rounded-2xl [&_img]:border-[3px] [&_img]:border-navy
                  [&_ul]:list-disc [&_ul]:pl-6
                  [&_ol]:list-decimal [&_ol]:pl-6
                  [&_code]:bg-ghost [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-lg [&_code]:text-sm [&_code]:font-mono
                "
                dangerouslySetInnerHTML={{ __html: article.content }}
              />

              {/* Tags */}
              {article.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t-[3px] border-cloud">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate mr-2 self-center">Tags:</span>
                  {article.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1 bg-ghost border-[2px] border-navy/15 rounded-xl text-xs font-display font-bold text-navy/70">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Back to blog CTA */}
              <div className="mt-12 text-center">
                <Link href="/blog" className="inline-flex bg-navy border-[4px] border-lime px-8 py-3 rounded-2xl font-display font-bold text-lime press-4 press-lime transition-all">
                  More Articles
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
