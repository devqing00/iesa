/**
 * API Client
 * 
 * Centralized API client with:
 * - Error handling and retry logic
 * - Token management
 * - Request/response interceptors
 * - Session header injection
 * - Sonner toast notifications on errors
 */

import { toast } from "sonner";

// ============================================
// Configuration
// ============================================

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 30000;

// ============================================
// Error Classes
// ============================================

export class ApiRequestError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiRequestError';
    this.status = status;
    this.detail = detail;
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error. Please check your connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string = 'Request timed out. Please try again.') {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ============================================
// Token Management
// ============================================

let tokenGetter: (() => Promise<string | null>) | null = null;
let sessionIdGetter: (() => string | null) | null = null;

/**
 * Set the function to get the current auth token
 * Called from AuthContext
 */
export function setTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter;
}

/**
 * Set the function to get the current session ID
 * Called from SessionContext
 */
export function setSessionIdGetter(getter: () => string | null) {
  sessionIdGetter = getter;
}

/**
 * Get the current auth token
 */
async function getToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  return tokenGetter();
}

/**
 * Get the current session ID
 */
function getSessionId(): string | null {
  if (!sessionIdGetter) return null;
  return sessionIdGetter();
}

// ============================================
// Request Helpers
// ============================================

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  skipAuth?: boolean;
  skipSession?: boolean;
  /** Show a toast.error when the request fails. Default: true */
  showErrorToast?: boolean;
  /** Optional success message — if set, shows a toast.success on 2xx */
  successMessage?: string;
}

/**
 * Build headers for a request
 */
async function buildHeaders(options: RequestOptions): Promise<Headers> {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...options.headers,
  });

  // Add auth token if not skipped
  if (!options.skipAuth) {
    const token = await getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Add session ID if not skipped
  if (!options.skipSession) {
    const sessionId = getSessionId();
    if (sessionId) {
      headers.set('X-Session-ID', sessionId);
    }
  }

  return headers;
}

/**
 * Handle API error responses
 */
async function handleErrorResponse(response: Response): Promise<never> {
  let detail = 'An unexpected error occurred';
  
  try {
    const errorBody = await response.json();
    detail = errorBody.detail || errorBody.message || detail;
  } catch {
    // Response body wasn't JSON
    detail = response.statusText || detail;
  }

  throw new ApiRequestError(response.status, detail);
}

/**
 * Create a timeout promise
 */
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new TimeoutError()), ms);
  });
}

// ============================================
// Main API Client
// ============================================

/**
 * Make an API request
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const timeout = options.timeout ?? REQUEST_TIMEOUT;
  const showErrorToast = options.showErrorToast !== false; // default true

  try {
    const headers = await buildHeaders(options);

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
    };

    if (options.body && options.method !== 'GET') {
      fetchOptions.body = JSON.stringify(options.body);
    }

    // Race between fetch and timeout
    const response = await Promise.race([
      fetch(url, fetchOptions),
      createTimeout(timeout),
    ]) as Response;

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      if (options.successMessage) toast.success(options.successMessage);
      return undefined as T;
    }

    // Handle responses that might not be JSON
    const contentType = response.headers.get('content-type');
    let result: T;
    if (contentType?.includes('application/json')) {
      result = await response.json();
    } else {
      result = await response.blob() as T;
    }

    if (options.successMessage) toast.success(options.successMessage);
    return result;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (showErrorToast) toast.error(error.detail);
      throw error;
    }
    if (error instanceof TimeoutError) {
      if (showErrorToast) toast.error("Request timed out — please try again.");
      throw error;
    }

    // Network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const netError = new NetworkError();
      if (showErrorToast) toast.error(netError.message);
      throw netError;
    }

    throw error;
  }
}

// ============================================
// HTTP Method Shortcuts
// ============================================

export const api = {
  get: <T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),

  put: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};

// ============================================
// Utility Functions
// ============================================

/**
 * Build query string from params object
 */
export function buildQueryString<T extends object>(params: T): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Get API URL helper (for backward compatibility)
 */
export function getApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
