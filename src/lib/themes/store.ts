/**
 * UI Style Theme Store - Zustand store for theme management
 * Handles 10 UI style themes (6 Original + 4 Premium Netflix-style)
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
  | 'scarlet-noir';

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

// Apply theme to document - sets CSS custom properties from theme config
export function applyUITheme(themeId: UIStyleTheme, mode: 'light' | 'dark') {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  
  // Apply theme ID as data attribute (for CSS feature selectors)
  root.setAttribute('data-theme', themeId);
  
  // Apply light/dark class
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  
  // ── Apply CSS variables from theme config ────────────────────────────
  const theme = themesConfig[themeId];
  if (!theme) return;

  const colors = theme.colors[mode];
  const cssVarMap: Record<string, string> = {
    '--background': colors.background,
    '--foreground': colors.foreground,
    '--card': colors.card,
    '--card-foreground': colors.cardForeground,
    '--popover': colors.card,
    '--popover-foreground': colors.cardForeground,
    '--primary': colors.primary,
    '--primary-foreground': colors.primaryForeground,
    '--secondary': colors.secondary,
    '--secondary-foreground': colors.secondaryForeground,
    '--muted': colors.muted,
    '--muted-foreground': colors.mutedForeground,
    '--accent': colors.accent,
    '--accent-foreground': colors.accentForeground,
    '--destructive': colors.destructive,
    '--destructive-foreground': colors.destructiveForeground,
    '--border': colors.border,
    '--input': colors.input,
    '--ring': colors.ring,
    '--gradient-start': colors.gradientStart,
    '--gradient-end': colors.gradientEnd,
    '--premium': colors.premium,
    '--premium-foreground': colors.premiumForeground,
    '--sidebar': colors.sidebar,
    '--sidebar-foreground': colors.sidebarForeground,
    '--sidebar-primary': colors.sidebarPrimary,
    '--sidebar-primary-foreground': colors.sidebarPrimaryForeground,
    '--sidebar-accent': colors.sidebarAccent,
    '--sidebar-accent-foreground': colors.sidebarAccentForeground,
    '--sidebar-border': colors.sidebarBorder,
    '--sidebar-ring': colors.sidebarRing,
    '--chart-1': colors.chart1,
    '--chart-2': colors.chart2,
    '--chart-3': colors.chart3,
    '--chart-4': colors.chart4,
    '--chart-5': colors.chart5,
  };

  for (const [varName, value] of Object.entries(cssVarMap)) {
    root.style.setProperty(varName, value);
  }

  // Apply feature-specific attributes
  const features = theme.features;
  root.setAttribute('data-animations', String(features.animations));
  root.setAttribute('data-glass', String(features.glassEffect));
  root.setAttribute('data-neon', String(features.neonGlow));
  root.setAttribute('data-gradients', String(features.gradients));
  root.setAttribute('data-soft-shadows', String(features.softShadows));
  root.setAttribute('data-rounded', features.roundedCorners);

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
