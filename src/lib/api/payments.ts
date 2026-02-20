/**
 * Payments Service
 * API functions for payment management and Paystack integration
 */

import { api, buildQueryString } from './client';
import { Payment, PaymentWithStatus, Transaction, PaystackInitResponse } from './types';

// ============================================
// Payment Dues
// ============================================

interface ListPaymentsParams {
  mandatory?: boolean;
  paid?: boolean;
  category?: string;
  limit?: number;
  skip?: number;
}

/**
 * Get payment dues for the current session
 */
export async function getPayments(params: ListPaymentsParams = {}): Promise<PaymentWithStatus[]> {
  const query = buildQueryString(params);
  return api.get<PaymentWithStatus[]>(`/api/v1/payments${query}`);
}

/**
 * Get a specific payment by ID
 */
export async function getPaymentById(paymentId: string): Promise<PaymentWithStatus> {
  return api.get<PaymentWithStatus>(`/api/v1/payments/${paymentId}`);
}

/**
 * Record a manual payment (for cash payments)
 */
export async function recordManualPayment(
  paymentId: string,
  data: { amount: number; paymentMethod: string; reference?: string }
): Promise<Transaction> {
  return api.post<Transaction>(`/api/v1/payments/${paymentId}/pay`, data);
}

// ============================================
// Admin Endpoints
// ============================================

interface CreatePaymentData {
  title: string;
  amount: number;
  mandatory?: boolean;
  deadline?: string;
  description?: string;
  category?: string;
}

/**
 * Create a new payment due
 */
export async function createPayment(data: CreatePaymentData): Promise<Payment> {
  return api.post<Payment>('/api/v1/payments', data);
}

interface UpdatePaymentData {
  title?: string;
  amount?: number;
  mandatory?: boolean;
  deadline?: string | null;
  description?: string | null;
  category?: string | null;
}

/**
 * Update a payment due
 */
export async function updatePayment(paymentId: string, data: UpdatePaymentData): Promise<Payment> {
  return api.patch<Payment>(`/api/v1/payments/${paymentId}`, data);
}

/**
 * Delete a payment due
 */
export async function deletePayment(paymentId: string): Promise<void> {
  return api.delete<void>(`/api/v1/payments/${paymentId}`);
}

// ============================================
// Paystack Integration
// ============================================

/**
 * Initialize a Paystack payment
 */
export async function initializePaystackPayment(
  paymentId: string,
  email: string,
  amount: number
): Promise<PaystackInitResponse> {
  return api.post<PaystackInitResponse>('/api/v1/paystack/initialize', {
    paymentId,
    email,
    amount: Math.round(amount * 100), // Convert to kobo
  });
}

/**
 * Verify a Paystack payment
 */
export async function verifyPaystackPayment(reference: string): Promise<Transaction> {
  return api.get<Transaction>(`/api/v1/paystack/verify/${reference}`);
}

/**
 * Get user's transaction history
 */
export async function getTransactions(): Promise<Transaction[]> {
  return api.get<Transaction[]>('/api/v1/paystack/transactions');
}

/**
 * Download payment receipt
 */
export async function downloadReceipt(reference: string): Promise<Blob> {
  return api.get<Blob>(`/api/v1/paystack/receipt/${reference}`);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get total amount owed
 */
export function getTotalOwed(payments: PaymentWithStatus[]): number {
  return payments
    .filter((p) => !p.hasPaid && p.mandatory)
    .reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Get total amount paid
 */
export function getTotalPaid(payments: PaymentWithStatus[]): number {
  return payments.filter((p) => p.hasPaid).reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Get overdue payments
 */
export function getOverduePayments(payments: PaymentWithStatus[]): PaymentWithStatus[] {
  const now = new Date();
  return payments.filter((p) => !p.hasPaid && p.deadline && new Date(p.deadline) < now);
}

/**
 * Check if user has any outstanding mandatory payments
 */
export function hasOutstandingPayments(payments: PaymentWithStatus[]): boolean {
  return payments.some((p) => !p.hasPaid && p.mandatory);
}

/**
 * Format amount as Naira
 */
export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
