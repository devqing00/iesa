"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { api } from "@/lib/api/client";
import {
  type DriveItem,
  type DriveBreadcrumb,
  type BrowseResponse,
  type FileMetaResponse,
  type FileProgress,
  getDriveFileMeta,
  searchDrive,
} from "@/lib/api/drive";

// SWR fetcher
async function apiFetcher<T>(url: string): Promise<T> {
  return api.get<T>(url, { showErrorToast: false });
}

export interface UseDriveResult {
  // Folder browsing
  items: DriveItem[];
  breadcrumbs: DriveBreadcrumb[];
  folderId: string | null;
  rootId: string;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;

  // Search
  searchQuery: string;
  searchResults: DriveItem[] | null;
  searchLoading: boolean;

  // Recent & progress
  recentFiles: FileProgress[];
  progressMap: Record<string, FileProgress>;

  // File viewer
  viewingFile: FileMetaResponse | null;
  viewerLoading: boolean;

  // Actions
  navigateFolder: (folderId: string | null, name?: string) => void;
  openFile: (item: DriveItem) => void;
  closeViewer: () => void;
  setSearchQuery: (q: string) => void;
  doSearch: () => void;
  goBack: () => void;
  refreshFolder: () => void;
}

export function useDrive(): UseDriveResult {
  const [folderId, setFolderId] = useState<string | null>(() => {
    // Restore the last-visited folder from localStorage
    if (typeof window !== "undefined") {
      return localStorage.getItem("drive_last_folder") || null;
    }
    return null;
  });

  // Client-side breadcrumb trail — built as user navigates, not from backend
  // Each entry is {id, name} for the folder we entered. Root is implicit (not stored here).
  const [breadcrumbTrail, setBreadcrumbTrail] = useState<DriveBreadcrumb[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("drive_breadcrumb_trail");
        return saved ? JSON.parse(saved) : [];
      } catch { return []; }
    }
    return [];
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DriveItem[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [, setViewingFileId] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewingFile, setViewingFile] = useState<FileMetaResponse | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  // Persist breadcrumb trail to localStorage
  const persistTrail = useCallback((trail: DriveBreadcrumb[]) => {
    if (typeof window !== "undefined") {
      if (trail.length > 0) localStorage.setItem("drive_breadcrumb_trail", JSON.stringify(trail));
      else localStorage.removeItem("drive_breadcrumb_trail");
    }
  }, []);

  // Folder data via SWR
  const browseKey = `/api/v1/drive/browse${folderId ? `?folderId=${folderId}` : ""}`;
  const {
    data: browseData,
    error: browseError,
    isLoading: browseLoading,
    mutate: refreshFolder,
  } = useSWR<BrowseResponse>(
    browseKey,
    apiFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      errorRetryCount: 1,
      onError: (err) => {
        if (err?.status === 503) setNotConfigured(true);
      },
    },
  );

  // Recent files
  const { data: recentData } = useSWR<{ recent: FileProgress[] }>(
    "/api/v1/drive/recent?limit=10",
    apiFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  // All progress (for progress map)
  const { data: progressData } = useSWR<{ progress: FileProgress[] }>(
    "/api/v1/drive/progress",
    apiFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  // Build progress map
  const progressMap = useMemo(() => {
    const map: Record<string, FileProgress> = {};
    if (progressData?.progress) {
      for (const p of progressData.progress) {
        map[p.fileId] = p;
      }
    }
    return map;
  }, [progressData]);

  // Build client breadcrumbs from trail (root is always the implicit first entry)
  const clientBreadcrumbs: DriveBreadcrumb[] = useMemo(() => {
    const rootId = browseData?.rootId || "";
    return [
      { id: rootId, name: "Drive" },
      ...breadcrumbTrail,
    ];
  }, [breadcrumbTrail, browseData?.rootId]);

  // Navigation — name is required when going INTO a folder, omitted when jumping to a crumb
  const navigateFolder = useCallback((id: string | null, name?: string) => {
    if (id === null) {
      // Go to root
      setBreadcrumbTrail([]);
      persistTrail([]);
      setFolderId(null);
      localStorage.removeItem("drive_last_folder");
    } else if (name) {
      // Navigating into a new folder — push to trail
      setBreadcrumbTrail((prev) => {
        const next = [...prev, { id, name }];
        persistTrail(next);
        return next;
      });
      setFolderId(id);
      localStorage.setItem("drive_last_folder", id);
    } else {
      // Jumping to an existing crumb by id — slice trail up to and including that crumb
      setBreadcrumbTrail((prev) => {
        const idx = prev.findIndex((c) => c.id === id);
        const next = idx >= 0 ? prev.slice(0, idx + 1) : prev;
        persistTrail(next);
        return next;
      });
      setFolderId(id);
      localStorage.setItem("drive_last_folder", id);
    }
    setSearchQuery("");
    setSearchResults(null);
  }, [persistTrail]);

  const goBack = useCallback(() => {
    setBreadcrumbTrail((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      const parentId = next.length > 0 ? next[next.length - 1].id : null;
      setFolderId(parentId);
      if (parentId) localStorage.setItem("drive_last_folder", parentId);
      else localStorage.removeItem("drive_last_folder");
      persistTrail(next);
      return next;
    });
    setSearchQuery("");
    setSearchResults(null);
  }, [persistTrail]);

  // Open file for viewing
  const openFile = useCallback(async (item: DriveItem) => {
    if (item.isFolder) {
      navigateFolder(item.id, item.name);
      return;
    }
    setViewerLoading(true);
    setViewingFileId(item.id);
    try {
      const meta = await getDriveFileMeta(item.id);
      setViewingFile(meta);
    } catch {
    } finally {
      setViewerLoading(false);
    }
  }, [navigateFolder]);

  const closeViewer = useCallback(() => {
    setViewingFileId(null);
    setViewingFile(null);
    // Refresh all drive SWR caches so recent bar and progress map are up to date
    refreshFolder();
    globalMutate("/api/v1/drive/recent?limit=10");
    globalMutate("/api/v1/drive/progress");
  }, [refreshFolder]);

  // Search
  const doSearch = useCallback(async () => {
    if (searchQuery.trim().length < 2) return;
    setSearchLoading(true);
    try {
      const scoped = await searchDrive(searchQuery.trim(), folderId || undefined);
      if (scoped.results.length > 0 || !folderId) {
        setSearchResults(scoped.results);
      } else {
        const globalResult = await searchDrive(searchQuery.trim());
        setSearchResults(globalResult.results);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, folderId]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length === 0) {
      setSearchResults(null);
      return;
    }
    if (query.length < 2) return;

    const timer = setTimeout(() => {
      doSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, folderId, doSearch]);

  const handleSetSearchQuery = useCallback((q: string) => {
    setSearchQuery(q);
    if (q.length === 0) {
      setSearchResults(null);
    }
  }, []);

  return {
    items: browseData?.items || [],
    breadcrumbs: clientBreadcrumbs,
    folderId,
    rootId: browseData?.rootId || "",
    loading: browseLoading,
    error: browseError ? (browseError as Error).message : null,
    notConfigured,

    searchQuery,
    searchResults,
    searchLoading,

    recentFiles: recentData?.recent || [],
    progressMap,

    viewingFile,
    viewerLoading,

    navigateFolder,
    openFile,
    closeViewer,
    setSearchQuery: handleSetSearchQuery,
    doSearch,
    goBack,
    refreshFolder,
  };
}
