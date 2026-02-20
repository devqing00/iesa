/**
 * Users Service
 * API functions for user management
 */

import { api, buildQueryString } from './client';
import { User, UserUpdate, UserPermissions, UserRole } from './types';

// ============================================
// Current User
// ============================================

/**
 * Get the current user's profile
 */
export async function getCurrentUser(): Promise<User> {
  return api.get<User>('/api/v1/users/me');
}

/**
 * Update the current user's profile
 */
export async function updateCurrentUser(data: UserUpdate): Promise<User> {
  return api.patch<User>('/api/v1/users/me', data);
}

/**
 * Get the current user's permissions for the active session
 */
export async function getCurrentUserPermissions(): Promise<UserPermissions> {
  return api.get<UserPermissions>('/api/v1/users/me/permissions');
}

/**
 * Upload profile picture
 */
export async function uploadProfilePicture(file: File): Promise<{ profilePictureUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);

  // Use fetch directly for multipart/form-data
  const response = await fetch('/api/v1/users/me/profile-picture', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to upload profile picture');
  }

  return response.json();
}

// ============================================
// User Management (Admin)
// ============================================

interface ListUsersParams {
  role?: UserRole;
  level?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * List all users (admin only)
 */
export async function listUsers(params: ListUsersParams = {}): Promise<User[]> {
  const query = buildQueryString(params);
  return api.get<User[]>(`/api/v1/users${query}`);
}

/**
 * Get a user by ID
 */
export async function getUserById(userId: string): Promise<User> {
  return api.get<User>(`/api/v1/users/${userId}`);
}

/**
 * Change a user's role (admin only)
 */
export async function changeUserRole(userId: string, role: UserRole): Promise<User> {
  return api.patch<User>(`/api/v1/users/${userId}/role`, { role });
}

/**
 * Update a user's academic info (admin only)
 */
export async function updateUserAcademicInfo(
  userId: string,
  data: { admissionYear?: number; currentLevel?: string }
): Promise<User> {
  return api.patch<User>(`/api/v1/users/${userId}/academic-info`, data);
}

// ============================================
// Student Registration
// ============================================

interface CompleteRegistrationData {
  matricNumber: string;
  level: string;
  phone?: string;
}

/**
 * Complete student registration
 */
export async function completeRegistration(data: CompleteRegistrationData): Promise<User> {
  return api.post<User>('/api/v1/students/complete-registration', data);
}

/**
 * Check if a matric number is available
 */
export async function checkMatricAvailable(matricNumber: string): Promise<{ available: boolean }> {
  return api.get<{ available: boolean }>(`/api/v1/students/check-matric/${matricNumber}`);
}
