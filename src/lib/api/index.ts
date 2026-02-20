/**
 * API Service Layer
 * 
 * Centralized API client and service modules for the IESA platform.
 * Import from this file for all API interactions.
 * 
 * @example
 * ```ts
 * import { api, getAnnouncements, formatNaira } from '@/lib/api';
 * 
 * const announcements = await getAnnouncements();
 * ```
 */

// ============================================
// Client & Types
// ============================================

export {
  api,
  apiRequest,
  buildQueryString,
  getApiUrl,
  setTokenGetter,
  setSessionIdGetter,
  API_BASE_URL,
  ApiRequestError,
  NetworkError,
  TimeoutError,
} from './client';

export type {
  // Common
  ApiResponse,
  ApiError,
  PaginatedResponse,
  // User
  User,
  UserRole,
  UserUpdate,
  UserPermissions,
  // Session
  Session,
  SessionSummary,
  // Announcement
  Announcement,
  AnnouncementWithStatus,
  AnnouncementCreate,
  AnnouncementPriority,
  // Event
  EventData,
  EventWithStatus,
  EventCreate,
  EventCategory,
  // Payment
  Payment,
  PaymentWithStatus,
  Transaction,
  PaystackInitResponse,
  // Timetable
  ClassSession,
  ClassCancellation,
  WeeklySchedule,
  ClassType,
  // Resource
  Resource,
  ResourceType,
  // Role
  Role,
  RoleWithUser,
  PositionType,
  // Enrollment
  Enrollment,
  EnrollmentWithDetails,
  // Grade
  Course,
  Semester,
  Grade,
  CGPAResponse,
  // Chat
  ChatMessage,
  ChatResponse,
  // Dashboard
  DashboardStats,
} from './types';

// ============================================
// Service Modules
// ============================================

// Users
export {
  getCurrentUser,
  updateCurrentUser,
  getCurrentUserPermissions,
  uploadProfilePicture,
  listUsers,
  getUserById,
  changeUserRole,
  updateUserAcademicInfo,
  completeRegistration,
  checkMatricAvailable,
} from './users';

// Sessions
export {
  getAllSessions,
  getActiveSession,
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
  activateSession,
  updateSemester,
} from './sessions';

// Announcements
export {
  getAnnouncements,
  getAnnouncementById,
  getReadAnnouncementIds,
  markAnnouncementAsRead,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getUnreadCount,
  getPinnedAnnouncements,
  getUrgentAnnouncements,
} from './announcements';

// Events
export {
  getEvents,
  getEventById,
  getMyEventRegistrations,
  registerForEvent,
  unregisterFromEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getUpcomingEvents,
  getPastEvents,
  isRegistrationOpen,
  getRegistrationCount,
  isEventToday,
} from './events';

// Payments
export {
  getPayments,
  getPaymentById,
  recordManualPayment,
  createPayment,
  updatePayment,
  deletePayment,
  initializePaystackPayment,
  verifyPaystackPayment,
  getTransactions,
  downloadReceipt,
  getTotalOwed,
  getTotalPaid,
  getOverduePayments,
  hasOutstandingPayments,
  formatNaira,
} from './payments';

// Timetable
export {
  getClasses,
  getWeeklySchedule,
  getTodayClasses,
  createClass,
  updateClass,
  deleteClass,
  cancelClass,
  sortClassesByTime,
  groupClassesByDay,
  getNextClass,
  formatTimeRange,
  getClassTypeColor,
} from './timetable';

// Resources
export {
  getResources,
  getResourceById,
  trackDownload,
  addResource,
  approveResource,
  deleteResource,
  getResourceTypeName,
  getResourceTypeIcon,
  formatFileSize,
  groupResourcesByCourse,
  groupResourcesByType,
  getMostDownloaded,
  searchResources,
} from './resources';

// Enrollments
export {
  getEnrollments,
  getEnrollmentById,
  getMyEnrollments,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
  bulkEnroll,
  getUniqueLevels,
  groupEnrollmentsByLevel,
  getEnrollmentCountByLevel,
} from './enrollments';

// Roles
export {
  getRoles,
  getRoleById,
  getExecutives,
  getMyRoles,
  assignRole,
  updateRole,
  deleteRole,
  getPositionDisplayName,
  getPositionShortName,
  getExecutivePositions,
  isExecutivePosition,
  sortRolesByPosition,
} from './roles';

// AI Chat
export {
  sendMessage,
  getSuggestions,
  submitFeedback,
  formatChatHistory,
  getGreetingMessage,
  QUICK_ACTIONS,
  isScheduleQuery,
  isPaymentQuery,
  isEventQuery,
} from './chat';
