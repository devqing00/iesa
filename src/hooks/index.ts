/**
 * Custom Hooks
 * 
 * Shared hooks for the IESA platform
 */

export {
  useQuery,
  useMutation,
  formatApiError,
  clearQueryCache,
  type QueryResult,
  type MutationResult,
} from './useQuery';

export {
  useAdminStats,
  useAnnouncements,
  useEvents,
  usePayments,
  useTimetableClasses,
  type AdminStatsResponse,
  type Announcement,
  type UpcomingEvent,
  type PaymentItem,
  type ClassSession,
} from './useData';
