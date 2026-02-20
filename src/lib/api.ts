/**
 * API Configuration
 * 
 * This file re-exports from the new API service layer for backward compatibility.
 * New code should import from '@/lib/api' (the api/ directory).
 * 
 * @deprecated Import from '@/lib/api' directly instead
 */

// Re-export everything from the new API layer
export * from './api/index';

