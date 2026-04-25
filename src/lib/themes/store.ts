/**
 * UI Style Theme Store - Zustand store for theme management
 * Handles 15 UI style themes (6 Original + 4 Premium Netflix-style + 5 Enterprise)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { themes as themesConfig } from './config';

// Re-export types and config from config file
export type { ThemeId, ThemeConfig, ThemeColors } from './config';
export { themes, DEFAULT_THEME, themeIcons, getThemeConfig, getAllThemes, getThemesByCategory } from './config';

// Local type definitions for UI Style - matches ThemeId from config
export type UIStyleTheme = 
  | 'gradient-modern' 
  | 'dark-premium' 
  | 'cyber-neon' 
  | 'sakura-pink' 
  | 'neumorphism' 
  | 'minimalist'
  | 'netflix-crimson'
  | 'obsidian-rose'
  | 'midnight-ivory'
  | 'scarlet-noir'
  | 'slate-enterprise'
  | 'sapphire-dash'
  | 'terra-corporate'
  | 'arctic-steel'
  | 'noir-executive';

export type ThemeMode = 'light' | 'dark' | 'system';

interface UIStyleState {
  // Current theme
  themeId: UIStyleTheme;
  mode: ThemeMode;
  
  // Actions
  setTheme: (themeId: UIStyleTheme) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  
  // Getters
  getEffectiveMode: () => 'light' | 'dark';
}

// Helper function to get effective mode
function getEffectiveModeFromMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return mode;
}

// Apply theme to document - delegates CSS variables to themes.css via data attributes
// This avoids inline style conflicts with CSS specificity
export function applyUITheme(themeId: UIStyleTheme, mode: 'light' | 'dark') {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  
  // Apply theme ID as data attribute (for CSS variable selectors in themes.css)
  root.setAttribute('data-theme', themeId);
  
  // Apply light/dark class (for .dark theme variants in CSS)
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  
  // Set color-scheme for native browser elements
  root.style.setProperty('color-scheme', mode === 'dark' ? 'dark' : 'light');

  // ── Apply CSS variables from theme config ────────────────────────────
  // This ensures ALL 15 themes get proper sidebar & UI colors,
  // not just the 6 themes that have CSS rules in themes.css.
  const theme = themesConfig[themeId];
  if (theme) {
    const colors = theme.colors[mode];

    // Map camelCase ThemeColor keys to kebab-case CSS variable names
    const cssVarMap: [string, string][] = [
      ['primary', '--primary'],
      ['primaryForeground', '--primary-foreground'],
      ['secondary', '--secondary'],
      ['secondaryForeground', '--secondary-foreground'],
      ['accent', '--accent'],
      ['accentForeground', '--accent-foreground'],
      ['background', '--background'],
      ['foreground', '--foreground'],
      ['card', '--card'],
      ['cardForeground', '--card-foreground'],
      ['muted', '--muted'],
      ['mutedForeground', '--muted-foreground'],
      ['border', '--border'],
      ['ring', '--ring'],
      ['input', '--input'],
      ['destructive', '--destructive'],
      ['destructiveForeground', '--destructive-foreground'],
      ['gradientStart', '--gradient-start'],
      ['gradientEnd', '--gradient-end'],
      ['premium', '--premium'],
      ['premiumForeground', '--premium-foreground'],
      ['sidebar', '--sidebar'],
      ['sidebarForeground', '--sidebar-foreground'],
      ['sidebarPrimary', '--sidebar-primary'],
      ['sidebarPrimaryForeground', '--sidebar-primary-foreground'],
      ['sidebarAccent', '--sidebar-accent'],
      ['sidebarAccentForeground', '--sidebar-accent-foreground'],
      ['sidebarBorder', '--sidebar-border'],
      ['sidebarRing', '--sidebar-ring'],
      ['chart1', '--chart-1'],
      ['chart2', '--chart-2'],
      ['chart3', '--chart-3'],
      ['chart4', '--chart-4'],
      ['chart5', '--chart-5'],
    ];

    for (const [colorKey, cssVar] of cssVarMap) {
      const value = (colors as Record<string, string>)[colorKey];
      if (value) {
        root.style.setProperty(cssVar, value);
      }
    }

    // Apply feature-specific data attributes (for CSS feature selectors)
    const features = theme.features;
    root.setAttribute('data-animations', String(features.animations));
    root.setAttribute('data-glass', String(features.glassEffect));
    root.setAttribute('data-neon', String(features.neonGlow));
    root.setAttribute('data-gradients', String(features.gradients));
    root.setAttribute('data-soft-shadows', String(features.softShadows));
    root.setAttribute('data-rounded', features.roundedCorners);
  }

  // Store in localStorage for persistence
  localStorage.setItem('staysuite-ui-style', themeId);
  localStorage.setItem('staysuite-theme-mode', mode);
}

// Default theme constants
const DEFAULT_UI_THEME: UIStyleTheme = 'gradient-modern';
const DEFAULT_THEME_MODE: ThemeMode = 'system';

export const useUIStyleStore = create<UIStyleState>()(
  persist(
    (set, get) => ({
      // Initial state
      themeId: DEFAULT_UI_THEME,
      mode: DEFAULT_THEME_MODE,

      // Actions
      setTheme: (themeId: UIStyleTheme) => {
        set({ themeId });
        applyUITheme(themeId, get().getEffectiveMode());
      },

      setMode: (mode: ThemeMode) => {
        set({ mode });
        const effectiveMode = getEffectiveModeFromMode(mode);
        applyUITheme(get().themeId, effectiveMode);
      },

      toggleMode: () => {
        const currentMode = get().mode;
        const newMode = currentMode === 'light' ? 'dark' : currentMode === 'dark' ? 'light' : 'dark';
        set({ mode: newMode });
        applyUITheme(get().themeId, newMode);
      },

      // Getters
      getEffectiveMode: () => {
        return getEffectiveModeFromMode(get().mode);
      },
    }),
    {
      name: 'staysuite-ui-style-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        themeId: state.themeId,
        mode: state.mode,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Apply theme on rehydration
          const effectiveMode = getEffectiveModeFromMode(state.mode);
          applyUITheme(state.themeId, effectiveMode);
        }
      },
    }
  )
);

// Initialize theme on first load
export function initializeUITheme() {
  if (typeof window === 'undefined') return;

  const state = useUIStyleStore.getState();
  const effectiveMode = state.getEffectiveMode();
  applyUITheme(state.themeId, effectiveMode);

  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = (e: MediaQueryListEvent) => {
    const currentState = useUIStyleStore.getState();
    if (currentState.mode === 'system') {
      applyUITheme(currentState.themeId, e.matches ? 'dark' : 'light');
    }
  };

  mediaQuery.addEventListener('change', handleChange);
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// These are for compatibility with existing code
// ============================================

// Alias for backward compatibility
export const useThemeStore = useUIStyleStore;
export const initializeTheme = initializeUITheme;
export const applyTheme = applyUITheme;
