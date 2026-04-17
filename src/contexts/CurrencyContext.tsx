'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CurrencySettings {
  code: string;
  symbol: string;
  position: 'before' | 'after';
  decimalPlaces: number;
  thousandSeparator: string;
  decimalSeparator: string;
}

interface CurrencyContextType {
  currency: CurrencySettings;
  formatCurrency: (amount: number) => string;
  formatNumber: (amount: number, decimals?: number) => string;
  setCurrency: (currency: Partial<CurrencySettings>) => void;
  refreshCurrency: () => Promise<void>;
  isLoading: boolean;
}

const defaultCurrency: CurrencySettings = {
  code: 'INR',
  symbol: '₹',
  position: 'before',
  decimalPlaces: 2,
  thousandSeparator: ',',
  decimalSeparator: '.',
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencySettings>(defaultCurrency);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCurrencySettings();
  }, []);

  const fetchCurrencySettings = async () => {
    try {
      const response = await fetch('/api/settings/tax-currency');
      const data = await response.json();
      
      if (data.success && data.data?.currency) {
        setCurrencyState({
          code: data.data.currency.default || 'INR',
          symbol: data.data.currency.symbol || '₹',
          position: data.data.currency.position || 'before',
          decimalPlaces: data.data.currency.decimalPlaces ?? 2,
          thousandSeparator: data.data.currency.thousandSeparator || ',',
          decimalSeparator: data.data.currency.decimalSeparator || '.',
        });
      }
    } catch (error) {
      console.error('Failed to fetch currency settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (amount: number, decimals?: number): string => {
    const dec = decimals ?? currency.decimalPlaces;
    const fixed = amount.toFixed(dec);
    const [intPart, decPart] = fixed.split('.');
    
    // Add thousand separators
    const thousandSep = currency.thousandSeparator === 'none' ? '' : currency.thousandSeparator;
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
    
    if (decPart) {
      return `${formattedInt}${currency.decimalSeparator}${decPart}`;
    }
    return formattedInt;
  };

  const formatCurrency = (amount: number): string => {
    const formatted = formatNumber(Math.abs(amount));
    const withSign = amount < 0 ? `-${formatted}` : formatted;
    
    if (currency.position === 'before') {
      return `${currency.symbol}${withSign}`;
    }
    return `${withSign}${currency.symbol}`;
  };

  const setCurrency = (updates: Partial<CurrencySettings>) => {
    setCurrencyState(prev => ({ ...prev, ...updates }));
  };

  const refreshCurrency = async () => {
    setIsLoading(true);
    await fetchCurrencySettings();
  };

  return (
    <CurrencyContext.Provider value={{ currency, formatCurrency, formatNumber, setCurrency, refreshCurrency, isLoading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

// Utility function for non-React contexts (returns INR formatted)
export function formatCurrencyDefault(amount: number, symbol: string = '₹'): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
