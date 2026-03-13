/**
 * TIMP (The IESA Mentoring Project) API service
 */

import { api, buildQueryString } from "./client";

// ── Types ────────────────────────────────────────────────────────────

export type MentorApplicationStatus = "pending" | "approved" | "rejected";
export type PairStatus = "active" | "paused" | "completed";

export interface MentorApplication {
  id: string;
  userId: string;
  userName: string;
  userLevel?: number | null;
  motivation: string;
  skills: string;
  availability: string;
  maxMentees: number;
  status: MentorApplicationStatus;
  feedback?: string | null;
  sessionId: string;
  reviewedBy?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface MentorshipPair {
  id: string;
  mentorId: string;
  mentorName: string;
  menteeId: string;
  menteeName: string;
  status: PairStatus;
  sessionId: string;
  feedbackCount: number;
  createdAt: string;
  updatedAt?: string | null;
}

export interface TimpFeedback {
  id: string;
  pairId: string;
  submittedBy: string;
  submitterName: string;
  submitterRole: "mentor" | "mentee";
  rating: number;
  notes: string;
  concerns?: string | null;
  topicsCovered?: string[] | null;
  weekNumber: number;
  createdAt: string;
}

export interface MyTimpInfo {
  application: MentorApplication | null;
  pairs: MentorshipPair[];
  isMentor: boolean;
  isMentee: boolean;
  formOpen: boolean;
  userLevel: number | null;
}

export interface ApplyAsMentorData {
  motivation: string;
  skills: string;
  availability: string;
  maxMentees?: number;
}

export interface ReviewMentorData {
  status: MentorApplicationStatus;
  feedback?: string;
}

export interface CreatePairData {
  mentorId: string;
  menteeId: string;
}

export interface SubmitFeedbackData {
  rating: number;
  notes: string;
  concerns?: string;
  topicsCovered?: string[];
}

// ── Constants ────────────────────────────────────────────────────────

export const APPLICATION_STATUS_STYLES: Record<
  MentorApplicationStatus,
  { bg: string; text: string; label: string }
> = {
  pending: { bg: "bg-sunny-light", text: "text-navy", label: "Pending" },
  approved: { bg: "bg-teal-light", text: "text-teal", label: "Approved" },
  rejected: { bg: "bg-coral-light", text: "text-coral", label: "Rejected" },
};

export const PAIR_STATUS_STYLES: Record<
  PairStatus,
  { bg: string; text: string; label: string }
> = {
  active: { bg: "bg-teal-light", text: "text-teal", label: "Active" },
  paused: { bg: "bg-sunny-light", text: "text-navy", label: "Paused" },
  completed: { bg: "bg-lavender-light", text: "text-lavender", label: "Completed" },
};

export interface PaginatedMentorApplications {
  items: MentorApplication[];
  total: number;
}

export interface PaginatedPairs {
  items: MentorshipPair[];
  total: number;
}

// ── API Functions ────────────────────────────────────────────────────

const BASE = "/api/v1/timp";

// Mentor applications
export async function applyAsMentor(data: ApplyAsMentorData): Promise<MentorApplication> {
  return api.post<MentorApplication>(`${BASE}/apply`, data);
}

export async function getMyApplication(): Promise<MentorApplication | null> {
  return api.get<MentorApplication | null>(`${BASE}/my-application`);
}

export async function listMentorApplications(filters?: {
  status?: string;
  search?: string;
  limit?: number;
  skip?: number;
}): Promise<PaginatedMentorApplications> {
  const qs = buildQueryString(filters || {});
  return api.get<PaginatedMentorApplications>(`${BASE}/applications${qs}`);
}

export async function reviewMentorApplication(
  id: string,
  data: ReviewMentorData
): Promise<MentorApplication> {
  return api.patch<MentorApplication>(`${BASE}/applications/${id}/review`, data);
}

// Pairs
export async function createPair(data: CreatePairData): Promise<MentorshipPair> {
  return api.post<MentorshipPair>(`${BASE}/pairs`, data);
}

export async function listPairs(filters?: {
  status?: string;
  search?: string;
  limit?: number;
  skip?: number;
}): Promise<PaginatedPairs> {
  const qs = buildQueryString(filters || {});
  return api.get<PaginatedPairs>(`${BASE}/pairs${qs}`);
}

export async function updatePairStatus(
  pairId: string,
  status: PairStatus
): Promise<MentorshipPair> {
  return api.patch<MentorshipPair>(`${BASE}/pairs/${pairId}/status?status=${status}`, {});
}

// Feedback
export async function submitTimpFeedback(
  pairId: string,
  data: SubmitFeedbackData
): Promise<TimpFeedback> {
  return api.post<TimpFeedback>(`${BASE}/pairs/${pairId}/feedback`, data);
}

export async function getPairFeedback(pairId: string): Promise<TimpFeedback[]> {
  return api.get<TimpFeedback[]>(`${BASE}/pairs/${pairId}/feedback`);
}

// My info
export async function getMyTimpInfo(): Promise<MyTimpInfo> {
  return api.get<MyTimpInfo>(`${BASE}/my`);
}

// Settings
export async function getTimpSettings(): Promise<{ formOpen: boolean }> {
  return api.get<{ formOpen: boolean }>(`${BASE}/settings`);
}

export async function updateTimpSettings(formOpen: boolean): Promise<{ formOpen: boolean }> {
  return api.patch<{ formOpen: boolean }>(`${BASE}/settings?formOpen=${formOpen}`, {});
}


// ── Admin enriched data ──────────────────────────────────────────

export interface EnrichedMentor {
  applicationId: string;
  userId: string;
  userName: string;
  email: string;
  matricNumber: string;
  level: string | null;
  gender?: string | null;
  phone: string | null;
  skills: string;
  availability: string;
  motivation: string;
  maxMentees: number;
  activePairs: number;
  isFull: boolean;
  profilePictureUrl: string | null;
}

export interface MenteeCandidate {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  matricNumber: string;
  level: string;
  gender?: string | null;
  phone: string | null;
  profilePictureUrl: string | null;
  alreadyPaired: boolean;
}

export interface TimpUserDetails {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  matricNumber: string;
  level: string | null;
  phone: string | null;
  bio: string | null;
  skills: string[];
  profilePictureUrl: string | null;
  application: MentorApplication | null;
  pairs: MentorshipPair[];
}

export async function getEnrichedMentors(search?: string): Promise<{ items: EnrichedMentor[]; total: number }> {
  const qs = search ? buildQueryString({ search }) : "";
  return api.get<{ items: EnrichedMentor[]; total: number }>(`${BASE}/admin/mentors${qs}`);
}

export async function getMenteeCandidates(search?: string): Promise<{ items: MenteeCandidate[]; total: number }> {
  const qs = search ? buildQueryString({ search }) : "";
  return api.get<{ items: MenteeCandidate[]; total: number }>(`${BASE}/admin/mentee-candidates${qs}`);
}

export async function getTimpUserDetails(userId: string): Promise<TimpUserDetails> {
  return api.get<TimpUserDetails>(`${BASE}/admin/user/${userId}`);
}


// ── Analytics ────────────────────────────────────────────────────────

export interface TimpAnalytics {
  applications: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    approvalRate: number;
  };
  pairs: {
    active: number;
    paused: number;
    completed: number;
    total: number;
  };
  feedback: {
    total: number;
    averageRating: number;
  };
}

export async function getTimpAnalytics(): Promise<TimpAnalytics> {
  return api.get<TimpAnalytics>(`${BASE}/analytics`);
}


// ── Messaging ────────────────────────────────────────────────────────

export interface TimpMessage {
  _id: string;
  pairId: string;
  senderId: string;
  senderName: string;
  senderRole: "mentor" | "mentee";
  content: string;
  createdAt: string;
}

export async function getPairMessages(pairId: string, limit?: number): Promise<TimpMessage[]> {
  const qs = limit ? `?limit=${limit}` : "";
  return api.get<TimpMessage[]>(`${BASE}/pairs/${pairId}/messages${qs}`);
}

export async function sendPairMessage(pairId: string, content: string): Promise<{ message: string }> {
  return api.post<{ message: string }>(`${BASE}/pairs/${pairId}/messages`, { content });
}
