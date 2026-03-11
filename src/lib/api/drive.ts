/**
 * Drive Service
 * API functions for Google Drive resource browser
 */

import { api, buildQueryString, API_BASE_URL } from './client';

// ============================================
// Types
// ============================================

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  fileType: string;
  isFolder: boolean;
  size: number | null;
  modifiedTime: string | null;
  thumbnailUrl: string | null;
  previewable: boolean;
  durationMs?: number;
  width?: number;
  height?: number;
}

export interface DriveBreadcrumb {
  id: string;
  name: string;
}

export interface BrowseResponse {
  items: DriveItem[];
  breadcrumbs: DriveBreadcrumb[];
  folderId: string;
  rootId: string;
  nextPageToken: string | null;
  fromCache: boolean;
}

export interface FileMetaResponse {
  id: string;
  name: string;
  mimeType: string;
  fileType: string;
  size: number | null;
  modifiedTime: string | null;
  createdTime: string | null;
  description: string | null;
  previewable: boolean;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  webViewLink: string | null;
  progress: FileProgress | null;
  bookmarks: FileBookmark[];
}

export interface FileProgress {
  fileId: string;
  fileName: string;
  fileMimeType: string;
  currentPage?: number;
  totalPages?: number;
  currentTime?: number;
  totalDuration?: number;
  scrollPercent?: number;
  percentComplete: number | null;
  lastOpenedAt: string;
  firstOpenedAt: string;
  openCount: number;
}

export interface FileBookmark {
  _id: string;
  fileId: string;
  fileName: string;
  page?: number;
  timestamp?: number;
  label: string;
  createdAt: string;
}

export interface SearchResponse {
  results: DriveItem[];
  query: string;
}

// ============================================
// Browse & Navigation
// ============================================

/**
 * Browse a Drive folder's contents
 */
export async function browseDriveFolder(
  folderId?: string,
  pageToken?: string,
  pageSize?: number,
): Promise<BrowseResponse> {
  const params: Record<string, string | number> = {};
  if (folderId) params.folderId = folderId;
  if (pageToken) params.pageToken = pageToken;
  if (pageSize) params.pageSize = pageSize;
  const query = buildQueryString(params);
  return api.get<BrowseResponse>(`/api/v1/drive/browse${query}`);
}

/**
 * Get detailed file metadata (includes progress + bookmarks)
 */
export async function getDriveFileMeta(fileId: string): Promise<FileMetaResponse> {
  return api.get<FileMetaResponse>(`/api/v1/drive/file/${fileId}/meta`);
}

/**
 * Get the stream URL for a file (for PDFs, videos, images).
 * Returns the full URL string — used in <iframe src>, <video src>, etc.
 */
export function getDriveStreamUrl(fileId: string): string {
  return `${API_BASE_URL}/api/v1/drive/file/${fileId}/stream`;
}

/**
 * Search files by name
 */
export async function searchDrive(q: string, folderId?: string): Promise<SearchResponse> {
  const params: Record<string, string> = { q };
  if (folderId) params.folderId = folderId;
  const query = buildQueryString(params);
  return api.get<SearchResponse>(`/api/v1/drive/search${query}`);
}

// ============================================
// Progress Tracking
// ============================================

export interface ProgressUpdatePayload {
  fileId: string;
  fileName: string;
  fileMimeType?: string;
  currentPage?: number;
  totalPages?: number;
  currentTime?: number;
  totalDuration?: number;
  scrollPercent?: number;
}

/**
 * Save reading/viewing progress for a file
 */
export async function saveDriveProgress(data: ProgressUpdatePayload): Promise<void> {
  await api.post('/api/v1/drive/progress', data, { showErrorToast: false });
}

/**
 * Get all progress entries for the current user
 */
export async function getAllDriveProgress(): Promise<{ progress: FileProgress[] }> {
  return api.get('/api/v1/drive/progress');
}

/**
 * Get recently viewed files
 */
export async function getRecentDriveFiles(limit = 10): Promise<{ recent: FileProgress[] }> {
  return api.get(`/api/v1/drive/recent?limit=${limit}`);
}

// ============================================
// Bookmarks
// ============================================

export interface BookmarkPayload {
  fileId: string;
  fileName: string;
  page?: number;
  timestamp?: number;
  label?: string;
}

/**
 * Create a bookmark for a specific page/timestamp
 */
export async function createDriveBookmark(data: BookmarkPayload): Promise<{ ok: boolean; bookmarkId: string }> {
  return api.post('/api/v1/drive/bookmark', data, { successMessage: 'Bookmark saved' });
}

/**
 * Delete a bookmark
 */
export async function deleteDriveBookmark(fileId: string, bookmarkId: string): Promise<void> {
  await api.delete('/api/v1/drive/bookmark', {
    body: { fileId, bookmarkId },
  });
}

// ============================================
// Utility Helpers
// ============================================

/** Format file size (bytes → human readable) */
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Format duration (ms → human readable) */
export function formatDuration(ms: number | undefined): string {
  if (!ms) return '';
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format seconds → human readable */
export function formatSeconds(secs: number | undefined): string {
  if (!secs) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Get file icon color class based on file type */
export function getFileTypeColor(fileType: string): { bg: string; text: string; border: string } {
  switch (fileType) {
    case 'pdf': return { bg: 'bg-coral-light', text: 'text-coral', border: 'border-coral' };
    case 'google_doc':
    case 'docx':
    case 'doc':
    case 'text': return { bg: 'bg-lavender-light', text: 'text-lavender', border: 'border-lavender' };
    case 'google_sheet':
    case 'xlsx':
    case 'xls': return { bg: 'bg-teal-light', text: 'text-teal', border: 'border-teal' };
    case 'google_slide':
    case 'pptx':
    case 'ppt': return { bg: 'bg-sunny-light', text: 'text-sunny', border: 'border-sunny' };
    case 'video': return { bg: 'bg-navy', text: 'text-snow', border: 'border-navy' };
    case 'image': return { bg: 'bg-lime-light', text: 'text-lime-dark', border: 'border-lime' };
    case 'folder': return { bg: 'bg-lime', text: 'text-navy', border: 'border-navy' };
    default: return { bg: 'bg-cloud', text: 'text-navy', border: 'border-navy' };
  }
}

/** Human-readable file type label */
export function getFileTypeLabel(fileType: string): string {
  switch (fileType) {
    case 'pdf': return 'PDF';
    case 'google_doc': return 'Google Doc';
    case 'google_sheet': return 'Google Sheet';
    case 'google_slide': return 'Google Slides';
    case 'google_form': return 'Google Form';
    case 'docx': return 'Word Doc';
    case 'doc': return 'Word Doc';
    case 'pptx': return 'PowerPoint';
    case 'ppt': return 'PowerPoint';
    case 'xlsx': return 'Excel';
    case 'xls': return 'Excel';
    case 'video': return 'Video';
    case 'image': return 'Image';
    case 'text': return 'Text';
    case 'folder': return 'Folder';
    default: return 'File';
  }
}
