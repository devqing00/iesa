"use client";

import { useState, useEffect, useRef } from "react";
import { 
  type DriveItem, 
  type DriveBreadcrumb,
  type FileProgress,
  formatDuration,
  getFileTypeColor,
  getFileTypeLabel,
} from "@/lib/api/drive";
import { formatFileSize } from "@/lib/api/drive";

// ── Icons ──────────────────────────────────────────────────

function FolderIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.906 9c.382 0 .749.057 1.094.162V9a3 3 0 0 0-3-3h-3.879a.75.75 0 0 1-.53-.22L11.47 3.66A2.25 2.25 0 0 0 9.879 3H6a3 3 0 0 0-3 3v3.162A3.756 3.756 0 0 1 4.094 9h15.812ZM4.094 10.5a2.25 2.25 0 0 0-2.227 2.568l.857 6A2.25 2.25 0 0 0 4.951 21H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-2.227-2.568H4.094Z" />
    </svg>
  );
}

function FileIcon({ fileType, className = "w-5 h-5" }: { fileType: string; className?: string }) {
  if (fileType === "pdf") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
        <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
      </svg>
    );
  }
  if (fileType === "video") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M2.25 5.25a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3V15a3 3 0 0 1-3 3h-3v.257c0 .597.237 1.17.659 1.591l.621.622a.75.75 0 0 1-.53 1.28h-9a.75.75 0 0 1-.53-1.28l.621-.622a2.25 2.25 0 0 0 .659-1.59V18h-3a3 3 0 0 1-3-3V5.25Zm9.72 6.97a.75.75 0 0 0 0 1.06l1.5 1.5a.75.75 0 1 0 1.06-1.06l-1.5-1.5a.75.75 0 0 0-1.06 0Zm1.06-4.28a.75.75 0 1 0-1.06 1.06l5.25 5.25a.75.75 0 0 0 1.06-1.06l-5.25-5.25Z" clipRule="evenodd" />
      </svg>
    );
  }
  if (fileType === "image") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
      </svg>
    );
  }
  // Generic file
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" clipRule="evenodd" />
      <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
    </svg>
  );
}

function SearchIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function ChevronRightIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function ClockIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
    </svg>
  );
}

// ── Breadcrumbs ─────────────────────────────────────────────

interface BreadcrumbsProps {
  breadcrumbs: DriveBreadcrumb[];
  folderId: string | null;
  onNavigate: (folderId: string | null, name?: string) => void;
  onGoBack: () => void;
}

function Breadcrumbs({ breadcrumbs, folderId, onNavigate, onGoBack }: BreadcrumbsProps) {
  const isRoot = !folderId || breadcrumbs.length <= 1;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); };
  }, [breadcrumbs]);

  return (
    <div className="relative">
      <div ref={scrollRef} className="flex items-center gap-2 px-0 py-2.5 overflow-x-auto scrollbar-hide">
      {/* Back button — only shown when not at root */}
      {!isRoot && (
        <button
          onClick={onGoBack}
          title="Go back"
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-navy text-snow hover:bg-navy-muted transition-colors"
        >
          <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
      )}

      {/* Root crumb — always shown */}
      <button
        onClick={() => onNavigate(null)}
        className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
          isRoot
            ? "bg-lime border-2 border-navy text-navy"
            : "text-navy-muted hover:text-navy hover:bg-cloud"
        }`}
      >
        <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
          <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a1.003 1.003 0 0 0 .091-.086L12 5.432Z" />
        </svg>
        Drive
      </button>

      {/* Intermediate + current crumbs */}
      {breadcrumbs.slice(1).map((crumb, i) => {
        const isLast = i === breadcrumbs.slice(1).length - 1;
        return (
          <span key={crumb.id} className="flex items-center gap-2 shrink-0">
            <ChevronRightIcon className="w-3 h-3 text-cloud shrink-0" />
            {isLast ? (
              <span className="px-2.5 py-1 rounded-lg bg-navy text-snow font-bold text-xs uppercase tracking-wider whitespace-nowrap">
                {crumb.name}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(crumb.id)}
                className="px-2.5 py-1 rounded-lg text-navy-muted hover:text-navy hover:bg-cloud font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap"
              >
                {crumb.name}
              </button>
            )}
          </span>
        );
      })}
      </div>
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-linear-to-r from-ghost to-transparent" />
      )}
      {/* Right-edge fade — signals there's more to scroll */}
      {canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-linear-to-l from-ghost to-transparent" />
      )}
    </div>
  );
}

// ── Progress Bar ─────────────────────────────────────────────

function ProgressIndicator({ progress }: { progress?: FileProgress | null }) {
  if (!progress || !progress.percentComplete) return null;
  const pct = Math.min(progress.percentComplete, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-cloud rounded-full overflow-hidden">
        <div
          className="h-full bg-teal rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate font-medium">{Math.round(pct)}%</span>
    </div>
  );
}

// ── File Card ───────────────────────────────────────────────

interface FileCardProps {
  item: DriveItem;
  progress?: FileProgress | null;
  onClick: (item: DriveItem) => void;
  rotation?: string;
}

function FileCard({ item, progress, onClick, rotation = "" }: FileCardProps) {
  const colors = getFileTypeColor(item.fileType);
  const typeLabel = getFileTypeLabel(item.fileType);

  return (
    <button
      onClick={() => onClick(item)}
      className={`group text-left w-full bg-snow border-[3px] border-navy rounded-2xl p-4 press-4 press-navy transition-all ${rotation}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${colors.bg} ${colors.text}`}>
          {item.isFolder ? (
            <FolderIcon className="w-5 h-5" />
          ) : (
            <FileIcon fileType={item.fileType} className="w-5 h-5" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-navy text-sm wrap-break-word line-clamp-2 pr-1 group-hover:text-lime-dark transition-colors">
            {item.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-label-sm ${colors.text} px-1.5 py-0.5 rounded ${colors.bg}`}>
              {typeLabel}
            </span>
            {item.size && (
              <span className="text-xs text-slate">{formatFileSize(item.size)}</span>
            )}
            {item.durationMs && (
              <span className="text-xs text-slate flex items-center gap-0.5">
                <ClockIcon className="w-3 h-3" />
                {formatDuration(item.durationMs)}
              </span>
            )}
          </div>
          {/* Progress bar */}
          {progress && <div className="mt-2"><ProgressIndicator progress={progress} /></div>}
        </div>

        {/* Arrow */}
        <ChevronRightIcon className="w-4 h-4 text-slate shrink-0 mt-1 group-hover:text-navy transition-colors" />
      </div>
    </button>
  );
}

// ── Folder Card (large) ─────────────────────────────────────

function FolderCard({ item, onClick, rotation = "" }: { item: DriveItem; onClick: (item: DriveItem) => void; rotation?: string }) {
  return (
    <button
      onClick={() => onClick(item)}
      className={`group text-left w-full bg-lime-light border-4 border-navy rounded-2xl p-5 press-5 press-navy transition-all ${rotation}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-lime flex items-center justify-center">
          <FolderIcon className="w-6 h-6 text-navy" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-black text-navy text-base wrap-break-word line-clamp-2 pr-1 group-hover:text-lime-dark transition-colors">
            {item.name}
          </h3>
          <p className="text-xs text-navy-muted mt-0.5">Tap to explore</p>
        </div>
        <ChevronRightIcon className="w-5 h-5 text-navy shrink-0" />
      </div>
    </button>
  );
}

// ── Recently Viewed Bar ──────────────────────────────────────

interface RecentBarProps {
  recent: FileProgress[];
  onOpenFile: (fileId: string) => void;
}

function RecentBar({ recent, onOpenFile }: RecentBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, [recent]);

  if (recent.length === 0) return null;

  return (
    <div className="mb-6 relative">
      <h3 className="font-display font-black text-navy text-sm mb-3 flex items-center gap-2">
        <ClockIcon className="w-4 h-4 text-coral" />
        Continue Where You Left Off
      </h3>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {recent.map((p) => {
          const pct = Math.min(p.percentComplete || 0, 100);
          const hasPage = p.currentPage && p.totalPages;
          const hasTime = p.currentTime && p.totalDuration;
          return (
            <button
              key={p.fileId}
              onClick={() => onOpenFile(p.fileId)}
              className="shrink-0 w-52 max-w-[75vw] bg-snow border-[3px] border-navy rounded-2xl p-3.5 press-3 press-navy text-left group"
            >
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <p className="text-xs font-bold text-navy line-clamp-2 leading-tight group-hover:text-navy/70 transition-colors flex-1">{p.fileName}</p>
                {pct >= 100 ? (
                  <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-teal text-snow text-[9px] font-black uppercase tracking-wider">Done</span>
                ) : (
                  <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-coral-light text-coral text-[9px] font-black uppercase tracking-wider border border-coral/30">Resume</span>
                )}
              </div>
              <ProgressIndicator progress={p} />
              {hasPage && (
                <p className="text-[10px] text-slate mt-1.5 font-bold">
                  Page {p.currentPage} of {p.totalPages}
                  {pct < 100 && <span className="text-coral"> — pick up here</span>}
                </p>
              )}
              {hasTime && !hasPage && (
                <p className="text-[10px] text-slate mt-1.5 font-bold">
                  {formatDuration(Math.round((p.currentTime || 0) * 1000))} / {formatDuration(Math.round((p.totalDuration || 0) * 1000))}
                </p>
              )}
            </button>
          );
        })}
      </div>
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 bottom-2 h-[calc(100%-1.75rem)] w-8 bg-linear-to-r from-ghost to-transparent" />
      )}
      {canScrollRight && (
        <div className="pointer-events-none absolute right-0 bottom-2 h-[calc(100%-1.75rem)] w-8 bg-linear-to-l from-ghost to-transparent" />
      )}
    </div>
  );
}

// ── Search Bar ──────────────────────────────────────────────

interface SearchBarProps {
  query: string;
  onChange: (q: string) => void;
  onSearch: () => void;
  loading?: boolean;
}

function SearchBar({ query, onChange, onSearch, loading }: SearchBarProps) {
  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch()}
        placeholder="Search resources..."
        className="w-full pl-10 pr-4 py-2.5 bg-snow border-[3px] border-navy rounded-xl text-sm text-navy placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-lime"
      />
      <button
        onClick={onSearch}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate hover:text-navy"
        title="Search"
      >
        <SearchIcon className="w-4 h-4" />
      </button>
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-lime border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// ── Empty States ─────────────────────────────────────────────

function EmptyFolder() {
  return (
    <div className="text-center py-16">
      <FolderIcon className="w-16 h-16 text-cloud mx-auto mb-4" />
      <h3 className="font-display font-black text-navy text-lg mb-2">Nothing here yet</h3>
      <p className="text-slate text-sm">This folder is empty. Check back later!</p>
    </div>
  );
}

function NoSearchResults({ query }: { query: string }) {
  return (
    <div className="text-center py-16">
      <SearchIcon className="w-16 h-16 text-cloud mx-auto mb-4" />
      <h3 className="font-display font-black text-navy text-lg mb-2">No results found</h3>
      <p className="text-slate text-sm">Nothing matched &ldquo;{query}&rdquo;. Try different keywords.</p>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 bg-sunny-light rounded-2xl flex items-center justify-center mx-auto mb-4">
        <FolderIcon className="w-10 h-10 text-sunny" />
      </div>
      <h3 className="font-display font-black text-navy text-lg mb-2">Drive Not Set Up</h3>
      <p className="text-slate text-sm max-w-md mx-auto">
        The resource drive hasn&apos;t been configured yet. 
        Contact an admin to set the <code className="bg-cloud px-1 rounded text-xs">DRIVE_ROOT_FOLDER_ID</code>.
      </p>
    </div>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────

function Skeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-snow border-[3px] border-cloud rounded-2xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-cloud rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-cloud rounded w-3/4" />
              <div className="h-3 bg-cloud rounded w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────

export interface DriveExplorerProps {
  items: DriveItem[];
  breadcrumbs: DriveBreadcrumb[];
  folderId: string | null;
  rootId: string;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  searchResults: DriveItem[] | null;
  searchLoading: boolean;
  recentFiles: FileProgress[];
  progressMap: Record<string, FileProgress>;
  onNavigateFolder: (folderId: string | null, name?: string) => void;
  onOpenFile: (item: DriveItem) => void;
  onSearch: (query: string) => void;
  onSearchSubmit: () => void;
  onGoBack: () => void;
  onRetry: () => void;
  notConfigured: boolean;
}

const rotations = ["", "rotate-[0.3deg]", "", "rotate-[-0.3deg]", "rotate-[0.2deg]", ""];

export default function DriveExplorer({
  items,
  breadcrumbs,
  folderId,
  loading,
  error,
  searchQuery,
  searchResults,
  searchLoading,
  recentFiles,
  progressMap,
  onNavigateFolder,
  onOpenFile,
  onSearch,
  onSearchSubmit,
  onGoBack,
  onRetry,
  notConfigured,
}: DriveExplorerProps) {
  const isRoot = !folderId || breadcrumbs.length <= 1;
  const folders = items.filter((i) => i.isFolder);
  const files = items.filter((i) => !i.isFolder);

  // Searching mode
  const isSearching = searchQuery.length > 0 && searchResults !== null;

  if (notConfigured) return <NotConfigured />;

  return (
    <div className="min-w-0 overflow-x-hidden">
      {/* Breadcrumb nav — always shown (shows Drive root when at root) */}
      <div className="mb-4 overflow-hidden">
        <Breadcrumbs
          breadcrumbs={breadcrumbs}
          folderId={folderId}
          onNavigate={onNavigateFolder}
          onGoBack={onGoBack}
        />
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <SearchBar
          query={searchQuery}
          onChange={onSearch}
          onSearch={onSearchSubmit}
          loading={searchLoading}
        />
      </div>

      {/* Recently viewed (only on root) */}
      {isRoot && !isSearching && <RecentBar recent={recentFiles} onOpenFile={(id) => onOpenFile({ id } as DriveItem)} />}

      {/* Error */}
      {error && (
        <div className="bg-coral-light border-[3px] border-coral rounded-2xl p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-coral font-medium text-sm">{error}</p>
            <button
              onClick={onRetry}
              className="shrink-0 px-3 py-1.5 bg-snow border-2 border-navy rounded-lg font-display font-bold text-xs text-navy uppercase tracking-wider press-2 press-navy"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !error && <Skeleton />}

      {/* Search results */}
      {isSearching && !searchLoading && (
        <>
          <p className="text-sm text-slate mb-3">
            {searchResults!.length} result{searchResults!.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
          </p>
          {searchResults!.length === 0 ? (
            <NoSearchResults query={searchQuery} />
          ) : (
            <div className="grid gap-3">
              {searchResults!.map((item, i) =>
                item.isFolder ? (
                  <FolderCard key={item.id} item={item} onClick={() => onNavigateFolder(item.id, item.name)} rotation={rotations[i % rotations.length]} />
                ) : (
                  <FileCard
                    key={item.id}
                    item={item}
                    progress={progressMap[item.id]}
                    onClick={onOpenFile}
                    rotation={rotations[i % rotations.length]}
                  />
                )
              )}
            </div>
          )}
        </>
      )}

      {/* Folder contents */}
      {!loading && !isSearching && (
        <>
          {items.length === 0 && <EmptyFolder />}

          {/* Folders */}
          {folders.length > 0 && (
            <div className="mb-6">
              {files.length > 0 && (
                <h3 className="font-display font-black text-navy text-sm mb-3 flex items-center gap-2">
                  <FolderIcon className="w-4 h-4 text-lime" />
                  Folders
                </h3>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {folders.map((item, i) => (
                  <FolderCard
                    key={item.id}
                    item={item}
                    onClick={() => onNavigateFolder(item.id, item.name)}
                    rotation={rotations[i % rotations.length]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {files.length > 0 && (
            <div>
              {folders.length > 0 && (
                <h3 className="font-display font-black text-navy text-sm mb-3 flex items-center gap-2">
                  <FileIcon fileType="other" className="w-4 h-4 text-lavender" />
                  Files
                </h3>
              )}
              <div className="grid gap-3">
                {files.map((item, i) => (
                  <FileCard
                    key={item.id}
                    item={item}
                    progress={progressMap[item.id]}
                    onClick={onOpenFile}
                    rotation={rotations[i % rotations.length]}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
