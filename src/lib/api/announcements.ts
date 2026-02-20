/**
 * Announcements Service
 * API functions for announcement management
 */

import { api, buildQueryString } from './client';
import { Announcement, AnnouncementWithStatus, AnnouncementCreate, AnnouncementPriority } from './types';

// ============================================
// List & Read
// ============================================

interface ListAnnouncementsParams {
  priority?: AnnouncementPriority;
  level?: number;
  isPinned?: boolean;
  limit?: number;
  skip?: number;
}

/**
 * Get announcements for the current session
 */
export async function getAnnouncements(params: ListAnnouncementsParams = {}): Promise<AnnouncementWithStatus[]> {
  const query = buildQueryString(params);
  return api.get<AnnouncementWithStatus[]>(`/api/v1/announcements${query}`);
}

/**
 * Get a single announcement by ID
 */
export async function getAnnouncementById(announcementId: string): Promise<AnnouncementWithStatus> {
  return api.get<AnnouncementWithStatus>(`/api/v1/announcements/${announcementId}`);
}

/**
 * Get IDs of announcements the user has read
 */
export async function getReadAnnouncementIds(): Promise<string[]> {
  const response = await api.get<{ read_ids: string[] }>('/api/v1/announcements/reads/me');
  return response.read_ids;
}

/**
 * Mark an announcement as read
 */
export async function markAnnouncementAsRead(announcementId: string): Promise<void> {
  return api.post<void>(`/api/v1/announcements/${announcementId}/read`);
}

// ============================================
// Admin/EXCO Endpoints
// ============================================

/**
 * Create a new announcement
 */
export async function createAnnouncement(data: AnnouncementCreate): Promise<Announcement> {
  return api.post<Announcement>('/api/v1/announcements', data);
}

interface UpdateAnnouncementData {
  title?: string;
  content?: string;
  priority?: AnnouncementPriority;
  targetLevels?: number[];
  isPinned?: boolean;
  expiresAt?: string | null;
}

/**
 * Update an announcement
 */
export async function updateAnnouncement(
  announcementId: string,
  data: UpdateAnnouncementData
): Promise<Announcement> {
  return api.patch<Announcement>(`/api/v1/announcements/${announcementId}`, data);
}

/**
 * Delete an announcement
 */
export async function deleteAnnouncement(announcementId: string): Promise<void> {
  return api.delete<void>(`/api/v1/announcements/${announcementId}`);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get unread count from a list of announcements
 */
export function getUnreadCount(announcements: AnnouncementWithStatus[]): number {
  return announcements.filter((a) => !a.isRead).length;
}

/**
 * Get pinned announcements from a list
 */
export function getPinnedAnnouncements(announcements: AnnouncementWithStatus[]): AnnouncementWithStatus[] {
  return announcements.filter((a) => a.isPinned);
}

/**
 * Get announcements by priority
 */
export function getUrgentAnnouncements(announcements: AnnouncementWithStatus[]): AnnouncementWithStatus[] {
  return announcements.filter((a) => a.priority === 'urgent' || a.priority === 'high');
}
