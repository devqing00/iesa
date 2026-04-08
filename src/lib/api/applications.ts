/**
 * Team Applications Service
 * API functions for student team applications.
 *
 * Teams are fetched dynamically from the backend registry —
 * no hardcoded list of team slugs exists on the frontend.
 */

import { api, buildQueryString } from './client';

// ============================================
// Types
// ============================================

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'revoked';

/** A single entry returned by GET /api/v1/teams/registry */
export interface TeamRegistryEntry {
  slug: string;
  label: string;
  description: string;
  colorKey: string;
  requiresSkills: boolean;
  subTeams: string[] | null;
  customQuestions: { key: string; label: string; type?: string }[] | null;
  isHub: boolean;
  hubPath: string | null;
  isBuiltIn: boolean;
}

export interface TeamApplication {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userLevel: string | null;
  team: string;
  teamLabel: string;
  motivation: string;
  skills: string | null;
  subTeam: string | null;
  customAnswers: Record<string, unknown> | null;
  status: ApplicationStatus;
  feedback: string | null;
  rejectionTag: "warning" | "take_note" | "other" | null;
  reviewedBy: string | null;
  reviewerName: string | null;
  sessionId: string;
  createdAt: string;
  reviewedAt: string | null;
}

export interface CreateApplicationData {
  team: string;
  motivation: string;
  skills?: string;
  subTeam?: string;
  customAnswers?: Record<string, unknown>;
}

export interface ReviewApplicationData {
  status: 'accepted' | 'rejected';
  feedback?: string;
  rejectionTag?: "warning" | "take_note" | "other";
}

// ── Color map ──────────────────────────────────────────────────
// Maps colorKey (returned by registry) → Tailwind utility classes.
const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  coral:    { bg: 'bg-coral-light',    border: 'border-coral',    text: 'text-navy', badge: 'bg-coral' },
  teal:    { bg: 'bg-teal-light',     border: 'border-teal',     text: 'text-navy', badge: 'bg-teal' },
  lavender:{ bg: 'bg-lavender-light', border: 'border-lavender', text: 'text-navy', badge: 'bg-lavender' },
  sunny:   { bg: 'bg-sunny-light',    border: 'border-sunny',    text: 'text-navy', badge: 'bg-sunny' },
  lime:    { bg: 'bg-lime-light',     border: 'border-lime',     text: 'text-navy', badge: 'bg-lime' },
  slate:   { bg: 'bg-ghost',          border: 'border-cloud',    text: 'text-navy', badge: 'bg-cloud' },
};

const FALLBACK_COLOR = { bg: 'bg-ghost', border: 'border-cloud', text: 'text-navy', badge: 'bg-cloud' };

/** Resolve Tailwind color classes from a colorKey */
export function getTeamColors(colorKey: string) {
  return COLOR_MAP[colorKey] ?? FALLBACK_COLOR;
}

// ── Legacy re-exports (for pages that haven't migrated yet) ─────
/** @deprecated Use TeamApplication */
export type UnitApplication = TeamApplication;
/** @deprecated Use string team slug */
export type UnitType = string;

/** @deprecated Use fetchTeamRegistry + getTeamColors */
export const UNIT_LABELS: Record<string, string> = {};
/** @deprecated */
export const UNIT_DESCRIPTIONS: Record<string, string> = {};
/** @deprecated Use getTeamColors */
export const UNIT_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {};

// ============================================
// Registry Endpoint
// ============================================

/**
 * Fetch the team registry (public — all built-in + custom teams)
 */
export async function fetchTeamRegistry(): Promise<TeamRegistryEntry[]> {
  return api.get<TeamRegistryEntry[]>('/api/v1/teams/registry');
}

// ============================================
// Student Endpoints
// ============================================

/**
 * Submit a new team application
 */
export async function createApplication(data: CreateApplicationData): Promise<TeamApplication> {
  return api.post<TeamApplication>('/api/v1/team-applications/', data, {
    successMessage: 'Application submitted successfully!',
  });
}

/**
 * Get current user's applications
 */
export async function getMyApplications(): Promise<TeamApplication[]> {
  return api.get<TeamApplication[]>('/api/v1/team-applications/my');
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
  items: TeamApplication[];
  total: number;
}

/**
 * List applications (admin/exco only)
 */
export async function listApplications(params: ListApplicationsParams = {}): Promise<PaginatedApplications> {
  const query = buildQueryString(params);
  return api.get<PaginatedApplications>(`/api/v1/team-applications/${query}`);
}

/**
 * Review (accept/reject) an application
 */
export async function reviewApplication(applicationId: string, data: ReviewApplicationData): Promise<TeamApplication> {
  return api.patch<TeamApplication>(`/api/v1/team-applications/${applicationId}/review`, data, {
    successMessage: `Application ${data.status}!`,
  });
}
