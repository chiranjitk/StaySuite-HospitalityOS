'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';

interface PropertyData {
  id: string;
  name: string;
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  occupancyRate: number;
  totalRevenue: number;
  avgDailyRevenue: number;
  revPAR: number;
  avgBookingValue: number;
  totalBookings: number;
}

interface MetricConfig {
  key: keyof PropertyData;
  label: string;
  format: 'percent' | 'currency' | 'number';
  suffix?: string;
}

const metrics: MetricConfig[] = [
  { key: 'occupancyRate', label: 'Occupancy', format: 'percent', suffix: '%' },
  { key: 'avgDailyRevenue', label: 'ADR', format: 'currency' },
  { key: 'revPAR', label: 'RevPAR', format: 'currency' },
  { key: 'totalRevenue', label: 'Total Revenue', format: 'currency' },
];

function MiniBarChart({ values, highlightIndex }: { values: number[]; highlightIndex: number }) {
  const max = Math.max(...values, 1);

  return (
    <div className="flex gap-1 items-end h-6">
      {values.map((value, i) => {
        const height = Math.max(4, (value / max) * 100);
        const isHighlight = i === highlightIndex;
        return (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-sm transition-all duration-300',
              isHighlight
                ? 'bg-gradient-to-t from-emerald-500 to-emerald-400 shadow-sm'
                : 'bg-muted-300 dark:bg-muted-600'
            )}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}

export function PropertyComparison() {
  const [properties, setProperties] = useState<PropertyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { formatCurrency } = useCurrency();

  const fetchComparison = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/property-comparison');
      const result = await response.json();
      if (result.success) {
        setProperties(result.data);
      }
    } catch (error) {
      console.error('Error fetching property comparison:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComparison();
    const interval = setInterval(fetchComparison, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [fetchComparison]);

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl hover:shadow-md transition-all duration-300">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  if (properties.length < 2) {
    return null;
  }

  const [prop1, prop2] = properties;
  const barValues = metrics.map((m) => [
    m.format === 'percent' ? (prop1[m.key] as number) : (prop1[m.key] as number),
    m.format === 'percent' ? (prop2[m.key] as number) : (prop2[m.key] as number),
  ]);

  const formatValue = (value: number, format: string) => {
    switch (format) {
      case 'percent':
        return `${value}%`;
      case 'currency':
        return formatCurrency(value);
      default:
        return value.toLocaleString();
    }
  };

  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Property Comparison
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fetchComparison}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* Property names header */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Metric</div>
          <div className="text-xs font-semibold text-right truncate">{prop1.name}</div>
          <div className="text-xs font-semibold text-right truncate">{prop2.name}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {metrics.map((metric, idx) => {
            const val1 = prop1[metric.key] as number;
            const val2 = prop2[metric.key] as number;
            const prop1Wins = val1 > val2;

            return (
              <div key={metric.key} className="space-y-1.5">
                <div className="grid grid-cols-3 gap-2 items-center">
                  <div className="text-xs text-muted-foreground font-medium">{metric.label}</div>
                  <div className={cn('text-right text-sm font-bold tabular-nums', prop1Wins ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                    {formatValue(val1, metric.format)}
                  </div>
                  <div className={cn('text-right text-sm font-bold tabular-nums', !prop1Wins ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                    {formatValue(val2, metric.format)}
                  </div>
                </div>
                <MiniBarChart
                  values={barValues[idx]}
                  highlightIndex={prop1Wins ? 0 : 1}
                />
              </div>
            );
          })}
        </div>

        {/* Bottom summary */}
        <div className="mt-3 pt-2 border-t border-border/50 grid grid-cols-3 gap-2">
          <div />
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Occupancy</span>
            <div className="flex items-center justify-center gap-1">
              <span className="text-sm font-bold">{prop1.occupiedRooms}/{prop1.totalRooms}</span>
            </div>
          </div>
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Occupancy</span>
            <div className="flex items-center justify-center gap-1">
              <span className="text-sm font-bold">{prop2.occupiedRooms}/{prop2.totalRooms}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
