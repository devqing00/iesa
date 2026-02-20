/**
 * IESA AI Chat Service
 * API functions for AI assistant interaction
 */

import { api } from './client';
import { ChatMessage, ChatResponse } from './types';

// ============================================
// Chat Endpoints
// ============================================

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

/**
 * Send a message to the AI assistant
 */
export async function sendMessage(data: ChatRequest): Promise<ChatResponse> {
  return api.post<ChatResponse>('/api/v1/iesa-ai/chat', data);
}

/**
 * Get suggested questions
 */
export async function getSuggestions(): Promise<string[]> {
  const response = await api.get<{ suggestions: string[] }>('/api/v1/iesa-ai/suggestions');
  return response.suggestions;
}

interface FeedbackData {
  messageId: string;
  isHelpful: boolean;
  feedback?: string;
}

/**
 * Submit feedback on an AI response
 */
export async function submitFeedback(data: FeedbackData): Promise<void> {
  return api.post<void>('/api/v1/iesa-ai/feedback', data);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format chat history for display
 */
export function formatChatHistory(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'You' : 'IESA AI'}: ${m.content}`)
    .join('\n\n');
}

/**
 * Get initial greeting message
 */
export function getGreetingMessage(): ChatMessage {
  return {
    role: 'assistant',
    content:
      "Hello! I'm IESA AI, your academic assistant. I can help you with:\n\n" +
      '• Your class schedule and timetable\n' +
      '• Upcoming events and deadlines\n' +
      '• Payment information\n' +
      '• General questions about IESA\n\n' +
      'How can I help you today?',
  };
}

/**
 * Common quick actions for the chat
 */
export const QUICK_ACTIONS = [
  { label: 'My classes today', prompt: 'What classes do I have today?' },
  { label: 'Upcoming events', prompt: 'What events are coming up?' },
  { label: 'Payment status', prompt: 'What payments do I owe?' },
  { label: 'Next class', prompt: 'When is my next class?' },
] as const;

/**
 * Check if a message is a schedule-related query
 */
export function isScheduleQuery(message: string): boolean {
  const scheduleKeywords = [
    'class',
    'classes',
    'schedule',
    'timetable',
    'lecture',
    'practical',
    'tutorial',
    'today',
    'tomorrow',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
  ];
  const lowerMessage = message.toLowerCase();
  return scheduleKeywords.some((keyword) => lowerMessage.includes(keyword));
}

/**
 * Check if a message is a payment-related query
 */
export function isPaymentQuery(message: string): boolean {
  const paymentKeywords = ['pay', 'payment', 'dues', 'owe', 'owing', 'fee', 'fees', 'receipt'];
  const lowerMessage = message.toLowerCase();
  return paymentKeywords.some((keyword) => lowerMessage.includes(keyword));
}

/**
 * Check if a message is an event-related query
 */
export function isEventQuery(message: string): boolean {
  const eventKeywords = ['event', 'events', 'program', 'activity', 'happening', 'coming up'];
  const lowerMessage = message.toLowerCase();
  return eventKeywords.some((keyword) => lowerMessage.includes(keyword));
}
