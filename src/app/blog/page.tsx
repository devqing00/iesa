"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getApiUrl } from "@/lib/api";

interface ArticlePublic {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  category: string;
  tags: string[];
  coverImageUrl?: string;
  authorName: string;
  authorProfilePicture?: string;
  viewCount: number;
  likeCount: number;
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

const CATEGORIES = [
  "all",
  "news",
  "feature",
  "opinion",
  "interview",
  "event_coverage",
  "academic",
  "campus_life",
  "tech",
  "sports",
];

export default function BlogPage() {
  const [articles, setArticles] = useState<ArticlePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeCategory !== "all") params.set("category", activeCategory);
      if (searchQuery) params.set("search", searchQuery);
      const qs = params.toString();
      const res = await fetch(getApiUrl(`/api/v1/press/published${qs ? `?${qs}` : ""}`));
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      }
    } catch {
      console.error("Failed to fetch articles");
    } finally {
      setLoading(false);
    }
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const featured = articles[0];
  const rest = articles.slice(1);

  return (
    <div className="min-h-screen bg-ghost text-navy overflow-x-hidden">
      {/* Diamond sparkle decorators */}
      <svg className="fixed top-20 left-[8%] w-6 h-6 text-lime/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed top-[40%] right-[12%] w-7 h-7 text-coral/15 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>
      <svg className="fixed bottom-[30%] left-[18%] w-5 h-5 text-lavender/20 pointer-events-none z-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0l1.5 7.5L21 9l-7.5 1.5L12 18l-1.5-7.5L3 9l7.5-1.5z" />
      </svg>

      <Header />

      <main className="pt-28 pb-20">
        {/* ── Hero ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="inline-flex items-center gap-2 bg-coral border-[3px] border-navy rounded-full px-3 py-1 mb-6">
            <span className="text-[10px] font-display font-black text-navy uppercase tracking-widest">Association Press</span>
          </div>
          <h1 className="font-display font-black text-[2.5rem] sm:text-[4rem] lg:text-[5rem] leading-[0.9] text-navy mb-4">
            <span className="brush-highlight">IESA Blog</span>
          </h1>
          <p className="text-lg text-slate max-w-2xl">
            Stories, features, and perspectives from the Industrial Engineering Students&apos; Association.
          </p>
        </section>

        {/* ── Search & Filter ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-snow border-[3px] border-navy rounded-2xl font-display text-sm text-navy placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-lime shadow-[3px_3px_0_0_#000]"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 text-[11px] font-display font-bold uppercase tracking-wider rounded-xl border-[2px] transition-all ${
 activeCategory === cat
 ?"bg-navy text-lime border-navy press-3 press-lime"
 :"bg-snow text-navy border-navy/20 hover:border-navy"
 }`}
              >
                {cat === "event_coverage" ? "Events" : cat === "campus_life" ? "Campus" : cat}
              </button>
            ))}
          </div>
        </section>

        {/* ── Content ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-snow border-[4px] border-navy/10 rounded-3xl p-6 animate-pulse">
                  <div className="h-40 bg-cloud rounded-2xl mb-4" />
                  <div className="h-4 bg-cloud rounded w-1/3 mb-3" />
                  <div className="h-6 bg-cloud rounded w-3/4 mb-2" />
                  <div className="h-4 bg-cloud rounded w-full" />
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="bg-snow border-[4px] border-navy rounded-3xl p-12 shadow-[3px_3px_0_0_#000] text-center">
              <svg className="w-16 h-16 text-slate/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h3 className="font-display font-black text-xl text-navy mb-2">No articles yet</h3>
              <p className="text-slate">Check back soon for stories from the press team.</p>
            </div>
          ) : (
            <>
              {/* Featured Article (first one) */}
              {featured && (
                <Link href={`/blog/${featured.slug}`} className="block mb-8 group">
                  <div className="bg-lime border-[6px] border-navy rounded-3xl overflow-hidden press-4 press-black transition-all rotate-[-0.5deg] hover:rotate-0">
                    <div className="grid grid-cols-1 lg:grid-cols-2">
                      {/* Cover image */}
                      <div className="relative h-64 lg:h-80">
                        {featured.coverImageUrl ? (
                          <Image
                            src={featured.coverImageUrl}
                            alt={featured.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-navy/10 flex items-center justify-center">
                            <svg className="w-20 h-20 text-navy/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {/* Content */}
                      <div className="p-8 lg:p-10 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider rounded-lg ${CATEGORY_COLORS[featured.category]?.bg || "bg-cloud"} ${CATEGORY_COLORS[featured.category]?.text || "text-navy"}`}>
                            {featured.category.replace("_", " ")}
                          </span>
                          <span className="text-[10px] font-bold text-navy/40 uppercase tracking-wider">Featured</span>
                        </div>
                        <h2 className="font-display font-black text-2xl lg:text-3xl text-navy mb-3 group-hover:text-navy/80 transition-colors leading-tight">
                          {featured.title}
                        </h2>
                        {featured.excerpt && (
                          <p className="text-navy/70 text-sm mb-4 line-clamp-3">{featured.excerpt}</p>
                        )}
                        <div className="flex items-center gap-3 mt-auto">
                          <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center overflow-hidden border-[2px] border-navy">
                            {featured.authorProfilePicture ? (
                              <Image src={featured.authorProfilePicture} alt="" width={32} height={32} className="object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-navy">{featured.authorName[0]}</span>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-display font-bold text-navy">{featured.authorName}</p>
                            <p className="text-[10px] text-slate">
                              {featured.publishedAt ? new Date(featured.publishedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" }) : ""}
                            </p>
                          </div>
                          <div className="ml-auto flex items-center gap-3 text-[10px] text-navy/40 font-bold">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" /></svg>
                              {featured.viewCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 01-.692 0l-.002-.001z" /></svg>
                              {featured.likeCount}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {/* Grid of remaining articles */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.map((article, idx) => {
                  const rotation = idx % 3 === 0 ? "rotate-[-0.5deg]" : idx % 3 === 1 ? "rotate-[0.5deg]" : "";
                  return (
                    <Link key={article._id} href={`/blog/${article.slug}`} className="block group">
                      <div className={`bg-snow border-[4px] border-navy rounded-3xl overflow-hidden press-4 press-black transition-all ${rotation} hover:rotate-0 h-full flex flex-col`}>
                        {/* Cover */}
                        <div className="relative h-44">
                          {article.coverImageUrl ? (
                            <Image src={article.coverImageUrl} alt={article.title} fill className="object-cover" />
                          ) : (
                            <div className={`w-full h-full ${CATEGORY_COLORS[article.category]?.bg || "bg-cloud"} flex items-center justify-center`}>
                              <svg className="w-12 h-12 text-navy/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {/* Body */}
                        <div className="p-5 flex flex-col flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider rounded-lg ${CATEGORY_COLORS[article.category]?.bg || "bg-cloud"} ${CATEGORY_COLORS[article.category]?.text || "text-navy"}`}>
                              {article.category.replace("_", " ")}
                            </span>
                          </div>
                          <h3 className="font-display font-black text-lg text-navy mb-2 leading-tight line-clamp-2 group-hover:text-navy/80 transition-colors">
                            {article.title}
                          </h3>
                          {article.excerpt && (
                            <p className="text-sm text-slate line-clamp-2 mb-3">{article.excerpt}</p>
                          )}
                          <div className="flex items-center gap-2 mt-auto pt-3 border-t border-cloud">
                            <div className="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center overflow-hidden border-[2px] border-navy">
                              {article.authorProfilePicture ? (
                                <Image src={article.authorProfilePicture} alt="" width={24} height={24} className="object-cover" />
                              ) : (
                                <span className="text-[8px] font-bold text-navy">{article.authorName[0]}</span>
                              )}
                            </div>
                            <span className="text-[10px] font-display font-bold text-navy">{article.authorName}</span>
                            <span className="text-[10px] text-slate ml-auto">
                              {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" }) : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
