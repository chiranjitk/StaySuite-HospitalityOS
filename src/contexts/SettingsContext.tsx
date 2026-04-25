'use client';

import { createContext, useContext, ReactNode, useCallback } from 'react';
import { useCurrency } from './CurrencyContext';
import { useTimezone } from './TimezoneContext';

interface SettingsContextType {
  refreshAllSettings: () => Promise<void>;
  isAnyLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { refreshCurrency, isLoading: currencyLoading } = useCurrency();
  const { refreshSettings, isLoading: timezoneLoading } = useTimezone();

  const refreshAllSettings = useCallback(async () => {
    await Promise.all([
      refreshCurrency(),
      refreshSettings(),
    ]);
  }, [refreshCurrency, refreshSettings]);

  const isAnyLoading = currencyLoading || timezoneLoading;

  return (
    <SettingsContext.Provider value={{ refreshAllSettings, isAnyLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
