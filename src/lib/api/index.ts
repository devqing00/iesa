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
  getWsUrl,
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
// Team Applications
export {
  createApplication,
  getMyApplications,
  listApplications,
  reviewApplication,
  fetchTeamRegistry,
  getTeamColors,
  UNIT_LABELS,
  UNIT_DESCRIPTIONS,
  UNIT_COLORS,
} from './applications';

export type {
  TeamApplication,
  TeamRegistryEntry,
  UnitApplication,
  UnitType,
  ApplicationStatus,
  CreateApplicationData,
  ReviewApplicationData,
  PaginatedApplications,
} from './applications';

// Academic Calendar
export {
  listAcademicEvents,
  getAcademicEvent,
  createAcademicEvent,
  updateAcademicEvent,
  deleteAcademicEvent,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  ALL_EVENT_TYPES,
} from './academic-calendar';

export type {
  AcademicEvent,
  AcademicEventType,
  CreateAcademicEventData,
  UpdateAcademicEventData,
} from './academic-calendar';

// TIMP Mentoring
export {
  applyAsMentor,
  getMyApplication,
  listMentorApplications,
  reviewMentorApplication,
  createPair,
  listPairs,
  updatePairStatus,
  submitTimpFeedback,
  getPairFeedback,
  getMyTimpInfo,
  getTimpSettings,
  updateTimpSettings,
  getEnrichedMentors,
  getMenteeCandidates,
  getTimpUserDetails,
  getTimpAnalytics,
  getPairMessages,
  sendPairMessage,
  APPLICATION_STATUS_STYLES,
  PAIR_STATUS_STYLES,
} from './timp';

export type {
  MentorApplication,
  MentorApplicationStatus,
  MentorshipPair,
  PairStatus,
  TimpFeedback,
  MyTimpInfo,
  ApplyAsMentorData,
  ReviewMentorData,
  CreatePairData,
  SubmitFeedbackData,
  PaginatedMentorApplications,
  PaginatedPairs,
  EnrichedMentor,
  MenteeCandidate,
  TimpUserDetails,
  TimpAnalytics,
  TimpMessage,
} from './timp';

// Bank Transfers
export {
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  submitTransferProof,
  submitEventBankTransfer,
  getMyTransfers,
  listAllTransfers,
  reviewTransfer,
  getTransferById,
  checkTransactionReference,
  TRANSFER_STATUS_STYLES,
  NIGERIAN_BANKS,
} from './bank-transfers';

export type {
  BankAccount,
  BankTransfer,
  CreateBankAccountData,
  UpdateBankAccountData,
  SubmitTransferProofData,
  SubmitEventTransferData,
  ReviewTransferData,
} from './bank-transfers';
// ============================================
// Receipts
// ============================================

export {
  getReceiptData,
  getReceiptPdfUrl,
} from './receipts';

export type {
  ReceiptData,
  ReceiptEventData,
} from './receipts';

// IEPOD Professional Development Hub
export {
  getMyIepodProfile,
  registerForIepod,
  resubmitIepodRegistration,
  listSocieties,
  createSociety,
  updateSociety,
  deleteSociety,
  commitToSociety,
  getMyNicheAudit,
  createNicheAudit,
  updateNicheAudit,
  listTeams,
  getTeam,
  createTeam,
  joinTeam,
  leaveTeam,
  updateTeam,
  createSubmission,
  listTeamSubmissions,
  submitIteration,
  listQuizzes,
  getQuiz,
  submitQuizAnswers,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  startLiveQuizSession,
  joinLiveQuiz,
  setLiveQuizReadyState,
  getLiveQuizState,
  getLiveQuizParticipants,
  advanceLiveQuizQuestion,
  pauseLiveQuizSession,
  resumeLiveQuizSession,
  submitLiveQuizAnswer,
  getLiveQuizLeaderboard,
  getLiveQuizReplay,
  forceResyncLiveQuiz,
  revealLiveQuizResults,
  revealLiveQuizFinalTop3,
  endLiveQuizSession,
  getLeaderboard,
  getLeaderboardAdmin,
  getQuizSystemLeaderboard,
  getQuizSystemLeaderboardAdmin,
  searchIepodMembers,
  listBonusPointHistory,
  reverseBonusPoints,
  resetIepodUserData,
  listRegistrations,
  getRegistration,
  updateRegistration,
  listNicheAudits,
  listAllSubmissions,
  reviewSubmission,
  getQuizResults,
  assignMentor,
  awardBonusPoints,
  getIepodStats,
  PHASE_LABELS,
  PHASE_STYLES,
  REG_STATUS_STYLES,
  TEAM_STATUS_STYLES,
  SUBMISSION_STATUS_STYLES,
  QUIZ_TYPE_LABELS,
} from './iepod';

export type {
  IepodPhase,
  RegistrationStatus as IepodRegistrationStatus,
  TeamStatus as IepodTeamStatus,
  SubmissionStatus as IepodSubmissionStatus,
  QuizType as IepodQuizType,
  Society,
  CreateSocietyData,
  IepodRegistration,
  RegisterData,
  NicheAudit,
  CreateNicheAuditData,
  TeamMember as IepodTeamMember,
  IepodTeam,
  CreateTeamData,
  IepodSubmission,
  CreateSubmissionData,
  ReviewSubmissionData,
  QuizQuestion,
  QuizQuestionPublic,
  IepodQuiz,
  CreateQuizData,
  QuizAnswer,
  QuizResult,
  LiveQuizQuestion,
  LiveQuizState,
  LiveQuizWsPacket,
  LiveParticipant,
  LiveParticipantsResponse,
  LiveLeaderboardItem,
  LiveLeaderboardResponse,
  StartLiveQuizResponse,
  HostActionReceipt,
  LiveReplayStep,
  LiveReplayResponse,
  PointEntry,
  QuizPointEntry,
  LeaderboardEntry,
  QuizSystemLeaderboardEntry,
  PaginatedLeaderboardResponse,
  IepodMemberLookupEntry,
  BonusHistoryItem,
  MyIepodProfile,
  IepodStats,
} from './iepod';

// Growth Hub Tools
export {
  getGrowthData,
  saveGrowthData,
  deleteGrowthData,
  getAllGrowthData,
} from './growth';

export type { GrowthTool } from './growth';

// Google Drive Resource Browser
export {
  browseDriveFolder,
  getDriveFileMeta,
  getDriveStreamUrl,
  searchDrive,
  saveDriveProgress,
  getAllDriveProgress,
  getRecentDriveFiles,
  createDriveBookmark,
  deleteDriveBookmark,
  formatFileSize as formatDriveFileSize,
  formatDuration,
  formatSeconds,
  getFileTypeColor,
  getFileTypeLabel,
} from './drive';

export type {
  DriveItem,
  DriveBreadcrumb,
  BrowseResponse,
  FileMetaResponse,
  FileProgress,
  FileBookmark,
  SearchResponse as DriveSearchResponse,
  ProgressUpdatePayload,
  BookmarkPayload,
} from './drive';
