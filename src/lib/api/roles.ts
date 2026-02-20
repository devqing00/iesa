/**
 * Roles Service
 * API functions for EXCO role management
 */

import { api, buildQueryString } from './client';
import { Role, RoleWithUser, PositionType } from './types';

// ============================================
// Read Endpoints
// ============================================

interface ListRolesParams {
  sessionId?: string;
  position?: PositionType;
  isActive?: boolean;
}

/**
 * Get roles for a session
 */
export async function getRoles(params: ListRolesParams = {}): Promise<RoleWithUser[]> {
  const query = buildQueryString(params);
  return api.get<RoleWithUser[]>(`/api/v1/roles${query}`);
}

/**
 * Get role by ID
 */
export async function getRoleById(roleId: string): Promise<RoleWithUser> {
  return api.get<RoleWithUser>(`/api/v1/roles/${roleId}`);
}

/**
 * Get executives for a session
 */
export async function getExecutives(sessionId?: string): Promise<RoleWithUser[]> {
  const query = sessionId ? `?sessionId=${sessionId}` : '';
  return api.get<RoleWithUser[]>(`/api/v1/roles/executives${query}`);
}

/**
 * Get current user's roles
 */
export async function getMyRoles(): Promise<Role[]> {
  return api.get<Role[]>('/api/v1/roles/my-roles/current');
}

// ============================================
// Admin Endpoints
// ============================================

interface AssignRoleData {
  userId: string;
  position: PositionType;
  department?: string;
  level?: number;
  customTitle?: string;
  permissions?: string[];
}

/**
 * Assign a role to a user
 */
export async function assignRole(data: AssignRoleData): Promise<Role> {
  return api.post<Role>('/api/v1/roles', data);
}

interface UpdateRoleData {
  position?: PositionType;
  department?: string;
  level?: number;
  customTitle?: string;
  permissions?: string[];
  isActive?: boolean;
}

/**
 * Update a role
 */
export async function updateRole(roleId: string, data: UpdateRoleData): Promise<Role> {
  return api.patch<Role>(`/api/v1/roles/${roleId}`, data);
}

/**
 * Delete/revoke a role
 */
export async function deleteRole(roleId: string): Promise<void> {
  return api.delete<void>(`/api/v1/roles/${roleId}`);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get display name for a position
 */
export function getPositionDisplayName(position: PositionType): string {
  const names: Record<PositionType, string> = {
    president: 'President',
    vice_president: 'Vice President',
    general_secretary: 'General Secretary',
    assistant_general_secretary: 'Assistant General Secretary',
    financial_secretary: 'Financial Secretary',
    treasurer: 'Treasurer',
    public_relations_officer: 'PRO',
    director_of_socials: 'Director of Socials',
    director_of_sports: 'Director of Sports',
    director_of_welfare: 'Director of Welfare',
    class_rep: 'Class Representative',
    assistant_class_rep: 'Assistant Class Rep',
    other: 'Other',
  };
  return names[position] || position;
}

/**
 * Get short display name for a position
 */
export function getPositionShortName(position: PositionType): string {
  const names: Record<PositionType, string> = {
    president: 'President',
    vice_president: 'VP',
    general_secretary: 'Gen Sec',
    assistant_general_secretary: 'Asst Gen Sec',
    financial_secretary: 'Fin Sec',
    treasurer: 'Treasurer',
    public_relations_officer: 'PRO',
    director_of_socials: 'DoS',
    director_of_sports: 'DoSports',
    director_of_welfare: 'DoW',
    class_rep: 'Class Rep',
    assistant_class_rep: 'Asst Class Rep',
    other: 'Other',
  };
  return names[position] || position;
}

/**
 * Get executive positions (excludes class reps)
 */
export function getExecutivePositions(): PositionType[] {
  return [
    'president',
    'vice_president',
    'general_secretary',
    'assistant_general_secretary',
    'financial_secretary',
    'treasurer',
    'public_relations_officer',
    'director_of_socials',
    'director_of_sports',
    'director_of_welfare',
  ];
}

/**
 * Check if a position is an executive position
 */
export function isExecutivePosition(position: PositionType): boolean {
  return getExecutivePositions().includes(position);
}

/**
 * Sort roles by position priority
 */
export function sortRolesByPosition(roles: RoleWithUser[]): RoleWithUser[] {
  const priorityOrder: PositionType[] = [
    'president',
    'vice_president',
    'general_secretary',
    'assistant_general_secretary',
    'financial_secretary',
    'treasurer',
    'public_relations_officer',
    'director_of_socials',
    'director_of_sports',
    'director_of_welfare',
    'class_rep',
    'assistant_class_rep',
    'other',
  ];

  return [...roles].sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a.position);
    const bIndex = priorityOrder.indexOf(b.position);
    return aIndex - bIndex;
  });
}
