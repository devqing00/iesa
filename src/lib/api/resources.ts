/**
 * Resources Service
 * API functions for library/resource management
 */

import { api, buildQueryString } from './client';
import { Resource, ResourceType } from './types';

// ============================================
// List & Read Endpoints
// ============================================

interface ListResourcesParams {
  level?: number;
  courseCode?: string;
  type?: ResourceType;
  approved?: boolean;
  search?: string;
  limit?: number;
  skip?: number;
}

/**
 * Get resources for the current session
 */
export async function getResources(params: ListResourcesParams = {}): Promise<Resource[]> {
  const query = buildQueryString(params);
  return api.get<Resource[]>(`/api/v1/resources${query}`);
}

/**
 * Get a single resource by ID
 */
export async function getResourceById(resourceId: string): Promise<Resource> {
  return api.get<Resource>(`/api/v1/resources/${resourceId}`);
}

/**
 * Track a resource download
 */
export async function trackDownload(resourceId: string): Promise<void> {
  return api.post<void>(`/api/v1/resources/${resourceId}/download`);
}

// ============================================
// Upload Endpoints
// ============================================

interface UploadResourceData {
  title: string;
  description?: string;
  type: ResourceType;
  courseCode: string;
  level: number;
  fileUrl: string;
  tags?: string[];
}

/**
 * Add a new resource (with Google Drive link)
 */
export async function addResource(data: UploadResourceData): Promise<Resource> {
  return api.post<Resource>('/api/v1/resources/add', data);
}

// ============================================
// Admin/Academic Committee Endpoints
// ============================================

/**
 * Approve a resource
 */
export async function approveResource(resourceId: string): Promise<Resource> {
  return api.patch<Resource>(`/api/v1/resources/${resourceId}/approve`);
}

/**
 * Delete a resource
 */
export async function deleteResource(resourceId: string): Promise<void> {
  return api.delete<void>(`/api/v1/resources/${resourceId}`);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get resource type display name
 */
export function getResourceTypeName(type: ResourceType): string {
  const names: Record<ResourceType, string> = {
    slide: 'Slides',
    pastQuestion: 'Past Questions',
    video: 'Video',
    textbook: 'Textbook',
    note: 'Notes',
  };
  return names[type] || type;
}

/**
 * Get resource type icon name (for use with icon libraries)
 */
export function getResourceTypeIcon(type: ResourceType): string {
  const icons: Record<ResourceType, string> = {
    slide: 'presentation',
    pastQuestion: 'file-question',
    video: 'video',
    textbook: 'book',
    note: 'file-text',
  };
  return icons[type] || 'file';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Group resources by course code
 */
export function groupResourcesByCourse(resources: Resource[]): Record<string, Resource[]> {
  const grouped: Record<string, Resource[]> = {};

  for (const resource of resources) {
    if (!grouped[resource.courseCode]) {
      grouped[resource.courseCode] = [];
    }
    grouped[resource.courseCode].push(resource);
  }

  return grouped;
}

/**
 * Group resources by type
 */
export function groupResourcesByType(resources: Resource[]): Record<ResourceType, Resource[]> {
  const grouped: Record<string, Resource[]> = {
    slide: [],
    pastQuestion: [],
    video: [],
    textbook: [],
    note: [],
  };

  for (const resource of resources) {
    if (grouped[resource.type]) {
      grouped[resource.type].push(resource);
    }
  }

  return grouped as Record<ResourceType, Resource[]>;
}

/**
 * Get most downloaded resources
 */
export function getMostDownloaded(resources: Resource[], limit: number = 5): Resource[] {
  return [...resources].sort((a, b) => b.downloadCount - a.downloadCount).slice(0, limit);
}

/**
 * Filter resources by search term
 */
export function searchResources(resources: Resource[], query: string): Resource[] {
  const lowercaseQuery = query.toLowerCase();
  return resources.filter(
    (r) =>
      r.title.toLowerCase().includes(lowercaseQuery) ||
      r.courseCode.toLowerCase().includes(lowercaseQuery) ||
      r.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)) ||
      (r.description && r.description.toLowerCase().includes(lowercaseQuery))
  );
}
