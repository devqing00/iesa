/**
 * Bank Transfer API Module
 *
 * Handles bank account management and transfer proof submissions.
 */

import { api } from './client';

// ─── Types ─────────────────────────────────────────────────────

export interface BankAccount {
  _id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  isActive: boolean;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransfer {
  _id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  paymentId: string;
  paymentTitle: string;
  sessionId: string;
  bankAccountId: string;
  bankAccountName: string;
  bankAccountBank: string;
  bankAccountNumber: string;
  amount: number;
  senderName: string;
  senderBank: string;
  transactionReference: string;
  transferDate: string;
  narration?: string;
  receiptImageUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountData {
  bankName: string;
  accountName: string;
  accountNumber: string;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateBankAccountData {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  isActive?: boolean;
  notes?: string;
}

export interface SubmitTransferProofData {
  paymentId: string;
  bankAccountId: string;
  amount: number;
  senderName: string;
  senderBank: string;
  transactionReference?: string;
  transferDate: string;
  narration?: string;
}

export interface ReviewTransferData {
  status: 'approved' | 'rejected';
  adminNote?: string;
}

// ─── Bank Accounts ─────────────────────────────────────────────

export async function listBankAccounts(activeOnly = false): Promise<BankAccount[]> {
  const qs = activeOnly ? '?active_only=true' : '';
  return api.get(`/api/v1/bank-transfers/accounts${qs}`);
}

export async function createBankAccount(data: CreateBankAccountData): Promise<BankAccount> {
  return api.post('/api/v1/bank-transfers/accounts', data);
}

export async function updateBankAccount(id: string, data: UpdateBankAccountData): Promise<BankAccount> {
  return api.patch(`/api/v1/bank-transfers/accounts/${id}`, data);
}

export async function deleteBankAccount(id: string): Promise<void> {
  return api.delete(`/api/v1/bank-transfers/accounts/${id}`);
}

// ─── Transfer Proof Submissions ────────────────────────────────

export async function submitTransferProof(data: SubmitTransferProofData): Promise<BankTransfer> {
  return api.post('/api/v1/bank-transfers/submit', data);
}

export interface SubmitEventTransferData {
  bankAccountId: string;
  senderName: string;
  senderBank: string;
  transactionReference: string;
  transferDate: string;
  narration?: string;
}

export async function submitEventBankTransfer(eventId: string, data: SubmitEventTransferData): Promise<BankTransfer> {
  return api.post(`/api/v1/events/${eventId}/bank-transfer`, data);
}

export async function getMyTransfers(): Promise<BankTransfer[]> {
  return api.get('/api/v1/bank-transfers/my');
}

// ─── Admin Transfer Review ─────────────────────────────────────

export async function listAllTransfers(
  status?: string,
  sessionId?: string,
): Promise<BankTransfer[]> {
  const params: string[] = [];
  if (status) params.push(`status=${status}`);
  if (sessionId) params.push(`session_id=${sessionId}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  return api.get(`/api/v1/bank-transfers/${qs}`);
}

export async function reviewTransfer(
  transferId: string,
  data: ReviewTransferData,
): Promise<BankTransfer> {
  return api.patch(`/api/v1/bank-transfers/${transferId}/review`, data);
}

export async function getTransferById(transferId: string): Promise<BankTransfer> {
  return api.get(`/api/v1/bank-transfers/${transferId}`);
}

/** Check if a transaction reference already exists (duplicate check before submission) */
export async function checkTransactionReference(reference: string): Promise<{ exists: boolean }> {
  return api.get(`/api/v1/bank-transfers/check-reference?reference=${encodeURIComponent(reference)}`);
}

// ─── Transfer Status Helpers ───────────────────────────────────

export const TRANSFER_STATUS_STYLES = {
  pending: { bg: 'bg-sunny-light', text: 'text-navy', dot: 'bg-sunny', label: 'Pending Review' },
  approved: { bg: 'bg-teal-light', text: 'text-navy', dot: 'bg-teal', label: 'Approved' },
  rejected: { bg: 'bg-coral-light', text: 'text-navy', dot: 'bg-coral', label: 'Rejected' },
} as const;

/** Nigerian banks for the sender bank dropdown */
export const NIGERIAN_BANKS = [
  'Access Bank',
  'Citibank Nigeria',
  'Ecobank Nigeria',
  'Fidelity Bank',
  'First Bank of Nigeria',
  'First City Monument Bank (FCMB)',
  'Globus Bank',
  'Guaranty Trust Bank (GTBank)',
  'Heritage Bank',
  'Jaiz Bank',
  'Keystone Bank',
  'Kuda Bank',
  'Lotus Bank',
  'Moniepoint MFB',
  'OPay',
  'PalmPay',
  'Parallex Bank',
  'Polaris Bank',
  'Providus Bank',
  'Stanbic IBTC Bank',
  'Standard Chartered Bank',
  'Sterling Bank',
  'SunTrust Bank',
  'TAJBank',
  'Titan Trust Bank',
  'Union Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Unity Bank',
  'VFD Microfinance Bank',
  'Wema Bank',
  'Zenith Bank',
] as const;
