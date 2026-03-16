/**
 * IEPOD (IESA Professional Development Hub) API service
 *
 * "Forge the Future Series" — Process Drivers: Your Process, Our Progress.
 */

import { api, buildQueryString } from "./client";

// ── Types ────────────────────────────────────────────────────────────

export type IepodPhase = "stimulate" | "carve" | "pitch";
export type RegistrationStatus = "pending" | "approved" | "rejected";
export type TeamStatus = "forming" | "active" | "submitted" | "disqualified";
export type SubmissionStatus = "draft" | "submitted" | "reviewed" | "finalist";
export type QuizType = "unfractured_focus" | "process_breakdown" | "general" | "live";

// Society
export interface Society {
  _id: string;
  name: string;
  shortName: string;
  description: string;
  focusArea: string;
  leadName?: string | null;
  leadEmail?: string | null;
  hubLead?: {
    userId: string;
    name: string;
    email: string;
  } | null;
  hubLeadName?: string | null;
  hubLeadEmail?: string | null;
  color: string;
  iconUrl?: string | null;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSocietyData {
  name: string;
  shortName: string;
  description: string;
  focusArea: string;
  leadName?: string;
  leadEmail?: string;
  color?: string;
}

// Registration
export interface IepodRegistration {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  sessionId: string;
  interests: string[];
  whyJoin: string;
  priorExperience?: string | null;
  preferredSocietyId?: string | null;
  level: string;
  department?: string;
  isExternalStudent?: boolean;
  externalFaculty?: string | null;
  status: RegistrationStatus;
  phase: IepodPhase;
  adminNote?: string | null;
  societyId?: string | null;
  points: number;
  completedPhases: IepodPhase[];
  nicheAuditId?: string | null;
  teamId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterData {
  interests: string[];
  whyJoin: string;
  priorExperience?: string;
  preferredSocietyId?: string;
}

// Niche Audit
export interface NicheAudit {
  _id: string;
  userId: string;
  userName: string;
  sessionId: string;
  focusProblem: string;
  targetAudience: string;
  constraints: string;
  proposedApproach: string;
  relevantSkills: string[];
  relatedSociety?: string | null;
  inspirations?: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface CreateNicheAuditData {
  focusProblem: string;
  targetAudience: string;
  constraints: string;
  proposedApproach: string;
  relevantSkills?: string[];
  relatedSociety?: string;
  inspirations?: string;
}

// Teams
export interface TeamMember {
  userId: string;
  userName: string;
  role: string;
  joinedAt: string;
}

export interface IepodTeam {
  _id: string;
  name: string;
  problemStatement: string;
  maxMembers: number;
  leaderId: string;
  leaderName: string;
  sessionId: string;
  members: TeamMember[];
  status: TeamStatus;
  submissionCount: number;
  mentorId?: string | null;
  mentorName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamData {
  name: string;
  problemStatement: string;
  maxMembers?: number;
}

// Submissions
export interface IepodSubmission {
  _id: string;
  teamId: string;
  teamName: string;
  sessionId: string;
  title: string;
  description: string;
  processLog: string;
  attachmentUrls: string[];
  iterationNumber: number;
  status: SubmissionStatus;
  feedback?: string | null;
  score?: number | null;
  reviewedBy?: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface CreateSubmissionData {
  title: string;
  description: string;
  processLog: string;
  attachmentUrls?: string[];
  iterationNumber?: number;
}

export interface ReviewSubmissionData {
  status: SubmissionStatus;
  feedback?: string;
  score?: number;
}

// Quizzes
export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string | null;
  points: number;
}

export interface QuizQuestionPublic {
  index: number;
  question: string;
  options: string[];
  points: number;
}

export interface IepodQuiz {
  _id?: string;
  id?: string;
  title: string;
  description?: string | null;
  quizType: QuizType;
  questions?: QuizQuestion[];
  timeLimitMinutes?: number | null;
  isLive: boolean;
  phase?: IepodPhase | null;
  sessionId?: string;
  createdBy?: string;
  participantCount?: number;
  questionCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateQuizData {
  title: string;
  description?: string;
  quizType: QuizType;
  questions: QuizQuestion[];
  timeLimitMinutes?: number;
  isLive?: boolean;
  phase?: IepodPhase;
}

export interface QuizAnswer {
  questionIndex: number;
  selectedOption: number;
}

export interface QuizResult {
  _id: string;
  quizId: string;
  userId: string;
  userName: string;
  answers: QuizAnswer[];
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
}

// Points & Leaderboard
export interface PointEntry {
  _id: string;
  userId: string;
  userName: string;
  action: string;
  points: number;
  description: string;
  awardedAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalPoints: number;
  rank: number;
  phase?: IepodPhase | null;
  societyName?: string | null;
}

// My Profile
export interface MyIepodProfile {
  registered: boolean;
  registration?: IepodRegistration;
  society?: Society | null;
  nicheAudit?: NicheAudit | null;
  team?: IepodTeam | null;
  pointsHistory?: PointEntry[];
  quizResults?: QuizResult[];
}

// Stats
export interface IepodStats {
  totalRegistrations: number;
  pending: number;
  approved: number;
  rejected: number;
  phases: { stimulate: number; carve: number; pitch: number };
  totalTeams: number;
  totalSubmissions: number;
  totalQuizzes: number;
  totalNicheAudits: number;
  totalSocieties: number;
  societyBreakdown: {
    societyId: string;
    societyName: string;
    memberCount: number;
    hubLeadName?: string | null;
    hubLeadEmail?: string | null;
  }[];
}

// ── Constants ────────────────────────────────────────────────────────

export const PHASE_LABELS: Record<IepodPhase, string> = {
  stimulate: "Stimulate the Mind",
  carve: "Carve Your Niche",
  pitch: "Pitch Your Process",
};

export const PHASE_STYLES: Record<IepodPhase, { bg: string; text: string; border: string }> = {
  stimulate: { bg: "bg-lavender-light", text: "text-lavender", border: "border-lavender" },
  carve: { bg: "bg-teal-light", text: "text-teal", border: "border-teal" },
  pitch: { bg: "bg-coral-light", text: "text-coral", border: "border-coral" },
};

export const REG_STATUS_STYLES: Record<RegistrationStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-sunny-light", text: "text-navy", label: "Pending" },
  approved: { bg: "bg-teal-light", text: "text-teal", label: "Approved" },
  rejected: { bg: "bg-coral-light", text: "text-coral", label: "Rejected" },
};

export const TEAM_STATUS_STYLES: Record<TeamStatus, { bg: string; text: string; label: string }> = {
  forming: { bg: "bg-sunny-light", text: "text-navy", label: "Forming" },
  active: { bg: "bg-teal-light", text: "text-teal", label: "Active" },
  submitted: { bg: "bg-lavender-light", text: "text-lavender", label: "Submitted" },
  disqualified: { bg: "bg-coral-light", text: "text-coral", label: "Disqualified" },
};

export const SUBMISSION_STATUS_STYLES: Record<SubmissionStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-cloud", text: "text-slate", label: "Draft" },
  submitted: { bg: "bg-sunny-light", text: "text-navy", label: "Submitted" },
  reviewed: { bg: "bg-teal-light", text: "text-teal", label: "Reviewed" },
  finalist: { bg: "bg-lime-light", text: "text-navy", label: "Finalist" },
};

export const QUIZ_TYPE_LABELS: Record<QuizType, string> = {
  unfractured_focus: "Unfractured Focus",
  process_breakdown: "Process Breakdown",
  general: "General",
  live: "Live Quiz",
};

// ── API Functions ────────────────────────────────────────────────────

const BASE = "/api/v1/iepod";

// ── My Profile ──────────────────────────────────────────────────────

export async function getMyIepodProfile(): Promise<MyIepodProfile> {
  return api.get<MyIepodProfile>(`${BASE}/my`);
}

// ── Registration ────────────────────────────────────────────────────

export async function registerForIepod(data: RegisterData): Promise<IepodRegistration> {
  return api.post<IepodRegistration>(`${BASE}/register`, data);
}

// ── Societies ───────────────────────────────────────────────────────

export async function listSocieties(activeOnly = true): Promise<Society[]> {
  return api.get<Society[]>(`${BASE}/societies?active_only=${activeOnly}`);
}

export async function createSociety(data: CreateSocietyData): Promise<Society> {
  return api.post<Society>(`${BASE}/societies`, data);
}

export async function updateSociety(id: string, data: Partial<CreateSocietyData>): Promise<Society> {
  return api.patch<Society>(`${BASE}/societies/${id}`, data);
}

export async function deleteSociety(id: string): Promise<void> {
  return api.delete(`${BASE}/societies/${id}`);
}

export async function commitToSociety(societyId: string): Promise<{ message: string }> {
  return api.post<{ message: string }>(`${BASE}/commit-society/${societyId}`, {});
}

// ── Niche Audit ─────────────────────────────────────────────────────

export async function getMyNicheAudit(): Promise<NicheAudit | null> {
  return api.get<NicheAudit | null>(`${BASE}/niche-audit`);
}

export async function createNicheAudit(data: CreateNicheAuditData): Promise<NicheAudit> {
  return api.post<NicheAudit>(`${BASE}/niche-audit`, data);
}

export async function updateNicheAudit(data: Partial<CreateNicheAuditData>): Promise<NicheAudit> {
  return api.patch<NicheAudit>(`${BASE}/niche-audit`, data);
}

// ── Teams ───────────────────────────────────────────────────────────

export async function listTeams(filters?: {
  status?: string; search?: string;
}): Promise<{ teams: IepodTeam[]; total: number }> {
  const qs = buildQueryString(filters || {});
  return api.get(`${BASE}/teams${qs}`);
}

export async function getTeam(id: string): Promise<IepodTeam> {
  return api.get<IepodTeam>(`${BASE}/teams/${id}`);
}

export async function createTeam(data: CreateTeamData): Promise<IepodTeam> {
  return api.post<IepodTeam>(`${BASE}/teams`, data);
}

export async function joinTeam(teamId: string): Promise<{ message: string }> {
  return api.post<{ message: string }>(`${BASE}/teams/${teamId}/join`, {});
}

export async function leaveTeam(teamId: string): Promise<{ message: string }> {
  return api.post<{ message: string }>(`${BASE}/teams/${teamId}/leave`, {});
}

export async function updateTeam(id: string, data: Partial<CreateTeamData>): Promise<IepodTeam> {
  return api.patch<IepodTeam>(`${BASE}/teams/${id}`, data);
}

// ── Submissions ─────────────────────────────────────────────────────

export async function createSubmission(teamId: string, data: CreateSubmissionData): Promise<IepodSubmission> {
  return api.post<IepodSubmission>(`${BASE}/teams/${teamId}/submissions`, data);
}

export async function listTeamSubmissions(teamId: string): Promise<IepodSubmission[]> {
  return api.get<IepodSubmission[]>(`${BASE}/teams/${teamId}/submissions`);
}

export async function submitIteration(subId: string): Promise<{ message: string }> {
  return api.patch<{ message: string }>(`${BASE}/submissions/${subId}/submit`, {});
}

// ── Quizzes ─────────────────────────────────────────────────────────

export async function listQuizzes(filters?: {
  live_only?: boolean; quiz_type?: string;
}): Promise<IepodQuiz[]> {
  const qs = buildQueryString(filters || {});
  return api.get<IepodQuiz[]>(`${BASE}/quizzes${qs}`);
}

export async function getQuiz(id: string): Promise<
  | (IepodQuiz & { questions: QuizQuestionPublic[]; alreadyTaken: false })
  | { alreadyTaken: true; result: QuizResult }
  | IepodQuiz
> {
  return api.get(`${BASE}/quizzes/${id}`);
}

export async function submitQuizAnswers(quizId: string, answers: QuizAnswer[]): Promise<QuizResult> {
  return api.post<QuizResult>(`${BASE}/quizzes/${quizId}/answer`, { answers });
}

export async function createQuiz(data: CreateQuizData): Promise<IepodQuiz> {
  return api.post<IepodQuiz>(`${BASE}/quizzes`, data);
}

export async function updateQuiz(id: string, data: Partial<CreateQuizData>): Promise<IepodQuiz> {
  return api.patch<IepodQuiz>(`${BASE}/quizzes/${id}`, data);
}

export async function deleteQuiz(id: string): Promise<void> {
  return api.delete(`${BASE}/quizzes/${id}`);
}

// ── Leaderboard ─────────────────────────────────────────────────────

export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  return api.get<LeaderboardEntry[]>(`${BASE}/leaderboard?limit=${limit}`);
}

// ── Admin ───────────────────────────────────────────────────────────

export async function listRegistrations(filters?: {
  status?: string; phase?: string; department?: string; search?: string; limit?: number; skip?: number;
}): Promise<{ registrations: IepodRegistration[]; total: number }> {
  const qs = buildQueryString(filters || {});
  return api.get(`${BASE}/registrations${qs}`);
}

export async function getRegistration(id: string): Promise<IepodRegistration> {
  return api.get<IepodRegistration>(`${BASE}/registrations/${id}`);
}

export async function updateRegistration(id: string, data: {
  status?: RegistrationStatus; adminNote?: string; phase?: IepodPhase;
}): Promise<IepodRegistration> {
  return api.patch<IepodRegistration>(`${BASE}/registrations/${id}`, data);
}

export async function listNicheAudits(filters?: {
  search?: string; limit?: number; skip?: number;
}): Promise<{ audits: NicheAudit[]; total: number }> {
  const qs = buildQueryString(filters || {});
  return api.get(`${BASE}/niche-audits${qs}`);
}

export async function listAllSubmissions(filters?: {
  team_id?: string; status?: string; limit?: number; skip?: number;
}): Promise<{ submissions: IepodSubmission[]; total: number }> {
  const qs = buildQueryString(filters || {});
  return api.get(`${BASE}/submissions${qs}`);
}

export async function reviewSubmission(id: string, data: ReviewSubmissionData): Promise<IepodSubmission> {
  return api.patch<IepodSubmission>(`${BASE}/submissions/${id}/review`, data);
}

export async function getQuizResults(quizId: string): Promise<QuizResult[]> {
  return api.get<QuizResult[]>(`${BASE}/quizzes/${quizId}/results`);
}

export async function assignMentor(teamId: string, mentorUserId: string): Promise<{ message: string }> {
  return api.post<{ message: string }>(`${BASE}/teams/${teamId}/assign-mentor?mentor_user_id=${mentorUserId}`, {});
}

export async function awardBonusPoints(data: {
  userId: string; points: number; description: string;
}): Promise<{ message: string }> {
  return api.post<{ message: string }>(`${BASE}/points/award`, data);
}

export async function getIepodStats(): Promise<IepodStats> {
  return api.get<IepodStats>(`${BASE}/stats`);
}
