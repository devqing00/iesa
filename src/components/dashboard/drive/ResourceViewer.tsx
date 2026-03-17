"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "sonner";
import {
  type FileMetaResponse,
  type FileBookmark,
  getDriveStreamUrl,
  saveDriveProgress,
  createDriveBookmark,
  deleteDriveBookmark,
  formatFileSize,
  formatSeconds,
  getFileTypeColor,
  getFileTypeLabel,
} from "@/lib/api/drive";
import { useAuth } from "@/context/AuthContext";
import { getCachedFile, cacheFile, evictCachedFile } from "@/lib/driveCache";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ── Icons ──────────────────────────────────────────────────

function BackIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  );
}

function BookmarkIcon({ filled = false, className = "w-5 h-5" }: { filled?: boolean; className?: string }) {
  if (filled) {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function EllipsisVerticalIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronLeftIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRightIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function ZoomInIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
    </svg>
  );
}

function ZoomOutIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM13.5 10.5h-6" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
    </svg>
  );
}

// ── PDF Viewer (react-pdf based — real page tracking) ───────

interface PDFViewerProps {
  fileId: string;
  meta: FileMetaResponse;
  token: string | null;
  onProgressUpdate: (page: number, total: number) => void;
}

type CacheStatus = "checking" | "cached" | "downloading" | "ready";

function PDFViewer({ fileId, meta, token, onProgressUpdate }: PDFViewerProps) {
  const { getAccessToken } = useAuth();
  const initialPage = meta.progress?.currentPage || 1;
  const [currentPage, setCurrentPage] = useState(meta.progress?.currentPage || 1);
  const [totalPages, setTotalPages] = useState(meta.progress?.totalPages || 0);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<"width" | "actual">("width");
  const [pageWidth, setPageWidth] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>("checking");
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Refs for scroll-on-resume logic — must not be reactive state
  const initialPageRef = useRef(initialPage);
  const scrolledToInitialRef = useRef(initialPage <= 1); // no scroll needed if already at p1
  const currentPageRef = useRef(currentPage);
  const urlToRevokeRef = useRef<string | null>(null);
  const hasRetriedAfterEmptyRef = useRef(false);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  const streamUrl = getDriveStreamUrl(fileId);
  const streamSrc = `${streamUrl}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

  // Cache-aware file loader:
  // 1. Check IndexedDB — if HIT, create object URL immediately (instant load)
  // 2. If MISS, fetch with auth token, store in IDB, then create object URL
  useEffect(() => {
    let cancelled = false;
    hasRetriedAfterEmptyRef.current = false;
    setCacheStatus("checking");
    setPdfUrl(null);
    setPdfLoading(true);
    setPdfError(null);

    (async () => {
      // 1 — try cache
      const cached = await getCachedFile(fileId);
      if (cached && !cancelled) {
        if (cached.size === 0) {
          await evictCachedFile(fileId);
        } else {
          const url = URL.createObjectURL(cached);
          urlToRevokeRef.current = url;
          setPdfUrl(url);
          setCacheStatus("cached");
          return;
        }
      }

      if (cancelled) return;

      // 2 — stream immediately (faster first paint), skip blocking full-blob download
      setCacheStatus("ready");
      try {
        const authToken = token || await getAccessToken();
        if (cancelled) return;
        setPdfUrl(`${streamUrl}${authToken ? `?token=${encodeURIComponent(authToken)}` : ""}`);
      } catch {
        if (!cancelled) {
          setPdfLoading(false);
          setPdfError("Failed to load PDF. Check your connection or open in Google Drive.");
          setCacheStatus("ready");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (urlToRevokeRef.current) {
        URL.revokeObjectURL(urlToRevokeRef.current);
        urlToRevokeRef.current = null;
      }
    };
  }, [fileId, streamUrl, streamSrc, token, getAccessToken]);

  const fetchPdfBlobFallback = useCallback(async (): Promise<boolean> => {
    try {
      const accessToken = token || await getAccessToken();
      const res = await fetch(streamUrl, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return false;
      const blob = await res.blob();
      if (!blob || blob.size === 0) return false;
      await cacheFile(fileId, blob, meta.name, meta.mimeType || "application/pdf");
      if (urlToRevokeRef.current) {
        URL.revokeObjectURL(urlToRevokeRef.current);
      }
      const blobUrl = URL.createObjectURL(blob);
      urlToRevokeRef.current = blobUrl;
      setPdfUrl(blobUrl);
      setPdfLoading(true);
      setPdfError(null);
      setCacheStatus("cached");
      return true;
    } catch (error) {
      console.warn("[ResourceViewer] PDF fallback fetch failed", error);
      return false;
    }
  }, [fileId, getAccessToken, meta.mimeType, meta.name, streamUrl, token]);

  const handleDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setTotalPages(numPages);
    setPdfLoading(false);
    setPdfError(null);
    const startPage = initialPageRef.current;
    onProgressUpdate(startPage, numPages);
    // Scroll to the saved page after the page divs are in the DOM
    if (startPage > 1) {
      setTimeout(() => {
        const el = pageRefs.current.get(startPage);
        if (el) {
          el.scrollIntoView({ behavior: "auto", block: "start" });
        }
        scrolledToInitialRef.current = true;
      }, 150);
    } else {
      scrolledToInitialRef.current = true;
    }
  }, [onProgressUpdate]);

  const handleDocumentLoadError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err || "");
    const isEmptyPdf = message.toLowerCase().includes("empty") || message.toLowerCase().includes("zerobytes") || message.toLowerCase().includes("zero bytes");

    if (isEmptyPdf && !hasRetriedAfterEmptyRef.current) {
      hasRetriedAfterEmptyRef.current = true;
      setPdfLoading(true);
      setPdfError(null);
      setCacheStatus("downloading");
      void (async () => {
        await evictCachedFile(fileId);
        const recovered = await fetchPdfBlobFallback();
        if (!recovered) {
          setPdfLoading(false);
          setPdfError("Failed to load PDF. The file appears empty right now. Please retry.");
          setCacheStatus("ready");
        }
      })();
      return;
    }

    setPdfLoading(false);
    setPdfError("Failed to load PDF. The file may be too large or inaccessible.");
  }, [fetchPdfBlobFallback, fileId]);

  // Navigate to a specific page by scrolling to it
  const goToPage = useCallback((page: number) => {
    const p = Math.max(1, Math.min(page, totalPages || 1));
    setCurrentPage(p);
    currentPageRef.current = p;
    if (totalPages > 0) onProgressUpdate(p, totalPages);
    const el = pageRefs.current.get(p);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [totalPages, onProgressUpdate]);

  const resolveCurrentPageFromScroll = useCallback(() => {
    if (totalPages === 0 || !containerRef.current || !scrolledToInitialRef.current) return;
    const container = containerRef.current;
    const mountedPages = Array.from(pageRefs.current.entries())
      .sort((a, b) => a[0] - b[0]);
    if (mountedPages.length === 0) return;

    const target = container.scrollTop + container.clientHeight * 0.35;
    let bestPage = mountedPages[0][0];

    for (const [pageNum, el] of mountedPages) {
      if (el.offsetTop <= target) {
        bestPage = pageNum;
      } else {
        break;
      }
    }

    if (bestPage !== currentPageRef.current) {
      currentPageRef.current = bestPage;
      setCurrentPage(bestPage);
      onProgressUpdate(bestPage, totalPages);
    }
  }, [onProgressUpdate, totalPages]);

  // Track current page via scroll using measured page offsets (robust to rerenders/zoom).
  useEffect(() => {
    if (totalPages === 0 || !containerRef.current) return;
    const container = containerRef.current;

    let rafId: number | null = null;

    const handleScroll = () => {
      if (!scrolledToInitialRef.current) return;
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        resolveCurrentPageFromScroll();
      });
    };

    const initTimer = setTimeout(resolveCurrentPageFromScroll, 250);
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearTimeout(initTimer);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [totalPages, resolveCurrentPageFromScroll]);

  // Re-evaluate page indicator after zoom/layout changes.
  useEffect(() => {
    if (totalPages === 0) return;
    const timer = setTimeout(resolveCurrentPageFromScroll, 350);
    return () => clearTimeout(timer);
  }, [zoom, totalPages, resolveCurrentPageFromScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncWidth = () => {
      const containerWidth = Math.max(280, container.clientWidth - 20);
      setPageWidth(containerWidth);
    };

    syncWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(syncWidth);
      observer.observe(container);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", syncWidth);
    return () => window.removeEventListener("resize", syncWidth);
  }, []);

  // Register page ref callback
  const setPageRef = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      pageRefs.current.set(pageNum, el);
    } else {
      pageRefs.current.delete(pageNum);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Controls bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-snow border-b-2 border-navy">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous page"
            className="w-7 h-7 rounded-lg bg-ghost flex items-center justify-center disabled:opacity-30 hover:bg-cloud transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 text-sm">
            <input
              type="number"
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="w-12 text-center bg-ghost border border-cloud rounded-lg py-0.5 text-sm text-navy focus:outline-none focus:ring-1 focus:ring-lime"
              min={1}
              max={totalPages || undefined}
              title="Current page"
              placeholder="Page"
            />
            <span className="text-slate">/</span>
            <span className="text-sm text-navy font-medium">{totalPages || "..."}</span>
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={totalPages > 0 && currentPage >= totalPages}
            title="Next page"
            className="w-7 h-7 rounded-lg bg-ghost flex items-center justify-center disabled:opacity-30 hover:bg-cloud transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Cache status badge */}
        {cacheStatus === "cached" && (
          <span className="text-label-sm text-teal bg-teal-light px-1.5 py-0.5 rounded font-bold uppercase tracking-wide hidden sm:inline">
            Cached
          </span>
        )}

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setFitMode((prev) => (prev === "width" ? "actual" : "width"));
              setZoom(1);
            }}
            title={fitMode === "width" ? "Switch to actual size" : "Switch to fit width"}
            className="px-2.5 h-7 rounded-lg bg-ghost flex items-center justify-center hover:bg-cloud text-[9px] font-bold text-navy"
          >
            {fitMode === "width" ? "Fit" : "Cover"}
          </button>
          <button
            onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
            title="Zoom out"
            className="w-7 h-7 rounded-lg bg-ghost flex items-center justify-center hover:bg-cloud"
          >
            <ZoomOutIcon className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
            title="Zoom in"
            className="w-7 h-7 rounded-lg bg-ghost flex items-center justify-center hover:bg-cloud"
          >
            <ZoomInIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF content area */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-navy-light touch-pan-x touch-pan-y">
        {(cacheStatus === "checking" || cacheStatus === "downloading" || pdfLoading) && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-lime border-t-transparent mx-auto" />
              <p className="text-snow text-sm">
                {cacheStatus === "checking" && "Checking cache..."}
                {cacheStatus === "downloading" && "Preparing PDF..."}
                {(cacheStatus === "cached" || cacheStatus === "ready") && pdfLoading && "Rendering PDF..."}
              </p>
            </div>
          </div>
        )}

        {pdfError && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3 max-w-sm">
              <p className="text-coral font-medium">{pdfError}</p>
              <a
                href={`https://drive.google.com/file/d/${fileId}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-lime border-[3px] border-navy rounded-xl font-display font-bold text-sm text-navy press-3 press-navy"
              >
                Open in Google Drive <ExternalLinkIcon className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        {pdfUrl && (
          <Document
            file={pdfUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={null}
          >
            <div className="inline-flex flex-col items-center gap-2 py-4 min-w-full">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <div
                  key={pageNum}
                  ref={(el) => setPageRef(pageNum, el)}
                  data-page-number={pageNum}
                  className="shadow-lg"
                >
                  <Page
                    pageNumber={pageNum}
                    width={fitMode === "width" ? (pageWidth || undefined) : undefined}
                    scale={zoom}
                    renderTextLayer
                    renderAnnotationLayer
                    loading={
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-lime border-t-transparent" />
                      </div>
                    }
                  />
                </div>
              ))}
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}

// ── Video Player ─────────────────────────────────────────────

interface VideoPlayerProps {
  fileId: string;
  meta: FileMetaResponse;
  token: string | null;
  onProgressUpdate: (currentTime: number, duration: number) => void;
}

function VideoPlayer({ fileId, meta, token, onProgressUpdate }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamUrl = getDriveStreamUrl(fileId);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Resume from progress
    if (meta.progress?.currentTime) {
      video.currentTime = meta.progress.currentTime;
    }

    // Track progress every 10 seconds
    progressTimerRef.current = setInterval(() => {
      if (video && !video.paused && video.duration > 0) {
        onProgressUpdate(video.currentTime, video.duration);
      }
    }, 10000);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [meta.progress?.currentTime, onProgressUpdate]);

  // Save progress on pause
  const handlePause = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration > 0) {
      onProgressUpdate(video.currentTime, video.duration);
    }
  }, [onProgressUpdate]);

  return (
    <div className="flex items-center justify-center h-full bg-navy">
      <video
        ref={videoRef}
        src={`${streamUrl}${token ? `?token=${encodeURIComponent(token)}` : ""}`}
        controls
        className="max-w-full max-h-full"
        onPause={handlePause}
        onEnded={handlePause}
        preload="metadata"
        crossOrigin="use-credentials"
      >
        Your browser doesn&apos;t support video playback.
      </video>
    </div>
  );
}

// ── Image Viewer ─────────────────────────────────────────────

function ImageViewer({ fileId, meta, token }: { fileId: string; meta: FileMetaResponse; token: string | null }) {
  const { getAccessToken } = useAuth();
  const streamUrl = getDriveStreamUrl(fileId);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pinchStateRef = useRef<{ startDistance: number; startZoom: number } | null>(null);
  const panStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const clampOffset = useCallback((nextOffset: { x: number; y: number }, nextZoom: number = zoom) => {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image || !loaded) return nextOffset;

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    const imageW = image.clientWidth * nextZoom;
    const imageH = image.clientHeight * nextZoom;

    const maxX = Math.max(0, (imageW - containerW) / 2);
    const maxY = Math.max(0, (imageH - containerH) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, nextOffset.x)),
      y: Math.max(-maxY, Math.min(maxY, nextOffset.y)),
    };
  }, [zoom, loaded]);

  const clampZoom = useCallback((value: number) => Math.max(1, Math.min(4, value)), []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => {
      const nextZoom = clampZoom(prev + 0.25);
      setOffset((prevOffset) => clampOffset(prevOffset, nextZoom));
      return nextZoom;
    });
  }, [clampZoom, clampOffset]);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const nextZoom = clampZoom(prev - 0.25);
      setOffset((prevOffset) => clampOffset(prevOffset, nextZoom));
      return nextZoom;
    });
  }, [clampZoom, clampOffset]);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const zoomAtPoint = useCallback((targetZoom: number, clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;

    const nextZoom = clampZoom(targetZoom);
    if (nextZoom === zoom) return;

    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const imageSpaceX = (clientX - centerX - offset.x) / zoom;
    const imageSpaceY = (clientY - centerY - offset.y) / zoom;

    const rawOffset = {
      x: clientX - centerX - imageSpaceX * nextZoom,
      y: clientY - centerY - imageSpaceY * nextZoom,
    };

    setZoom(nextZoom);
    setOffset(clampOffset(rawOffset, nextZoom));
  }, [zoom, offset, clampZoom, clampOffset]);

  const toggleZoomAtPoint = useCallback((clientX: number, clientY: number) => {
    const nextZoom = zoom > 1 ? 1 : 2;
    if (nextZoom === 1) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    zoomAtPoint(nextZoom, clientX, clientY);
  }, [zoom, zoomAtPoint]);

  const touchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const distance = touchDistance(event.touches);
      if (!distance) return;
      pinchStateRef.current = { startDistance: distance, startZoom: zoom };
      panStateRef.current = null;
      return;
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const now = Date.now();
      const lastTap = lastTapRef.current;
      const isQuickDoubleTap = !!lastTap && now - lastTap.time < 300;
      const isNearLastTap = !!lastTap && Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) < 24;

      if (isQuickDoubleTap && isNearLastTap) {
        toggleZoomAtPoint(touch.clientX, touch.clientY);
        lastTapRef.current = null;
        return;
      }

      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };

      if (zoom > 1) {
        panStateRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          originX: offset.x,
          originY: offset.y,
        };
      }
    }
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2 && pinchStateRef.current) {
      const currentDistance = touchDistance(event.touches);
      if (!currentDistance) return;
      const ratio = currentDistance / pinchStateRef.current.startDistance;
      const nextZoom = clampZoom(pinchStateRef.current.startZoom * ratio);
      setZoom(nextZoom);
      setOffset((prevOffset) => clampOffset(prevOffset, nextZoom));
      return;
    }

    if (event.touches.length === 1 && panStateRef.current && zoom > 1) {
      const dx = event.touches[0].clientX - panStateRef.current.startX;
      const dy = event.touches[0].clientY - panStateRef.current.startY;
      setOffset(clampOffset({
        x: panStateRef.current.originX + dx,
        y: panStateRef.current.originY + dy,
      }));
    }
  };

  const handleTouchEnd = () => {
    pinchStateRef.current = null;
    panStateRef.current = null;
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    event.preventDefault();
    panStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!panStateRef.current || zoom <= 1) return;
    const dx = event.clientX - panStateRef.current.startX;
    const dy = event.clientY - panStateRef.current.startY;
    setOffset(clampOffset({
      x: panStateRef.current.originX + dx,
      y: panStateRef.current.originY + dy,
    }));
  };

  const handleMouseUp = () => {
    panStateRef.current = null;
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    toggleZoomAtPoint(event.clientX, event.clientY);
  };

  useEffect(() => {
    if (zoom <= 1) {
      setOffset({ x: 0, y: 0 });
      panStateRef.current = null;
    }
  }, [zoom]);

  useEffect(() => {
    if (!loaded) return;

    const relimit = () => {
      setOffset((prevOffset) => clampOffset(prevOffset, zoom));
    };

    relimit();
    window.addEventListener("resize", relimit);
    return () => window.removeEventListener("resize", relimit);
  }, [loaded, zoom, clampOffset]);

  useEffect(() => {
    let cancelled = false;
    let objectUrlToRevoke: string | null = null;

    setLoaded(false);
    setError(null);
    setImageUrl(null);

    (async () => {
      try {
        const cached = await getCachedFile(fileId);
        if (cached && !cancelled) {
          objectUrlToRevoke = URL.createObjectURL(cached);
          setImageUrl(objectUrlToRevoke);
          return;
        }

        const accessToken = token || await getAccessToken();
        if (cancelled) return;

        const res = await fetch(streamUrl, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const blob = await res.blob();
        if (cancelled) return;

        cacheFile(fileId, blob, meta.name, meta.mimeType).catch((error) => {
          console.warn("[ResourceViewer] Failed to cache image", error);
        });
        objectUrlToRevoke = URL.createObjectURL(blob);
        setImageUrl(objectUrlToRevoke);
      } catch {
        if (!cancelled) setError("Failed to load image. Please try again or open in Drive.");
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    };
  }, [fileId, streamUrl, token, getAccessToken, meta.name, meta.mimeType]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center h-full bg-navy-light p-4 overflow-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      style={{ touchAction: "none" }}
    >
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-snow/95 border-2 border-navy rounded-xl px-2 py-1.5">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 1}
          title="Zoom out"
          className="w-7 h-7 rounded-lg bg-ghost border border-navy/20 flex items-center justify-center disabled:opacity-40"
        >
          <ZoomOutIcon className="w-4 h-4 text-navy" />
        </button>
        <span className="text-xs font-bold text-navy min-w-11 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 4}
          title="Zoom in"
          className="w-7 h-7 rounded-lg bg-ghost border border-navy/20 flex items-center justify-center disabled:opacity-40"
        >
          <ZoomInIcon className="w-4 h-4 text-navy" />
        </button>
        <button
          onClick={handleZoomReset}
          title="Reset zoom"
          className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-lime border border-navy rounded-md text-navy"
        >
          Reset
        </button>
      </div>

      {!loaded && !error && meta.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.thumbnailUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 m-auto max-w-full max-h-full object-contain opacity-70 blur-[1px]"
        />
      )}

      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-[3px] border-lime border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-coral font-medium">{error}</p>
          <a
            href={`https://drive.google.com/file/d/${fileId}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-lime border-[3px] border-navy rounded-xl font-display font-bold text-sm text-navy press-3 press-navy"
          >
            Open in Google Drive <ExternalLinkIcon className="w-4 h-4" />
          </a>
        </div>
      )}

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imageRef}
          src={imageUrl}
          alt={meta.name}
          className={`max-w-full max-h-full object-contain rounded-lg transition-opacity duration-200 select-none ${loaded ? "opacity-100" : "opacity-0"} ${zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "center center" }}
          draggable={false}
          onLoad={() => {
            setLoaded(true);
            setOffset({ x: 0, y: 0 });
          }}
        />
      )}
    </div>
  );
}

// ── Embed Viewer (Google Docs/Sheets/Slides/Office) ──────────

function resolveEmbedSrc(meta: FileMetaResponse): string | null {
  if (meta.embedUrl) return meta.embedUrl;
  if (!meta.webViewLink) return null;

  const officeMimeTypes = [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];

  if (officeMimeTypes.includes(meta.mimeType)) {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(meta.webViewLink)}`;
  }

  return null;
}

function EmbedViewer({ meta }: { meta: FileMetaResponse }) {
  const embedSrc = resolveEmbedSrc(meta);
  if (!embedSrc) return null;
  return (
    <div className="flex-1 h-full">
      <iframe
        src={embedSrc}
        className="w-full h-full border-0"
        title={meta.name}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        loading="lazy"
      />
    </div>
  );
}

// ── Bookmark Panel ──────────────────────────────────────────

interface BookmarkPanelProps {
  bookmarks: FileBookmark[];
  fileId: string;
  fileName: string;
  onJumpTo: (bookmark: FileBookmark) => void;
  onDelete: (bookmarkId: string) => void;
  onAdd: (page?: number, timestamp?: number, label?: string) => void;
  currentPage?: number;
  currentTime?: number;
}

function BookmarkPanel({ bookmarks, onJumpTo, onDelete, onAdd, currentPage, currentTime }: Omit<BookmarkPanelProps, 'fileId' | 'fileName'>) {
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");

  const handleAdd = () => {
    onAdd(currentPage, currentTime, label || undefined);
    setLabel("");
    setShowAdd(false);
  };

  return (
    <div className="bg-snow border-t-2 border-navy p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-display font-black text-navy text-sm flex items-center gap-1.5">
          <BookmarkIcon filled className="w-4 h-4 text-coral" />
          Bookmarks ({bookmarks.length})
        </h4>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs bg-lime border-2 border-navy rounded-lg px-2 py-1 press-1 press-navy font-bold text-navy"
          title="Add bookmark"
        >
          + Add
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={currentPage ? `Page ${currentPage}` : currentTime ? `${formatSeconds(currentTime)}` : "Label..."}
            className="flex-1 bg-ghost border border-cloud rounded-lg px-2 py-1 text-sm text-navy focus:outline-none focus:ring-1 focus:ring-lime"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button onClick={handleAdd} className="text-xs bg-teal text-snow rounded-lg px-3 py-1 font-bold press-1 press-navy">
            Save
          </button>
        </div>
      )}

      {/* Bookmark list */}
      {bookmarks.length === 0 ? (
        <p className="text-xs text-slate">No bookmarks yet. Add one to mark your place!</p>
      ) : (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {bookmarks.map((bm) => (
            <div key={bm._id} className="flex items-center justify-between group">
              <button
                onClick={() => onJumpTo(bm)}
                className="text-xs text-navy hover:text-lime-dark transition-colors text-left flex-1 truncate"
              >
                {bm.label}
              </button>
              <button
                onClick={() => onDelete(bm._id)}
                title="Delete bookmark"
                className="opacity-0 group-hover:opacity-100 text-coral hover:text-coral transition-opacity ml-2"
              >
                <TrashIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ResourceViewer ──────────────────────────────────────

export interface ResourceViewerProps {
  meta: FileMetaResponse;
  loading: boolean;
  onClose: () => void;
  token: string | null;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

export default function ResourceViewer({
  meta,
  loading,
  onClose,
  token,
  hasPrev = false,
  hasNext = false,
  onPrev,
  onNext,
}: ResourceViewerProps) {
  const { getAccessToken } = useAuth();
  const [resolvedToken, setResolvedToken] = useState<string | null>(token || null);
  const [bookmarks, setBookmarks] = useState<FileBookmark[]>(meta?.bookmarks || []);
  const [currentPage, setCurrentPage] = useState(meta?.progress?.currentPage || 1);
  const [currentTime, setCurrentTime] = useState(meta?.progress?.currentTime || 0);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [bookmarkPanelOpen, setBookmarkPanelOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // No need to sync from meta — parent uses key={meta.id} to remount when file changes

  // Debounced progress save
  const saveProgress = useCallback((updates: Record<string, unknown>) => {
    if (!meta) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveDriveProgress({
        fileId: meta.id,
        fileName: meta.name,
        fileMimeType: meta.mimeType,
        ...updates,
      }).catch((error) => {
        console.warn("[ResourceViewer] Failed to save progress", error);
      });
    }, 2000);
  }, [meta]);

  // Save initial "opened" progress
  useEffect(() => {
    let cancelled = false;
    if (token) {
      setResolvedToken(token);
      return;
    }

    (async () => {
      try {
        const accessToken = await getAccessToken();
        if (!cancelled) setResolvedToken(accessToken || null);
      } catch (error) {
        console.warn("[ResourceViewer] Failed to resolve access token", error);
        if (!cancelled) setResolvedToken(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, getAccessToken, meta?.id]);

  useEffect(() => {
    setShowActionMenu(false);
  }, [meta?.id]);

  useEffect(() => {
    setBookmarkPanelOpen(false);
  }, [meta?.id]);

  useEffect(() => {
    if (!meta) return;
    saveDriveProgress({
      fileId: meta.id,
      fileName: meta.name,
      fileMimeType: meta.mimeType,
    }).catch((error) => {
      console.warn("[ResourceViewer] Initial progress save failed", error);
    });
  }, [meta]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingTarget =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        !!target?.isContentEditable;

      if (isTypingTarget) return;

      if (event.key === "ArrowLeft" && hasPrev && onPrev) {
        event.preventDefault();
        onPrev();
      }

      if (event.key === "ArrowRight" && hasNext && onNext) {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasPrev, hasNext, onPrev, onNext]);

  const handlePdfProgress = useCallback((page: number, total: number) => {
    setCurrentPage(page);
    saveProgress({ currentPage: page, totalPages: total });
  }, [saveProgress]);

  const handleVideoProgress = useCallback((time: number, duration: number) => {
    setCurrentTime(time);
    saveProgress({ currentTime: time, totalDuration: duration });
  }, [saveProgress]);

  const handleAddBookmark = useCallback(async (page?: number, timestamp?: number, label?: string) => {
    if (!meta) return;
    try {
      const result = await createDriveBookmark({
        fileId: meta.id,
        fileName: meta.name,
        page,
        timestamp,
        label,
      });
      setBookmarks((prev) => [
        ...prev,
        {
          _id: result.bookmarkId,
          fileId: meta.id,
          fileName: meta.name,
          page,
          timestamp,
          label: label || (page ? `Page ${page}` : timestamp ? `${formatSeconds(timestamp)}` : "Bookmark"),
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.warn("[ResourceViewer] Failed to add bookmark", error);
      toast.error("Could not add bookmark right now.");
    }
  }, [meta]);

  const handleDeleteBookmark = useCallback(async (bookmarkId: string) => {
    if (!meta) return;
    try {
      await deleteDriveBookmark(meta.id, bookmarkId);
      setBookmarks((prev) => prev.filter((b) => b._id !== bookmarkId));
    } catch (error) {
      console.warn("[ResourceViewer] Failed to delete bookmark", error);
      toast.error("Could not remove bookmark right now.");
    }
  }, [meta]);

  const handleJumpTo = useCallback((bm: FileBookmark) => {
    if (bm.page) {
      setCurrentPage(bm.page);
      // Can't directly control Google's PDF viewer; update page counter
    }
    // For videos, we'd need a ref to the player
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-snow flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-lime border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!meta) return null;

  const colors = getFileTypeColor(meta.fileType);
  const typeLabel = getFileTypeLabel(meta.fileType);

  // Determine viewer type
  const isVideo = meta.fileType === "video";
  const isPDF = meta.fileType === "pdf";
  const isImage = meta.fileType === "image";
  const isEmbed = !!resolveEmbedSrc(meta);
  const canPreview = isPDF || isVideo || isImage || isEmbed;
  const showBookmarkPanel = isPDF || isEmbed;
  const canDirectDownload = !meta.mimeType.startsWith("application/vnd.google-apps.");

  const handleDownload = async () => {
    if (!canDirectDownload) return;
    try {
      const accessToken = await getAccessToken();
      const streamUrl = getDriveStreamUrl(meta.id);
      const res = await fetch(`${streamUrl}?download=1`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      if (!blob || blob.size === 0) throw new Error("Empty download");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setShowActionMenu(false);
    } catch {
      toast.error("Download failed. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-snow flex flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-3 bg-snow border-b-[3px] border-navy shrink-0">
        <button
          onClick={onClose}
          className="shrink-0 w-9 h-9 rounded-xl bg-ghost border-2 border-navy flex items-center justify-center press-2 press-navy"
          title="Close viewer"
        >
          <BackIcon className="w-4 h-4 text-navy" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-black text-navy text-sm truncate">{meta.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-label-sm ${colors.text} px-1.5 py-0.5 rounded ${colors.bg}`}>
              {typeLabel}
            </span>
            {meta.size && (
              <span className="text-xs text-slate">{formatFileSize(meta.size)}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <button
            onClick={onPrev}
            disabled={!hasPrev || !onPrev}
            className="w-9 h-9 rounded-xl bg-ghost border-2 border-navy flex items-center justify-center press-2 press-navy disabled:opacity-40 disabled:cursor-not-allowed"
            title="Previous resource (←)"
          >
            <ChevronLeftIcon className="w-4 h-4 text-navy" />
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext || !onNext}
            className="w-9 h-9 rounded-xl bg-ghost border-2 border-navy flex items-center justify-center press-2 press-navy disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next resource (→)"
          >
            <ChevronRightIcon className="w-4 h-4 text-navy" />
          </button>
        </div>
        <div className="hidden lg:flex shrink-0 items-center gap-2">
          {canDirectDownload && (
            <button
              onClick={handleDownload}
              className="text-xs border-2 rounded-lg px-3 py-1.5 font-bold flex items-center gap-1 bg-lime text-navy border-navy press-2 press-navy"
              title="Download file"
            >
              <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v10.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 1 1 1.06-1.06l2.72 2.72V3a.75.75 0 0 1 .75-.75Zm-8.25 12a.75.75 0 0 1 .75.75v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3a.75.75 0 0 1 1.5 0v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
              </svg>
              Download
            </button>
          )}

          {meta.webViewLink && (
            <a
              href={meta.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-navy text-lime border-2 border-lime rounded-lg px-3 py-1.5 press-2 press-lime font-bold flex items-center gap-1"
            >
              <ExternalLinkIcon className="w-3.5 h-3.5" />
              Drive
            </a>
          )}
        </div>

        <div className="lg:hidden relative shrink-0">
          <button
            onClick={() => setShowActionMenu((prev) => !prev)}
            className="w-9 h-9 rounded-xl bg-ghost border-2 border-navy flex items-center justify-center press-2 press-navy"
            title="More actions"
            aria-label="More actions"
          >
            <EllipsisVerticalIcon className="w-4 h-4 text-navy" />
          </button>

          {showActionMenu && (
            <div className="absolute right-0 mt-2 w-44 rounded-2xl border-[3px] border-navy bg-snow shadow-[3px_3px_0_0_#000] p-2 z-30">
              {canDirectDownload && (
                <button
                  onClick={handleDownload}
                  className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl bg-lime text-navy border-2 border-navy font-bold text-xs"
                >
                  <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v10.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 1 1 1.06-1.06l2.72 2.72V3a.75.75 0 0 1 .75-.75Zm-8.25 12a.75.75 0 0 1 .75.75v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3a.75.75 0 0 1 1.5 0v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                  </svg>
                  Download
                </button>
              )}

              {meta.webViewLink && (
                <a
                  href={meta.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowActionMenu(false)}
                  className="mt-2 w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl bg-navy text-lime border-2 border-lime font-bold text-xs"
                >
                  <ExternalLinkIcon className="w-4 h-4" />
                  Open in Drive
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Viewer area */}
      <div className="flex-1 overflow-hidden relative">
        {isPDF && (
          <PDFViewer
            fileId={meta.id}
            meta={meta}
            token={resolvedToken}
            onProgressUpdate={handlePdfProgress}
          />
        )}
        {isVideo && (
          <VideoPlayer
            fileId={meta.id}
            meta={meta}
            token={resolvedToken}
            onProgressUpdate={handleVideoProgress}
          />
        )}
        {isImage && <ImageViewer fileId={meta.id} meta={meta} token={resolvedToken} />}
        {isEmbed && !isPDF && !isVideo && !isImage && <EmbedViewer meta={meta} />}

        {!canPreview && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${colors.bg}`}>
              <svg aria-hidden="true" className={`w-10 h-10 ${colors.text}`} viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" clipRule="evenodd" />
                <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="font-display font-black text-navy text-lg mb-1">Preview not available</h3>
              <p className="text-slate text-sm mb-4">This file type can&apos;t be previewed in-app.</p>
              {meta.webViewLink && (
                <a
                  href={meta.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-lime border-[3px] border-navy rounded-xl px-6 py-3 press-4 press-navy font-display font-black text-navy text-sm"
                >
                  <ExternalLinkIcon className="w-4 h-4" />
                  Open in Google Drive
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bookmark toggle + panel */}
      {showBookmarkPanel && (
        <div className="shrink-0">
          <div className="bg-snow border-t-2 border-navy px-3 py-1.5 flex justify-center">
            <button
              onClick={() => setBookmarkPanelOpen((prev) => !prev)}
              className="w-9 h-7 rounded-lg bg-lime border-[2px] border-navy press-2 press-navy flex items-center justify-center"
              aria-label={bookmarkPanelOpen ? "Hide bookmarks" : "Show bookmarks"}
              title={bookmarkPanelOpen ? "Hide bookmarks" : "Show bookmarks"}
            >
              <svg
                aria-hidden="true"
                className={`w-4 h-4 text-navy transition-transform ${bookmarkPanelOpen ? "rotate-180" : "rotate-0"}`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M12 7.5a.75.75 0 0 1 .6.3l4.5 6a.75.75 0 1 1-1.2.9L12 9.6l-3.9 5.1a.75.75 0 0 1-1.2-.9l4.5-6a.75.75 0 0 1 .6-.3Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {bookmarkPanelOpen && (
            <BookmarkPanel
              bookmarks={bookmarks}
              onJumpTo={handleJumpTo}
              onDelete={handleDeleteBookmark}
              onAdd={handleAddBookmark}
              currentPage={isPDF ? currentPage : undefined}
              currentTime={isVideo ? currentTime : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}
