'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface Tax {
  id: string;
  name: string;
  rate: number;
  type: 'percentage' | 'fixed';
  appliesTo: 'all' | 'room' | 'food' | 'beverage' | 'services' | 'amenities' | 'spa' | 'events' | 'other';
  included: boolean;
  enabled: boolean;
  priority: number;
  compound: boolean;
}

export interface TaxGroup {
  id: string;
  name: string;
  taxes: string[];
  isDefault: boolean;
}

interface TaxCalculationResult {
  subtotal: number;
  taxes: Array<{
    tax: Tax;
    amount: number;
  }>;
  totalTax: number;
  total: number;
}

interface TaxContextType {
  taxes: Tax[];
  taxGroups: TaxGroup[];
  isLoading: boolean;
  getTaxesForCategory: (category: string) => Tax[];
  calculateTax: (amount: number, category: string, includeInPrice?: boolean) => TaxCalculationResult;
  getTaxById: (id: string) => Tax | undefined;
  getTaxGroupById: (id: string) => TaxGroup | undefined;
  refreshTaxes: () => Promise<void>;
  formatTaxRate: (tax: Tax) => string;
}

const TaxContext = createContext<TaxContextType | undefined>(undefined);

export function TaxProvider({ children }: { children: ReactNode }) {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [taxGroups, setTaxGroups] = useState<TaxGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTaxSettings();
  }, []);

  const fetchTaxSettings = async () => {
    try {
      const response = await fetch('/api/settings/tax-currency');
      const data = await response.json();
      
      if (data.success) {
        setTaxes(data.data.taxes || []);
        setTaxGroups(data.data.taxGroups || []);
      }
    } catch (error) {
      console.error('Failed to fetch tax settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTaxById = useCallback((id: string): Tax | undefined => {
    return taxes.find(t => t.id === id);
  }, [taxes]);

  const getTaxGroupById = useCallback((id: string): TaxGroup | undefined => {
    return taxGroups.find(g => g.id === id);
  }, [taxGroups]);

  // Map category to tax appliesTo
  const categoryMapping: Record<string, string> = {
    'room': 'room',
    'food': 'food',
    'beverage': 'beverage',
    'services': 'services',
    'amenities': 'amenities',
    'spa': 'spa',
    'events': 'events',
    'other': 'other',
    'all': 'all',
  };

  const getTaxesForCategory = useCallback((category: string): Tax[] => {
    const mappedCategory = categoryMapping[category.toLowerCase()] || 'other';
    
    return taxes.filter(tax => {
      if (!tax.enabled) return false;
      if (tax.appliesTo === 'all') return true;
      return tax.appliesTo === mappedCategory;
    }).sort((a, b) => a.priority - b.priority);
  }, [taxes]);

  const calculateTax = useCallback((
    amount: number,
    category: string,
    includeInPrice?: boolean
  ): TaxCalculationResult => {
    const applicableTaxes = getTaxesForCategory(category);
    const result: TaxCalculationResult = {
      subtotal: amount,
      taxes: [],
      totalTax: 0,
      total: amount,
    };

    let runningAmount = amount;

    for (const tax of applicableTaxes) {
      let taxAmount = 0;
      
      if (tax.type === 'percentage') {
        // For compound taxes, use the running amount (includes previous taxes)
        // For non-compound, use the original amount
        const baseAmount = tax.compound ? runningAmount : amount;
        taxAmount = (baseAmount * tax.rate) / 100;
      } else {
        // Fixed amount tax
        taxAmount = tax.rate;
      }

      result.taxes.push({ tax, amount: taxAmount });
      result.totalTax += taxAmount;
      runningAmount += taxAmount;
    }

    // If taxes are included in price, extract them
    if (includeInPrice) {
      result.total = amount;
      result.subtotal = amount - result.totalTax;
    } else {
      result.total = amount + result.totalTax;
    }

    return result;
  }, [getTaxesForCategory]);

  const formatTaxRate = useCallback((tax: Tax): string => {
    if (tax.type === 'percentage') {
      return `${tax.rate}%`;
    }
    return `${tax.rate}`;
  }, []);

  const refreshTaxes = async () => {
    setIsLoading(true);
    await fetchTaxSettings();
  };

  return (
    <TaxContext.Provider value={{
      taxes,
      taxGroups,
      isLoading,
      getTaxesForCategory,
      calculateTax,
      getTaxById,
      getTaxGroupById,
      refreshTaxes,
      formatTaxRate,
    }}>
      {children}
    </TaxContext.Provider>
  );
}

export function useTax() {
  const context = useContext(TaxContext);
  if (context === undefined) {
    throw new Error('useTax must be used within a TaxProvider');
  }
  return context;
}

// Utility function for non-React contexts
export function calculateTaxAmount(amount: number, taxes: Tax[], category: string): number {
  const applicableTaxes = taxes.filter(tax => {
    if (!tax.enabled) return false;
    if (tax.appliesTo === 'all') return true;
    return tax.appliesTo.toLowerCase() === category.toLowerCase();
  });

  let totalTax = 0;
  for (const tax of applicableTaxes) {
    if (tax.type === 'percentage') {
      totalTax += (amount * tax.rate) / 100;
    } else {
      totalTax += tax.rate;
    }
  }
  return totalTax;
}
