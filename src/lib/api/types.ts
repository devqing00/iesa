/**
 * API Type Definitions
 * Shared types for all API responses and requests
 */

// ============================================
// Common Types
// ============================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  detail: string;
  status: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ============================================
// User Types
// ============================================

export type UserRole = 'student' | 'admin' | 'exco';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  matricNumber?: string;
  department: string;
  phone?: string;
  role: UserRole;
  bio?: string;
  profilePictureUrl?: string;
  admissionYear?: number;
  currentLevel?: string;
  skills?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserPermissions {
  permissions: string[];
  session_id: string;
  session_name: string;
  is_admin: boolean;
}

export interface UserUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  skills?: string[];
}

// ============================================
// Session Types
// ============================================

export interface Session {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  currentSemester: 1 | 2;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  name: string;
  isActive: boolean;
}

// ============================================
// Announcement Types
// ============================================

export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  sessionId: string;
  priority: AnnouncementPriority;
  targetLevels: number[];
  isPinned: boolean;
  expiresAt?: string;
  authorId: string;
  authorName: string;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementWithStatus extends Announcement {
  isRead: boolean;
}

export interface AnnouncementCreate {
  title: string;
  content: string;
  priority?: AnnouncementPriority;
  targetLevels?: number[];
  isPinned?: boolean;
  expiresAt?: string;
}

// ============================================
// Event Types
// ============================================

export type EventCategory = 'Academic' | 'Social' | 'Career' | 'Workshop' | 'Competition' | 'Other';

export interface EventData {
  id: string;
  title: string;
  sessionId: string;
  date: string;
  location: string;
  category: EventCategory;
  description: string;
  maxAttendees?: number;
  registrationDeadline?: string;
  imageUrl?: string;
  requiresPayment: boolean;
  paymentAmount?: number;
  registrations: string[];
  attendees: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EventWithStatus extends EventData {
  isRegistered: boolean;
  hasAttended: boolean;
  isFull: boolean;
}

export interface EventCreate {
  title: string;
  date: string;
  location: string;
  category: EventCategory;
  description: string;
  maxAttendees?: number;
  registrationDeadline?: string;
  imageUrl?: string;
  requiresPayment?: boolean;
  paymentAmount?: number;
}

// ============================================
// Payment Types
// ============================================

export interface Payment {
  id: string;
  title: string;
  amount: number;
  sessionId: string;
  mandatory: boolean;
  deadline?: string;
  description?: string;
  category?: string;
  paidBy: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentWithStatus extends Payment {
  hasPaid: boolean;
  transactionId?: string;
}

export interface Transaction {
  id: string;
  studentId: string;
  paymentId: string;
  sessionId: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  status: 'pending' | 'success' | 'failed';
  verifiedBy?: string;
  verifiedAt?: string;
  receiptUrl?: string;
  receiptNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaystackInitResponse {
  authorization_url: string;
  reference: string;
  access_code: string;
}

// ============================================
// Timetable Types
// ============================================

export type ClassType = 'lecture' | 'practical' | 'tutorial';

export interface ClassSession {
  id: string;
  sessionId: string;
  courseCode: string;
  courseTitle: string;
  level: number;
  day: string;
  startTime: string;
  endTime: string;
  venue: string;
  lecturer?: string;
  type: ClassType;
  recurring: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClassCancellation {
  id: string;
  classSessionId: string;
  date: string;
  reason: string;
  cancelledBy: string;
  cancelledAt: string;
}

export interface WeeklySchedule {
  monday: ClassSession[];
  tuesday: ClassSession[];
  wednesday: ClassSession[];
  thursday: ClassSession[];
  friday: ClassSession[];
  saturday: ClassSession[];
  sunday: ClassSession[];
}

// ============================================
// Resource Types
// ============================================

export type ResourceType = 'slide' | 'pastQuestion' | 'video' | 'textbook' | 'note';

export interface Resource {
  id: string;
  sessionId: string;
  title: string;
  description?: string;
  type: ResourceType;
  courseCode: string;
  level: number;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploaderName: string;
  tags: string[];
  downloadCount: number;
  viewCount: number;
  isApproved: boolean;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Role Types
// ============================================

export type PositionType =
  | 'president'
  | 'vice_president'
  | 'general_secretary'
  | 'assistant_general_secretary'
  | 'financial_secretary'
  | 'treasurer'
  | 'public_relations_officer'
  | 'director_of_socials'
  | 'director_of_sports'
  | 'director_of_welfare'
  | 'class_rep'
  | 'assistant_class_rep'
  | 'other';

export interface Role {
  id: string;
  userId: string;
  sessionId: string;
  position: PositionType;
  department?: string;
  level?: number;
  customTitle?: string;
  permissions: string[];
  assignedAt: string;
  assignedBy: string;
  isActive: boolean;
}

export interface RoleWithUser extends Role {
  userName: string;
  userEmail: string;
  userMatric?: string;
  userProfilePicture?: string;
}

// ============================================
// Enrollment Types
// ============================================

export interface Enrollment {
  id: string;
  studentId: string;
  sessionId: string;
  level: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentWithDetails extends Enrollment {
  studentName: string;
  studentMatric: string;
  studentEmail: string;
  sessionName: string;
}

// ============================================
// Grade Types
// ============================================

export interface Course {
  code: string;
  title: string;
  units: number;
  score: number;
  gradePoint?: number;
  grade?: string;
}

export interface Semester {
  semesterNumber: 1 | 2;
  courses: Course[];
  gpa?: number;
}

export interface Grade {
  id: string;
  studentId: string;
  sessionId: string;
  level: string;
  semesters: Semester[];
  sessionGpa?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CGPAResponse {
  studentId: string;
  cgpa: number;
  totalUnits: number;
  sessions: Array<{
    sessionId: string;
    sessionName: string;
    gpa: number;
    units: number;
  }>;
}

// ============================================
// AI Chat Types
// ============================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  response: string;
  suggestions?: string[];
}

// ============================================
// Dashboard Stats Types
// ============================================

export interface DashboardStats {
  totalStudents: number;
  activeEvents: number;
  unreadAnnouncements: number;
  pendingPayments: number;
  upcomingClasses: number;
}
