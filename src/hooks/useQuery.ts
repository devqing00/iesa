'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiRequestError, NetworkError } from '@/lib/api/client';

/**
 * useQuery Hook
 * 
 * A simple data fetching hook with:
 * - Loading states
 * - Error handling
 * - Refetch capability
 * - Caching (optional)
 */

export interface QueryResult<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

interface UseQueryOptions {
  enabled?: boolean;
  refetchOnMount?: boolean;
  staleTime?: number;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

const cache = new Map<string, { data: unknown; timestamp: number }>();

export function useQuery<T>(
  key: string | string[],
  fetcher: () => Promise<T>,
  options: UseQueryOptions = {}
): QueryResult<T> {
  const {
    enabled = true,
    refetchOnMount = true,
    staleTime = 0,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const cacheKey = Array.isArray(key) ? key.join(':') : key;
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && staleTime > 0) {
      const isStale = Date.now() - cached.timestamp > staleTime;
      if (!isStale) {
        setData(cached.data as T);
        setIsLoading(false);
        return;
      }
    }

    setIsFetching(true);
    setError(null);

    try {
      const result = await fetcher();
      
      if (mountedRef.current) {
        setData(result);
        setIsLoading(false);
        setError(null);
        
        // Update cache
        if (staleTime > 0) {
          cache.set(cacheKey, { data: result, timestamp: Date.now() });
        }
        
        onSuccess?.(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error('An error occurred');
        setError(error);
        setIsLoading(false);
        onError?.(error);
      }
    } finally {
      if (mountedRef.current) {
        setIsFetching(false);
      }
    }
  }, [cacheKey, enabled, fetcher, onError, onSuccess, staleTime]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (refetchOnMount) {
      fetchData();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetchData, refetchOnMount]);

  const refetch = useCallback(() => {
    cache.delete(cacheKey);
    fetchData();
  }, [cacheKey, fetchData]);

  return {
    data,
    isLoading,
    isError: error !== null,
    error,
    refetch,
    isFetching,
  };
}

/**
 * useMutation Hook
 * 
 * For create/update/delete operations
 */

export interface MutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  data: TData | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  reset: () => void;
}

interface UseMutationOptions<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}

export function useMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData> = {}
): MutationResult<TData, TVariables> {
  const { onSuccess, onError, onSettled } = options;

  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await mutationFn(variables);
        setData(result);
        onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('An error occurred');
        setError(error);
        onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
        onSettled?.();
      }
    },
    [mutationFn, onError, onSettled, onSuccess]
  );

  const mutate = useCallback(
    (variables: TVariables) => {
      mutateAsync(variables).catch(() => {
        // Error is already handled by state
      });
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    mutate,
    mutateAsync: mutateAsync as (variables: TVariables) => Promise<TData>,
    data,
    isLoading,
    isError: error !== null,
    error,
    reset,
  };
}

/**
 * Helper to format API errors for display
 */
export function formatApiError(error: Error | null): string {
  if (!error) return '';
  
  if (error instanceof ApiRequestError) {
    return error.detail;
  }
  
  if (error instanceof NetworkError) {
    return 'Network error. Please check your connection.';
  }
  
  return error.message || 'An unexpected error occurred';
}

/**
 * Clear the query cache
 */
export function clearQueryCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
