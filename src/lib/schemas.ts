/**
 * IESA Platform – Zod Validation Schemas
 *
 * Centralised schemas for all major forms.
 * Import these in admin & student pages for consistent runtime validation.
 */

import { z } from "zod";

/* ─── Session ─────────────────────────────────── */

export const SessionSchema = z.object({
  name: z
    .string()
    .min(4, "Session name must be at least 4 characters")
    .max(50)
    .regex(/^\d{4}\/\d{4}$/, 'Format must be "YYYY/YYYY" — e.g. 2024/2025'),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  isActive: z.boolean().optional(),
}).refine(
  (d) => !d.startDate || !d.endDate || new Date(d.startDate) < new Date(d.endDate),
  { message: "End date must be after start date", path: ["endDate"] }
);

export type SessionFormData = z.infer<typeof SessionSchema>;

/* ─── Announcement ───────────────────────────── */

export const AnnouncementSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  content: z.string().min(10, "Content must be at least 10 characters").max(5000),
  priority: z.enum(["low", "normal", "high", "urgent"] as const),
  isPinned: z.boolean().optional(),
  targetLevels: z.array(z.string()).optional(),
  expiresAt: z.string().optional(),
});

export type AnnouncementFormData = z.infer<typeof AnnouncementSchema>;

/* ─── Event ──────────────────────────────────── */

export const EventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000),
  date: z.string().min(1, "Event date is required"),
  location: z.string().min(2, "Location is required").max(200),
  category: z.enum(["Academic", "Social", "Career", "Workshop", "Competition", "Other"] as const),
  maxAttendees: z.coerce.number().positive().optional().or(z.literal("")),
  registrationDeadline: z.string().optional(),
  requiresPayment: z.boolean().optional(),
  paymentAmount: z.coerce.number().nonnegative().optional(),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
}).refine(
  (d) => !d.requiresPayment || (d.paymentAmount !== undefined && d.paymentAmount > 0),
  { message: "Payment amount is required when payment is needed", path: ["paymentAmount"] }
);

export type EventFormData = z.infer<typeof EventSchema>;

/* ─── Resource ───────────────────────────────── */

export const ResourceSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().min(10, "Description must be at least 10 characters").max(1000),
  type: z.enum(["slide", "pastQuestion", "note", "textbook", "video"] as const),
  courseCode: z
    .string()
    .min(2, "Course code required")
    .max(20)
    .transform((v) => v.toUpperCase()),
  level: z.coerce
    .number()
    .refine((v) => [100, 200, 300, 400, 500].includes(v), "Level must be 100, 200, 300, 400, or 500"),
  url: z.string().url("Must be a valid URL"),
  tags: z.string().optional(),
});

export type ResourceFormData = z.infer<typeof ResourceSchema>;

/* ─── Payment ────────────────────────────────── */

export const PaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be a positive number"),
  description: z.string().min(3, "Description required").max(500),
  category: z.enum(["dues", "event", "other"] as const),
  studentId: z.string().min(1, "Student ID required"),
});

export type PaymentFormData = z.infer<typeof PaymentSchema>;

/* ─── Utility: flatten Zod errors ────────────── */

export function flattenZodErrors<T extends Record<string, unknown>>(
  error: z.ZodError
): Partial<Record<keyof T, string>> {
  const result: Partial<Record<keyof T, string>> = {};
  error.issues.forEach((issue) => {
    const field = issue.path[0] as keyof T;
    if (field && !result[field]) {
      result[field] = issue.message;
    }
  });
  return result;
}
