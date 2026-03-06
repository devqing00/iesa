/**
 * Academic Calendar API service — types, constants, and API functions
 * for managing semester milestones, exam periods, holidays, etc.
 */

import { api, buildQueryString } from "./client";

// ── Types ────────────────────────────────────────────────────────────────

export type AcademicEventType =
  | "exam_period"
  | "registration"
  | "add_drop"
  | "holiday"
  | "break_period"
  | "orientation"
  | "convocation"
  | "lecture_start"
  | "lecture_end"
  | "deadline"
  | "other";

export interface AcademicEvent {
  id: string;
  title: string;
  eventType: AcademicEventType;
  startDate: string;
  endDate?: string | null;
  semester: number;
  sessionId: string;
  description?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateAcademicEventData {
  title: string;
  eventType: AcademicEventType;
  startDate: string;
  endDate?: string | null;
  semester: number;
  description?: string;
}

export interface UpdateAcademicEventData {
  title?: string;
  eventType?: AcademicEventType;
  startDate?: string;
  endDate?: string | null;
  semester?: number;
  description?: string;
}

// ── Constants ────────────────────────────────────────────────────────────

export const EVENT_TYPE_LABELS: Record<AcademicEventType, string> = {
  exam_period: "Exam Period",
  registration: "Course Registration",
  add_drop: "Add/Drop Period",
  holiday: "Holiday",
  break_period: "Break",
  orientation: "Orientation",
  convocation: "Convocation",
  lecture_start: "Lectures Begin",
  lecture_end: "Lectures End",
  deadline: "Deadline",
  other: "Other",
};

export const EVENT_TYPE_COLORS: Record<
  AcademicEventType,
  { bg: string; text: string; border: string }
> = {
  exam_period: { bg: "bg-coral-light", text: "text-coral", border: "border-coral" },
  registration: { bg: "bg-teal-light", text: "text-teal", border: "border-teal" },
  add_drop: { bg: "bg-sunny-light", text: "text-navy", border: "border-sunny" },
  holiday: { bg: "bg-lavender-light", text: "text-lavender", border: "border-lavender" },
  break_period: { bg: "bg-lavender-light", text: "text-lavender", border: "border-lavender" },
  orientation: { bg: "bg-teal-light", text: "text-teal", border: "border-teal" },
  convocation: { bg: "bg-lime-light", text: "text-navy", border: "border-lime" },
  lecture_start: { bg: "bg-teal-light", text: "text-teal", border: "border-teal" },
  lecture_end: { bg: "bg-coral-light", text: "text-coral", border: "border-coral" },
  deadline: { bg: "bg-sunny-light", text: "text-navy", border: "border-sunny" },
  other: { bg: "bg-ghost", text: "text-navy", border: "border-cloud" },
};

export const ALL_EVENT_TYPES: AcademicEventType[] = [
  "exam_period",
  "registration",
  "add_drop",
  "holiday",
  "break_period",
  "orientation",
  "convocation",
  "lecture_start",
  "lecture_end",
  "deadline",
  "other",
];

// ── API Functions ────────────────────────────────────────────────────────

const BASE = "/api/v1/academic-calendar";

export async function listAcademicEvents(filters?: {
  semester?: number;
  eventType?: string;
}): Promise<AcademicEvent[]> {
  const qs = buildQueryString(filters || {});
  return api.get<AcademicEvent[]>(`${BASE}/${qs}`);
}

export async function getAcademicEvent(id: string): Promise<AcademicEvent> {
  return api.get<AcademicEvent>(`${BASE}/${id}`);
}

export async function createAcademicEvent(
  data: CreateAcademicEventData
): Promise<AcademicEvent> {
  return api.post<AcademicEvent>(BASE + "/", data);
}

export async function updateAcademicEvent(
  id: string,
  data: UpdateAcademicEventData
): Promise<AcademicEvent> {
  return api.patch<AcademicEvent>(`${BASE}/${id}`, data);
}

export async function deleteAcademicEvent(id: string): Promise<void> {
  return api.delete(`${BASE}/${id}`);
}
