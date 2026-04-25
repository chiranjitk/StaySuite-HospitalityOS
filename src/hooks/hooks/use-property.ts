'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store';

/**
 * Returns the current property ID from the auth store.
 * If no property is selected, auto-fetches properties from /api/properties
 * and selects the first one. This ensures every component that needs
 * property-scoped data can reliably get a propertyId.
 */
export function usePropertyId() {
  const { currentProperty, properties, setProperties, setCurrentProperty } = useAuthStore();

  useEffect(() => {
    // If we already have a current property, nothing to do
    if (currentProperty) return;
    // If we have properties but no current, select the first one
    if (properties.length > 0) {
      setCurrentProperty(properties[0]);
      return;
    }
    // Otherwise fetch from API
    let cancelled = false;
    const controller = new AbortController();

    fetch('/api/properties', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setProperties(data.data);
          setCurrentProperty(data.data[0]);
        }
      })
      .catch((err) => {
        if (!cancelled && err.name !== 'AbortError') {
          console.error('Failed to fetch properties:', err);
        }
      })
      .finally(() => {
        void cancelled; // no-op to reference cancelled
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentProperty, properties, setProperties, setCurrentProperty]);

  return {
    propertyId: currentProperty?.id || '',
    property: currentProperty || null,
    properties,
    loading: false,
  };
}
