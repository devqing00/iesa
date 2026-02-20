/**
 * Enrollments Service
 * API functions for student enrollment management
 */

import { api, buildQueryString } from './client';
import { Enrollment, EnrollmentWithDetails } from './types';

// ============================================
// Read Endpoints
// ============================================

interface ListEnrollmentsParams {
  level?: string;
  sessionId?: string;
  limit?: number;
  skip?: number;
}

/**
 * Get enrollments (admin/exco)
 */
export async function getEnrollments(params: ListEnrollmentsParams = {}): Promise<EnrollmentWithDetails[]> {
  const query = buildQueryString(params);
  return api.get<EnrollmentWithDetails[]>(`/api/v1/enrollments${query}`);
}

/**
 * Get enrollment by ID
 */
export async function getEnrollmentById(enrollmentId: string): Promise<EnrollmentWithDetails> {
  return api.get<EnrollmentWithDetails>(`/api/v1/enrollments/${enrollmentId}`);
}

/**
 * Get current user's enrollments
 */
export async function getMyEnrollments(): Promise<Enrollment[]> {
  return api.get<Enrollment[]>('/api/v1/enrollments/my-enrollments');
}

// ============================================
// Admin Endpoints
// ============================================

interface CreateEnrollmentData {
  studentId: string;
  sessionId: string;
  level: string;
}

/**
 * Create a new enrollment
 */
export async function createEnrollment(data: CreateEnrollmentData): Promise<Enrollment> {
  return api.post<Enrollment>('/api/v1/enrollments', data);
}

interface UpdateEnrollmentData {
  level?: string;
}

/**
 * Update an enrollment
 */
export async function updateEnrollment(
  enrollmentId: string,
  data: UpdateEnrollmentData
): Promise<Enrollment> {
  return api.patch<Enrollment>(`/api/v1/enrollments/${enrollmentId}`, data);
}

/**
 * Delete an enrollment
 */
export async function deleteEnrollment(enrollmentId: string): Promise<void> {
  return api.delete<void>(`/api/v1/enrollments/${enrollmentId}`);
}

interface BulkEnrollmentData {
  sessionId: string;
  enrollments: Array<{ studentId: string; level: string }>;
}

/**
 * Bulk enroll students
 */
export async function bulkEnroll(data: BulkEnrollmentData): Promise<{ created: number; failed: number }> {
  return api.post<{ created: number; failed: number }>('/api/v1/enrollments/bulk', data);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get unique levels from enrollments
 */
export function getUniqueLevels(enrollments: EnrollmentWithDetails[]): string[] {
  const levels = new Set(enrollments.map((e) => e.level));
  return Array.from(levels).sort();
}

/**
 * Group enrollments by level
 */
export function groupEnrollmentsByLevel(
  enrollments: EnrollmentWithDetails[]
): Record<string, EnrollmentWithDetails[]> {
  const grouped: Record<string, EnrollmentWithDetails[]> = {};

  for (const enrollment of enrollments) {
    if (!grouped[enrollment.level]) {
      grouped[enrollment.level] = [];
    }
    grouped[enrollment.level].push(enrollment);
  }

  return grouped;
}

/**
 * Get enrollment count by level
 */
export function getEnrollmentCountByLevel(enrollments: EnrollmentWithDetails[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const enrollment of enrollments) {
    counts[enrollment.level] = (counts[enrollment.level] || 0) + 1;
  }

  return counts;
}
