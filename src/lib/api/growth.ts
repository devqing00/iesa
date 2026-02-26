/**
 * Growth Hub API Client
 *
 * Provides persistence for personal growth tools (habits, goals, journal, etc.)
 * Uses a per-user key-value store on the backend.
 */

import { api } from './client';

export type GrowthTool =
  | 'habits' | 'goals' | 'journal' | 'planner' | 'flashcards'
  | 'timer-settings' | 'timer-history'
  | 'cgpa-history' | 'cgpa-grading'
  | 'courses';

interface GrowthDataResponse<T = unknown> {
  data: T | null;
  updatedAt: string | null;
}

interface SaveResponse {
  ok: boolean;
  updatedAt: string;
}

interface DeleteResponse {
  ok: boolean;
  deleted: boolean;
}

/**
 * Fetch the user's saved data for a specific growth tool.
 */
export async function getGrowthData<T = unknown>(tool: GrowthTool): Promise<GrowthDataResponse<T>> {
  return api.get<GrowthDataResponse<T>>(`/api/v1/growth/${tool}`, { showErrorToast: false });
}

/**
 * Save (upsert) the user's data for a specific growth tool.
 */
export async function saveGrowthData<T = unknown>(tool: GrowthTool, data: T): Promise<SaveResponse> {
  return api.put<SaveResponse>(`/api/v1/growth/${tool}`, { data }, { showErrorToast: false });
}

/**
 * Delete the user's data for a specific growth tool (reset).
 */
export async function deleteGrowthData(tool: GrowthTool): Promise<DeleteResponse> {
  return api.delete<DeleteResponse>(`/api/v1/growth/${tool}`);
}

/**
 * Get all growth data for the hub index page.
 */
export async function getAllGrowthData(): Promise<Record<string, GrowthDataResponse>> {
  return api.get<Record<string, GrowthDataResponse>>('/api/v1/growth/', { showErrorToast: false });
}
