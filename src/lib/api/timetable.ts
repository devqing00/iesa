/**
 * Timetable Service
 * API functions for class schedule management
 */

import { api, buildQueryString } from './client';
import { ClassSession, ClassCancellation, WeeklySchedule, ClassType } from './types';

// ============================================
// Read Endpoints
// ============================================

interface ListClassesParams {
  level?: number;
  day?: string;
  type?: ClassType;
}

/**
 * Get class sessions for the current session
 */
export async function getClasses(params: ListClassesParams = {}): Promise<ClassSession[]> {
  const query = buildQueryString(params);
  return api.get<ClassSession[]>(`/api/v1/timetable/classes${query}`);
}

interface WeekParams {
  level?: number;
  weekStart?: string; // ISO date string
}

/**
 * Get weekly schedule
 */
export async function getWeeklySchedule(params: WeekParams = {}): Promise<WeeklySchedule> {
  const query = buildQueryString({
    level: params.level,
    week_start: params.weekStart,
  });
  return api.get<WeeklySchedule>(`/api/v1/timetable/week${query}`);
}

/**
 * Get today's classes
 */
export async function getTodayClasses(level?: number): Promise<ClassSession[]> {
  const query = level ? `?level=${level}` : '';
  return api.get<ClassSession[]>(`/api/v1/timetable/today${query}`);
}

// ============================================
// Admin/Class Rep Endpoints
// ============================================

interface CreateClassData {
  courseCode: string;
  courseTitle: string;
  level: number;
  day: string;
  startTime: string;
  endTime: string;
  venue: string;
  lecturer?: string;
  type?: ClassType;
  recurring?: boolean;
}

/**
 * Create a new class session
 */
export async function createClass(data: CreateClassData): Promise<ClassSession> {
  return api.post<ClassSession>('/api/v1/timetable/classes', data);
}

interface UpdateClassData {
  courseCode?: string;
  courseTitle?: string;
  level?: number;
  day?: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  lecturer?: string | null;
  type?: ClassType;
  recurring?: boolean;
}

/**
 * Update a class session
 */
export async function updateClass(classId: string, data: UpdateClassData): Promise<ClassSession> {
  return api.patch<ClassSession>(`/api/v1/timetable/classes/${classId}`, data);
}

/**
 * Delete a class session
 */
export async function deleteClass(classId: string): Promise<void> {
  return api.delete<void>(`/api/v1/timetable/classes/${classId}`);
}

/**
 * Cancel a specific class occurrence (for class reps)
 */
export async function cancelClass(
  classId: string,
  data: { date: string; reason: string }
): Promise<ClassCancellation> {
  return api.post<ClassCancellation>(`/api/v1/timetable/classes/${classId}/cancel`, data);
}

// ============================================
// Utility Functions
// ============================================

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Sort classes by start time
 */
export function sortClassesByTime(classes: ClassSession[]): ClassSession[] {
  return [...classes].sort((a, b) => {
    const timeA = a.startTime.replace(':', '');
    const timeB = b.startTime.replace(':', '');
    return parseInt(timeA) - parseInt(timeB);
  });
}

/**
 * Group classes by day
 */
export function groupClassesByDay(classes: ClassSession[]): Record<string, ClassSession[]> {
  const grouped: Record<string, ClassSession[]> = {};
  
  for (const day of DAYS_ORDER) {
    grouped[day] = [];
  }

  for (const cls of classes) {
    const day = cls.day.toLowerCase();
    if (grouped[day]) {
      grouped[day].push(cls);
    }
  }

  // Sort each day's classes by time
  for (const day of Object.keys(grouped)) {
    grouped[day] = sortClassesByTime(grouped[day]);
  }

  return grouped;
}

/**
 * Get next upcoming class
 */
export function getNextClass(classes: ClassSession[]): ClassSession | null {
  const now = new Date();
  const currentDay = DAYS_ORDER[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // First check remaining classes today
  const todayClasses = classes
    .filter((c) => c.day.toLowerCase() === currentDay && c.startTime > currentTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (todayClasses.length > 0) {
    return todayClasses[0];
  }

  // Check upcoming days
  const currentDayIndex = DAYS_ORDER.indexOf(currentDay);
  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (currentDayIndex + i) % 7;
    const nextDay = DAYS_ORDER[nextDayIndex];
    const nextDayClasses = classes
      .filter((c) => c.day.toLowerCase() === nextDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (nextDayClasses.length > 0) {
      return nextDayClasses[0];
    }
  }

  return null;
}

/**
 * Format time range for display
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

/**
 * Get class type color class
 */
export function getClassTypeColor(type: ClassType): string {
  switch (type) {
    case 'lecture':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'practical':
      return 'bg-lime-light text-teal dark:bg-lime-light dark:text-teal';
    case 'tutorial':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    default:
      return 'bg-surface-sunken text-on-surface-secondary';
  }
}
