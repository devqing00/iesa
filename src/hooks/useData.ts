/**
 * SWR-based data hooks for the IESA platform.
 *
 * These replace ad-hoc `fetch()` + `useState` + `useEffect` patterns in
 * dashboard pages with SWR's built-in caching, deduplication, revalidation,
 * and stale-while-revalidate semantics.
 *
 * All hooks use the authenticated API client ({@link api.get}) so they
 * automatically attach the Bearer token and session ID.
 *
 * @example
 * ```tsx
 * import { useAdminStats } from "@/hooks/useData";
 *
 * function AdminDashboard() {
 *   const { data, isLoading, error, mutate } = useAdminStats();
 *   // data is fully typed and cached globally
 * }
 * ```
 */

import useSWR, { type SWRConfiguration, preload } from "swr";
import { api } from "@/lib/api/client";

// ──────────────────────────────────────────────
// Shared SWR fetcher (uses the authenticated client)
// ──────────────────────────────────────────────

/**
 * Generic fetcher that calls `api.get<T>(endpoint)`.
 * SWR passes the key (endpoint string) as the first arg.
 */
async function apiFetcher<T>(endpoint: string): Promise<T> {
  return api.get<T>(endpoint, { showErrorToast: false });
}

// Shared SWR config defaults
const DEFAULT_CONFIG: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 30_000, // 30 s — deduplicate identical requests
  errorRetryCount: 2,
};

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface AdminStatsResponse {
  totalStudents: number;
  totalEnrollments: number;
  totalPayments: number;
  totalEvents: number;
  totalAnnouncements: number;
  activeSession: string | null;
  enrollmentsByLevel: { level: string; count: number }[];
  paymentsByStatus: { name: string; value: number }[];
  recentActivity: {
    id: string;
    action: string;
    actor: { name?: string; email?: string };
    resource: { type: string; name?: string };
    timestamp: string;
  }[];
  engagement?: {
    studyGroups: number;
    resources: number;
    pressArticles: number;
    aiChats: number;
    growthEntries: number;
    registrations7d: { date: string; count: number }[];
  };
}

export interface Announcement {
  _id?: string;
  id?: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  createdAt: string;
  authorName?: string;
  author?: { firstName: string; lastName: string };
}

export interface UpcomingEvent {
  _id?: string;
  id?: string;
  title: string;
  date: string;
  location?: string;
  category?: string;
}

export interface PaymentItem {
  _id?: string;
  id?: string;
  title: string;
  amount: number;
  deadline: string;
  hasPaid: boolean;
}

export interface ClassSession {
  _id?: string;
  courseCode: string;
  courseTitle: string;
  startTime: string;
  endTime: string;
  venue: string;
  day: string;
  classType: string;
}

export interface BirthdayCelebrant {
  _id: string;
  firstName: string;
  lastName: string;
  profilePictureUrl?: string;
  currentLevel?: string;
  department?: string;
  isCurrentUser?: boolean;
}

export interface StudentDashboardResponse {
  announcements: (Announcement & { isRead?: boolean })[];
  events: (UpcomingEvent & { isRegistered?: boolean })[];
  payments: PaymentItem[];
  todayClasses: ClassSession[];
  activeSession: string | null;
  birthdays?: BirthdayCelebrant[];
  isMyBirthday?: boolean;
}

// ──────────────────────────────────────────────
// Admin hooks
// ──────────────────────────────────────────────

/**
 * Fetch aggregated admin dashboard stats in a **single** API call.
 * The backend performs MongoDB aggregations and returns counts + chart data.
 *
 * Cached for 60 s and deduplicated across components.
 */
export function useAdminStats(enabled = true) {
  return useSWR<AdminStatsResponse>(
    enabled ? "/api/v1/admin/stats" : null,
    apiFetcher,
    {
      ...DEFAULT_CONFIG,
      dedupingInterval: 60_000, // admin data changes infrequently
    },
  );
}

// ──────────────────────────────────────────────
// Student hooks
// ──────────────────────────────────────────────

/**
 * Fetch aggregated student dashboard data in a **single** API call.
 * Returns announcements, upcoming events, payments, and today's classes.
 */
export function useStudentDashboard(enabled = true) {
  return useSWR<StudentDashboardResponse>(
    enabled ? "/api/v1/student/dashboard" : null,
    apiFetcher,
    {
      ...DEFAULT_CONFIG,
      dedupingInterval: 30_000,
    },
  );
}

/** Student announcements (latest 50) */
export function useAnnouncements(enabled = true) {
  return useSWR<Announcement[]>(
    enabled ? "/api/v1/announcements/" : null,
    apiFetcher,
    DEFAULT_CONFIG,
  );
}

/** All events */
export function useEvents(enabled = true) {
  return useSWR<UpcomingEvent[]>(
    enabled ? "/api/v1/events/" : null,
    apiFetcher,
    DEFAULT_CONFIG,
  );
}

/** Student payment items */
export function usePayments(enabled = true) {
  return useSWR<PaymentItem[]>(
    enabled ? "/api/v1/payments/" : null,
    apiFetcher,
    {
      ...DEFAULT_CONFIG,
      // Silently return empty array on failure (payment endpoint may 403/404)
      onError: () => {},
    },
  );
}

/** Student timetable classes */
export function useTimetableClasses(enabled = true) {
  return useSWR<ClassSession[]>(
    enabled ? "/api/v1/timetable/classes" : null,
    apiFetcher,
    {
      ...DEFAULT_CONFIG,
      onError: () => {},
    },
  );
}

// ──────────────────────────────────────────────
// Prefetch helpers
// ──────────────────────────────────────────────

/** Map of route paths → SWR keys to warm up on hover. */
const PREFETCH_MAP: Record<string, string[]> = {
  "/dashboard":              ["/api/v1/student/dashboard"],
  "/dashboard/events":       ["/api/v1/events/"],
  "/dashboard/announcements": ["/api/v1/announcements/"],
  "/dashboard/payments":     ["/api/v1/payments/"],
  "/dashboard/timetable":    ["/api/v1/timetable/classes"],
  "/admin/dashboard":        ["/api/v1/admin/stats"],
};

/**
 * Trigger SWR cache warm-up for the given path.
 * Call this on `onMouseEnter` of sidebar links.
 */
export function prefetchRoute(href: string) {
  const keys = PREFETCH_MAP[href];
  if (!keys) return;
  for (const key of keys) {
    preload(key, apiFetcher);
  }
}
