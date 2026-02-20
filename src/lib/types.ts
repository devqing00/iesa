/**
 * Centralized TypeScript types for the IESA platform.
 * Import from "@/lib/types" across all components.
 */

/* ─── Auth & Users ──────────────────────── */

export type UserRole = "student" | "exco" | "admin";

export interface User {
  _id: string;
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  level?: string;
  department?: string;
  phone?: string;
  bio?: string;
  skills?: string[];
  profilePictureUrl?: string;
  matricNumber?: string;
  admissionYear?: number;
  isActive?: boolean;
  emailVerified?: boolean;
  hasCompletedOnboarding?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/* ─── Sessions ───────────────────────────── */

export interface Session {
  id: string;
  _id?: string;
  name: string;
  startDate?: string;
  endDate?: string;
  currentSemester: 1 | 2;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SessionCreate {
  name: string;
  startDate: string;
  endDate: string;
  currentSemester: 1 | 2;
  isActive?: boolean;
}

export interface SessionUpdate {
  name?: string;
  startDate?: string;
  endDate?: string;
  currentSemester?: 1 | 2;
  isActive?: boolean;
}

/* ─── Announcements ─────────────────────── */

export type Priority = "low" | "normal" | "high" | "urgent";

export interface Announcement {
  _id: string;
  id?: string;
  title: string;
  content: string;
  priority: Priority;
  targetLevels?: string[] | null;
  isPinned: boolean;
  sessionId: string;
  authorId?: string;
  authorName?: string;
  readBy?: string[];
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AnnouncementWithStatus extends Announcement {
  isRead: boolean;
}

/* ─── Events ─────────────────────────────── */

export type EventCategory = "Academic" | "Social" | "Career" | "Workshop" | "Competition" | "Other";

export interface Event {
  _id: string;
  id?: string;
  title: string;
  description: string;
  date: string;
  location: string;
  category: EventCategory;
  maxAttendees?: number;
  registeredCount?: number;
  registrations?: string[];
  imageUrl?: string;
  requiresPayment?: boolean;
  paymentAmount?: number;
  registrationDeadline?: string;
  sessionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/* ─── Payments ───────────────────────────── */

export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";
export type PaymentType = "dues" | "event" | "other";

export interface Payment {
  _id: string;
  id?: string;
  userId: string;
  userName?: string;
  amount: number;
  currency?: string;
  type: PaymentType;
  status: PaymentStatus;
  reference?: string;
  sessionId: string;
  description?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt?: string;
}

/* ─── Enrollments ────────────────────────── */

export type EnrollmentStatus = "active" | "inactive" | "graduated";

export interface Enrollment {
  _id: string;
  id?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  level: string;
  sessionId: string;
  status: EnrollmentStatus;
  createdAt?: string;
  updatedAt?: string;
}

/* ─── Roles ──────────────────────────────── */

export interface Role {
  _id: string;
  id?: string;
  userId: string;
  userName?: string;
  position: string;
  sessionId: string;
  isActive: boolean;
  permissions?: string[];
  createdAt?: string;
}

/* ─── Resources (File Management) ──────── */

export type ResourceCategory = "lecture_notes" | "past_questions" | "meeting_minutes" | "handbooks" | "forms" | "other";

export interface Resource {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  category: ResourceCategory;
  sessionId?: string;
  uploadedBy?: string;
  uploaderName?: string;
  downloadCount?: number;
  createdAt: string;
  updatedAt?: string;
}

/* ─── Notifications ────────────────────── */

export type NotificationType = "announcement" | "event" | "payment" | "enrollment" | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  href?: string;
  isRead: boolean;
  createdAt: string;
}

/* ─── Pagination ─────────────────────────── */

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

/* ─── API ─────────────────────────────────── */

export interface ApiError {
  detail: string;
  status?: number;
}

/* ─── Dashboard Stats ──────────────────── */

export interface DashboardStats {
  totalStudents: number;
  totalEnrollments: number;
  totalPayments: number;
  totalEvents: number;
  totalAnnouncements: number;
  activeSession: string | null;
  recentPayments?: Payment[];
  enrollmentsByLevel?: Record<string, number>;
  paymentsByMonth?: { month: string; count: number; amount: number }[];
}
