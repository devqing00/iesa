/**
 * API Configuration
 * 
 * Centralized API URL management for development and production
 */

// Get API base URL from environment variable
// Development: http://localhost:8000
// Production: Your deployed backend URL (Railway, Render, etc.)
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Make an authenticated API request to the backend
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Helper to construct API URLs
 */
export function getApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
