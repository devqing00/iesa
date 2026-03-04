/**
 * Unit Applications Service
 * API functions for student unit/committee applications
 */

import { api, buildQueryString } from './client';

// ============================================
// Types
// ============================================

export type UnitType =
  | 'press'
  | 'ics'
  | 'committee_academic'
  | 'committee_welfare'
  | 'committee_sports'
  | 'committee_socials';

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected';

export const UNIT_LABELS: Record<UnitType, string> = {
  press: 'The IESA Press',
  ics: 'IESA Creative Studio',
  committee_academic: 'Academic Committee',
  committee_welfare: 'Welfare Committee',
  committee_sports: 'Sports Committee',
  committee_socials: 'Social Committee',
};

export const UNIT_DESCRIPTIONS: Record<UnitType, string> = {
  press: 'Join the editorial team — write articles, cover events, and shape the narrative of our department.',
  ics: 'Bring ideas to life — design graphics, create videos, and craft the visual identity of IESA.',
  committee_academic: 'Drive academic excellence — organize tutorials, study groups, and academic workshops.',
  committee_welfare: 'Champion student wellbeing — address welfare concerns and support fellow students.',
  committee_sports: 'Lead the charge in sports — organize tournaments, training sessions, and inter-departmental competitions.',
  committee_socials: 'Plan social events — parties, hangouts, and bonding activities that bring our department together.',
};

export const UNIT_COLORS: Record<UnitType, { bg: string; border: string; text: string; badge: string }> = {
  press: { bg: 'bg-lavender-light', border: 'border-lavender', text: 'text-navy', badge: 'bg-lavender' },
  ics: { bg: 'bg-coral-light', border: 'border-coral', text: 'text-navy', badge: 'bg-coral' },
  committee_academic: { bg: 'bg-teal-light', border: 'border-teal', text: 'text-navy', badge: 'bg-teal' },
  committee_welfare: { bg: 'bg-coral-light', border: 'border-coral', text: 'text-navy', badge: 'bg-coral' },
  committee_sports: { bg: 'bg-sunny-light', border: 'border-sunny', text: 'text-navy', badge: 'bg-sunny' },
  committee_socials: { bg: 'bg-lime-light', border: 'border-lime', text: 'text-navy', badge: 'bg-lime' },
};

export interface UnitApplication {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userLevel: number | null;
  unit: UnitType;
  unitLabel: string;
  motivation: string;
  skills: string | null;
  status: ApplicationStatus;
  feedback: string | null;
  reviewedBy: string | null;
  reviewerName: string | null;
  sessionId: string;
  createdAt: string;
  reviewedAt: string | null;
}

export interface CreateApplicationData {
  unit: UnitType;
  motivation: string;
  skills?: string;
}

export interface ReviewApplicationData {
  status: 'accepted' | 'rejected';
  feedback?: string;
}

// ============================================
// Student Endpoints
// ============================================

/**
 * Submit a new unit application
 */
export async function createApplication(data: CreateApplicationData): Promise<UnitApplication> {
  return api.post<UnitApplication>('/api/v1/unit-applications/', data, {
    successMessage: 'Application submitted successfully!',
  });
}

/**
 * Get current user's applications
 */
export async function getMyApplications(): Promise<UnitApplication[]> {
  return api.get<UnitApplication[]>('/api/v1/unit-applications/my');
}

// ============================================
// Admin / Review Endpoints
// ============================================

interface ListApplicationsParams {
  unit?: string;
  status?: string;
  search?: string;
  limit?: number;
  skip?: number;
}

export interface PaginatedApplications {
  items: UnitApplication[];
  total: number;
}

/**
 * List applications (admin/exco only)
 */
export async function listApplications(params: ListApplicationsParams = {}): Promise<PaginatedApplications> {
  const query = buildQueryString(params);
  return api.get<PaginatedApplications>(`/api/v1/unit-applications/${query}`);
}

/**
 * Review (accept/reject) an application
 */
export async function reviewApplication(applicationId: string, data: ReviewApplicationData): Promise<UnitApplication> {
  return api.patch<UnitApplication>(`/api/v1/unit-applications/${applicationId}/review`, data, {
    successMessage: `Application ${data.status}!`,
  });
}
