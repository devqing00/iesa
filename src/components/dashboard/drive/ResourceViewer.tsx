"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
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
import { getCachedFile, cacheFile } from "@/lib/driveCache";

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
  onProgressUpdate: (page: number, total: number) => void;
}

type CacheStatus = "checking" | "cached" | "downloading" | "ready";

function PDFViewer({ fileId, meta, onProgressUpdate }: PDFViewerProps) {
  const { getAccessToken } = useAuth();
  const [currentPage, setCurrentPage] = useState(meta.progress?.currentPage || 1);
  const [totalPages, setTotalPages] = useState(meta.progress?.totalPages || 0);
  const [zoom, setZoom] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>("checking");
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Refs for scroll-on-resume logic — must not be reactive state
  const initialPageRef = useRef(meta.progress?.currentPage || 1);
  const scrolledToInitialRef = useRef(initialPageRef.current <= 1); // no scroll needed if already at p1
  const currentPageRef = useRef(currentPage);
  const urlToRevokeRef = useRef<string | null>(null);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  const streamUrl = getDriveStreamUrl(fileId);

  // Cache-aware file loader:
  // 1. Check IndexedDB — if HIT, create object URL immediately (instant load)
  // 2. If MISS, fetch with auth token, store in IDB, then create object URL
  useEffect(() => {
    let cancelled = false;
    setCacheStatus("checking");
    setPdfUrl(null);
    setPdfLoading(true);
    setPdfError(null);

    (async () => {
      // 1 — try cache
      const cached = await getCachedFile(fileId);
      if (cached && !cancelled) {
        const url = URL.createObjectURL(cached);
        urlToRevokeRef.current = url;
        setPdfUrl(url);
        setCacheStatus("cached");
        return;
      }

      if (cancelled) return;

      // 2 — download from server
      setCacheStatus("downloading");
      try {
        const token = await getAccessToken();
        if (cancelled) return;
        const res = await fetch(streamUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;

        // Cache for next time (fire-and-forget)
        cacheFile(fileId, blob, meta.name, meta.mimeType).catch(() => {});

        const url = URL.createObjectURL(blob);
        urlToRevokeRef.current = url;
        setPdfUrl(url);
        setCacheStatus("ready");
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
  }, [fileId, streamUrl, getAccessToken, meta.name, meta.mimeType]);

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

  const handleDocumentLoadError = useCallback(() => {
    setPdfLoading(false);
    setPdfError("Failed to load PDF. The file may be too large or inaccessible.");
  }, []);

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

  // Cache page offsets once after all pages render, then use cheap scrollTop lookup.
  const pageOffsetsRef = useRef<number[]>([]); // index 0 = page 1's offsetTop

  // Re-cache page offsets (called after render & on zoom change)
  const cachePageOffsets = useCallback(() => {
    if (!containerRef.current || totalPages === 0) return;
    const container = containerRef.current;
    // getBoundingClientRect at cache time (no scroll happening) gives the true
    // offset relative to the scroll container — offsetTop alone is relative to
    // offsetParent which may not be the scroll container.
    const containerTop = container.getBoundingClientRect().top;
    const scrollTop = container.scrollTop;
    const offsets: number[] = [];
    for (let p = 1; p <= totalPages; p++) {
      const el = pageRefs.current.get(p);
      if (el) {
        // offset from container's scroll origin
        offsets.push(el.getBoundingClientRect().top - containerTop + scrollTop);
      } else {
        offsets.push(0);
      }
    }
    pageOffsetsRef.current = offsets;
  }, [totalPages]);

  // Zoom changes page heights — invalidate cached offsets after react-pdf re-renders
  useEffect(() => {
    if (totalPages === 0) return;
    pageOffsetsRef.current = [];
    const t = setTimeout(cachePageOffsets, 350);
    return () => clearTimeout(t);
  }, [zoom, totalPages, cachePageOffsets]);

  // Track current page via scroll — O(1): binary search on pre-cached offsets.
  useEffect(() => {
    if (totalPages === 0 || !containerRef.current) return;
    const container = containerRef.current;

    // Cache offsets shortly after pages render
    const cacheTimer = setTimeout(cachePageOffsets, 300);

    const handleScroll = () => {
      if (!scrolledToInitialRef.current) return;

      const offsets = pageOffsetsRef.current;
      if (offsets.length === 0) { cachePageOffsets(); return; }

      const mid = container.scrollTop + container.clientHeight / 2;

      // Binary search for the page whose top is closest-but-not-past mid
      let lo = 0, hi = offsets.length - 1;
      while (lo < hi) {
        const m = (lo + hi + 1) >> 1;
        if (offsets[m] <= mid) lo = m;
        else hi = m - 1;
      }
      const bestPage = lo + 1; // +1 because offsets is 0-indexed for page 1

      if (bestPage !== currentPageRef.current) {
        currentPageRef.current = bestPage;
        setCurrentPage(bestPage);
        onProgressUpdate(bestPage, totalPages);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearTimeout(cacheTimer);
    };
  }, [totalPages, onProgressUpdate, cachePageOffsets]);

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
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
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
      <div ref={containerRef} className="flex-1 overflow-auto bg-navy-light">
        {(cacheStatus === "checking" || cacheStatus === "downloading" || pdfLoading) && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-lime border-t-transparent mx-auto" />
              <p className="text-snow text-sm">
                {cacheStatus === "checking" && "Checking cache..."}
                {cacheStatus === "downloading" && "Downloading PDF..."}
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
            <div className="flex flex-col items-center gap-2 py-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <div
                  key={pageNum}
                  ref={(el) => setPageRef(pageNum, el)}
                  data-page-number={pageNum}
                  className="shadow-lg"
                >
                  <Page
                    pageNumber={pageNum}
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

function ImageViewer({ fileId, meta }: { fileId: string; meta: FileMetaResponse }) {
  const streamUrl = getDriveStreamUrl(fileId);
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="flex items-center justify-center h-full bg-navy-light p-4 overflow-auto">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-[3px] border-lime border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={streamUrl}
        alt={meta.name}
        className="max-w-full max-h-full object-contain rounded-lg"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

// ── Embed Viewer (Google Docs/Sheets/Slides/Office) ──────────

function EmbedViewer({ meta }: { meta: FileMetaResponse }) {
  if (!meta.embedUrl) return null;
  return (
    <div className="flex-1 h-full">
      <iframe
        src={meta.embedUrl}
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
}

export default function ResourceViewer({ meta, loading, onClose, token }: ResourceViewerProps) {
  const [bookmarks, setBookmarks] = useState<FileBookmark[]>(meta?.bookmarks || []);
  const [currentPage, setCurrentPage] = useState(meta?.progress?.currentPage || 1);
  const [currentTime, setCurrentTime] = useState(meta?.progress?.currentTime || 0);
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
      }).catch(() => {}); // silent fail
    }, 2000);
  }, [meta]);

  // Save initial "opened" progress
  useEffect(() => {
    if (!meta) return;
    saveDriveProgress({
      fileId: meta.id,
      fileName: meta.name,
      fileMimeType: meta.mimeType,
    }).catch(() => {});
  }, [meta]);

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
    } catch {}
  }, [meta]);

  const handleDeleteBookmark = useCallback(async (bookmarkId: string) => {
    if (!meta) return;
    try {
      await deleteDriveBookmark(meta.id, bookmarkId);
      setBookmarks((prev) => prev.filter((b) => b._id !== bookmarkId));
    } catch {}
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
  const isEmbed = !!meta.embedUrl;
  const canPreview = isPDF || isVideo || isImage || isEmbed;

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
        {/* Open in Drive */}
        {meta.webViewLink && (
          <a
            href={meta.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs bg-navy text-lime border-2 border-lime rounded-lg px-3 py-1.5 press-2 press-lime font-bold flex items-center gap-1"
          >
            <ExternalLinkIcon className="w-3.5 h-3.5" />
            Drive
          </a>
        )}
      </header>

      {/* Viewer area */}
      <div className="flex-1 overflow-hidden relative">
        {isPDF && (
          <PDFViewer
            fileId={meta.id}
            meta={meta}
            onProgressUpdate={handlePdfProgress}
          />
        )}
        {isVideo && (
          <VideoPlayer
            fileId={meta.id}
            meta={meta}
            token={token}
            onProgressUpdate={handleVideoProgress}
          />
        )}
        {isImage && <ImageViewer fileId={meta.id} meta={meta} />}
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

      {/* Bookmark panel */}
      {canPreview && (
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
  );
}
