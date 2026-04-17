'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, DollarSign, TrendingUp, Users, Target, BarChart3 } from 'lucide-react';
import { SectionGuard } from '@/components/common/section-guard';
import { useCurrency } from '@/contexts/CurrencyContext';

interface RevenueData {
  overview: {
    totalRevenue: number;
    mrr: number;
    arr: number;
    growth: number;
    churnRate: number;
    ltv: number;
    cac: number;
  };
  byPlan: Array<{ plan: string; tenants: number; revenue: number; percentage: number }>;
  monthly: Array<{ month: string; revenue: number; tenants: number }>;
}

export function RevenueAnalytics() {
  const { formatCurrency } = useCurrency();
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRevenue();
  }, []);

  const fetchRevenue = async () => {
    try {
      const response = await fetch('/api/admin/revenue');
      const data = await response.json();
      if (data.success) {
        setRevenueData(data.data);
      }
    } catch {
      console.error('Failed to fetch revenue data');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !revenueData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SectionGuard permission="admin.revenue">
      <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Platform Revenue Analytics</h2>
        <p className="text-muted-foreground">Track platform-wide revenue and subscription metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Monthly Recurring Revenue</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(revenueData.overview.mrr)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Annual Recurring Revenue</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(revenueData.overview.arr)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Revenue Growth</CardDescription>
            <CardTitle className="text-2xl">+{revenueData.overview.growth}%</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Churn Rate</CardDescription>
            <CardTitle className="text-2xl">{revenueData.overview.churnRate}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Customer Lifetime Value
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(revenueData.overview.ltv)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customer Acquisition Cost
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(revenueData.overview.cac)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              LTV:CAC Ratio
            </CardDescription>
            <CardTitle className="text-2xl">{(revenueData.overview.ltv / revenueData.overview.cac).toFixed(1)}:1</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Revenue by Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Revenue by Plan
          </CardTitle>
          <CardDescription>Revenue breakdown by subscription plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {revenueData.byPlan.map((plan) => (
              <div key={plan.plan} className="flex items-center gap-4">
                <div className="w-32">
                  <p className="font-medium capitalize">{plan.plan}</p>
                  <p className="text-sm text-muted-foreground">{plan.tenants} tenants</p>
                </div>
                <div className="flex-1">
                  <div className="h-8 bg-muted rounded-lg overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center px-3"
                      style={{ width: `${plan.percentage}%` }}
                    >
                      <span className="text-xs text-white font-medium">{plan.percentage}%</span>
                    </div>
                  </div>
                </div>
                <div className="w-28 text-right font-medium">
                  {formatCurrency(plan.revenue)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Monthly Revenue Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {revenueData.monthly.map((month, index) => {
              const maxRevenue = Math.max(...revenueData.monthly.map(m => m.revenue));
              const percentage = (month.revenue / maxRevenue) * 100;
              return (
                <div key={month.month} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-muted-foreground">{month.month}</div>
                  <div className="flex-1">
                    <div className="h-6 bg-muted rounded overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 flex items-center justify-end px-2"
                        style={{ width: `${percentage}%` }}
                      >
                        <span className="text-xs text-white font-medium">{formatCurrency(month.revenue)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-20 text-sm text-muted-foreground">
                    {month.tenants} tenants
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
    </SectionGuard>
  );
}

export default RevenueAnalytics;
