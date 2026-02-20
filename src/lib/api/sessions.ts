/**
 * Sessions Service
 * API functions for academic session management
 */

import { api } from './client';
import { Session, SessionSummary } from './types';

// ============================================
// Public Endpoints
// ============================================

/**
 * Get all sessions
 */
export async function getAllSessions(): Promise<SessionSummary[]> {
  return api.get<SessionSummary[]>('/api/v1/sessions', { skipAuth: true, skipSession: true });
}

/**
 * Get the active session
 */
export async function getActiveSession(): Promise<Session> {
  return api.get<Session>('/api/v1/sessions/active', { skipAuth: true, skipSession: true });
}

/**
 * Get a session by ID
 */
export async function getSessionById(sessionId: string): Promise<Session> {
  return api.get<Session>(`/api/v1/sessions/${sessionId}`, { skipAuth: true, skipSession: true });
}

// ============================================
// Admin Endpoints
// ============================================

interface CreateSessionData {
  name: string;
  startDate: string;
  endDate: string;
  currentSemester?: 1 | 2;
  isActive?: boolean;
}

/**
 * Create a new session (admin only)
 */
export async function createSession(data: CreateSessionData): Promise<Session> {
  return api.post<Session>('/api/v1/sessions', data);
}

interface UpdateSessionData {
  name?: string;
  startDate?: string;
  endDate?: string;
  currentSemester?: 1 | 2;
  isActive?: boolean;
}

/**
 * Update a session (admin only)
 */
export async function updateSession(sessionId: string, data: UpdateSessionData): Promise<Session> {
  return api.patch<Session>(`/api/v1/sessions/${sessionId}`, data);
}

/**
 * Delete a session (admin only)
 * This will also delete all associated data (enrollments, payments, etc.)
 */
export async function deleteSession(sessionId: string): Promise<void> {
  return api.delete<void>(`/api/v1/sessions/${sessionId}`);
}

/**
 * Activate a session (admin only)
 * Deactivates any currently active session
 */
export async function activateSession(sessionId: string): Promise<Session> {
  return api.patch<Session>(`/api/v1/sessions/${sessionId}`, { isActive: true });
}

/**
 * Update the current semester of a session (admin only)
 */
export async function updateSemester(sessionId: string, semester: 1 | 2): Promise<Session> {
  return api.patch<Session>(`/api/v1/sessions/${sessionId}`, { currentSemester: semester });
}
