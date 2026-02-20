/**
 * Events Service
 * API functions for event management
 */

import { api, buildQueryString } from './client';
import { EventData, EventWithStatus, EventCreate, EventCategory } from './types';

// ============================================
// List & Read
// ============================================

interface ListEventsParams {
  category?: EventCategory;
  upcoming?: boolean;
  past?: boolean;
  limit?: number;
  skip?: number;
}

/**
 * Get events for the current session
 */
export async function getEvents(params: ListEventsParams = {}): Promise<EventWithStatus[]> {
  const query = buildQueryString(params);
  return api.get<EventWithStatus[]>(`/api/v1/events${query}`);
}

/**
 * Get a single event by ID
 */
export async function getEventById(eventId: string): Promise<EventWithStatus> {
  return api.get<EventWithStatus>(`/api/v1/events/${eventId}`);
}

/**
 * Get events the current user is registered for
 */
export async function getMyEventRegistrations(): Promise<EventWithStatus[]> {
  return api.get<EventWithStatus[]>('/api/v1/events/registrations/me');
}

// ============================================
// Registration
// ============================================

/**
 * Register for an event
 */
export async function registerForEvent(eventId: string): Promise<{ message: string }> {
  return api.post<{ message: string }>(`/api/v1/events/${eventId}/register`);
}

/**
 * Unregister from an event
 */
export async function unregisterFromEvent(eventId: string): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/api/v1/events/${eventId}/register`);
}

// ============================================
// Admin/EXCO Endpoints
// ============================================

/**
 * Create a new event
 */
export async function createEvent(data: EventCreate): Promise<EventData> {
  return api.post<EventData>('/api/v1/events', data);
}

interface UpdateEventData {
  title?: string;
  date?: string;
  location?: string;
  category?: EventCategory;
  description?: string;
  maxAttendees?: number | null;
  registrationDeadline?: string | null;
  imageUrl?: string | null;
  requiresPayment?: boolean;
  paymentAmount?: number | null;
}

/**
 * Update an event
 */
export async function updateEvent(eventId: string, data: UpdateEventData): Promise<EventData> {
  return api.patch<EventData>(`/api/v1/events/${eventId}`, data);
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId: string): Promise<void> {
  return api.delete<void>(`/api/v1/events/${eventId}`);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get upcoming events from a list
 */
export function getUpcomingEvents(events: EventWithStatus[]): EventWithStatus[] {
  const now = new Date();
  return events.filter((e) => new Date(e.date) > now);
}

/**
 * Get past events from a list
 */
export function getPastEvents(events: EventWithStatus[]): EventWithStatus[] {
  const now = new Date();
  return events.filter((e) => new Date(e.date) <= now);
}

/**
 * Check if registration is still open for an event
 */
export function isRegistrationOpen(event: EventWithStatus): boolean {
  if (event.isFull) return false;
  if (!event.registrationDeadline) return true;
  return new Date(event.registrationDeadline) > new Date();
}

/**
 * Get registration count for an event
 */
export function getRegistrationCount(event: EventData): number {
  return event.registrations?.length || 0;
}

/**
 * Check if event is happening today
 */
export function isEventToday(event: EventData): boolean {
  const eventDate = new Date(event.date);
  const today = new Date();
  return (
    eventDate.getFullYear() === today.getFullYear() &&
    eventDate.getMonth() === today.getMonth() &&
    eventDate.getDate() === today.getDate()
  );
}
