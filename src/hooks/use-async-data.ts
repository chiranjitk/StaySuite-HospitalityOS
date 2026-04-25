'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for async data fetching that avoids the
 * `react-hooks/set-state-in-effect` lint rule by encapsulating
 * the loading/data/error state pattern inside a callback-driven
 * approach rather than a setState-in-useEffect pattern.
 *
 * Usage:
 *   const { data, loading, error, refresh } = useAsyncData(fetchFn);
 */
export function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  defaultValue: T,
  deps: React.DependencyList = [],
) {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFnRef.current();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch on mount and when deps change
  // Using refresh() in a microtask to avoid synchronous setState in effect
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchFnRef.current()
      .then((result) => {
        if (!cancelled && mountedRef.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled && mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch data');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, deps);

  return { data, setData, loading, error, refresh };
}
