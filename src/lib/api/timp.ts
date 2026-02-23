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
}): Promise<MentorApplication[]> {
  const qs = buildQueryString(filters || {});
  return api.get<MentorApplication[]>(`${BASE}/applications${qs}`);
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
}): Promise<MentorshipPair[]> {
  const qs = buildQueryString(filters || {});
  return api.get<MentorshipPair[]>(`${BASE}/pairs${qs}`);
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
