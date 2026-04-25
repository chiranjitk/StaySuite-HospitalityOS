'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { initializeUITheme, useUIStyleStore } from '@/lib/themes/store';

interface UIStyleProviderProps {
  children: React.ReactNode;
}

export function UIStyleProvider({ children }: UIStyleProviderProps) {
  // Initialize theme on mount
  React.useEffect(() => {
    initializeUITheme();
  }, []);

  // Listen for store changes and apply them
  React.useEffect(() => {
    const unsubscribe = useUIStyleStore.subscribe((state, prevState) => {
      if (state.themeId !== prevState.themeId || state.mode !== prevState.mode) {
        const effectiveMode = state.getEffectiveMode();
        const root = document.documentElement;
        root.setAttribute('data-theme', state.themeId);
        
        if (effectiveMode === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    });

    return unsubscribe;
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="staysuite-theme-mode-next"
    >
      {children}
    </NextThemesProvider>
  );
}

/**
 * Hook to access UI style state and actions
 */
export function useUIStyle() {
  const store = useUIStyleStore();
  
  return {
    // State
    themeId: store.themeId,
    mode: store.mode,
    effectiveMode: store.getEffectiveMode(),
    isDark: store.getEffectiveMode() === 'dark',
    isLight: store.getEffectiveMode() === 'light',
    isSystem: store.mode === 'system',
    
    // Actions
    setTheme: store.setTheme,
    setMode: store.setMode,
    toggleMode: store.toggleMode,
  };
}
