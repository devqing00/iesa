/**
 * Receipt API Module
 * Fetches receipt data for successful payments/transfers
 */

import { api } from "./client";

export interface ReceiptEventData {
  id: string;
  title: string;
  date: string | null;
  location: string;
  category: string;
}

export interface ReceiptData {
  transactionId: string;
  reference: string;
  receiptType: "paystack" | "bank_transfer";
  isEventPayment?: boolean;
  event?: ReceiptEventData | null;
  student: {
    name: string;
    email: string;
    matricNumber?: string;
    level: string;
    department: string;
  };
  payment: {
    title: string;
    category: string;
    amount: number;
    description?: string;
  };
  transaction: {
    method: string;
    reference: string;
    date: string;
    status: string;
    channel: string;
    verifiedBy?: string;
    bankAccount?: {
      bank: string;
      accountNumber: string;
      accountName: string;
    };
  };
}

/**
 * Fetch receipt data for a transaction reference
 */
export async function getReceiptData(reference: string): Promise<ReceiptData> {
  return api.get<ReceiptData>(`/api/v1/paystack/receipt/data?reference=${encodeURIComponent(reference)}`);
}

/**
 * Get PDF download URL for a receipt
 */
export function getReceiptPdfUrl(reference: string): string {
  return `/api/v1/paystack/receipt/pdf?reference=${encodeURIComponent(reference)}`;
}
