'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Bed,
  Calendar,
  Percent,
  BarChart3,
  Target,
  Activity,
  DollarSign,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';

interface Property {
  id: string;
  name: string;
  totalRooms: number;
}

interface RevenueMetrics {
  date: string;
  revenue: number;
  occupancy: number;
  roomsSold: number;
  availableRooms: number;
  adr: number;
  revpar: number;
}

interface KPICard {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  description: string;
}

const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function RevenueDashboard() {
  const { formatCurrency } = useCurrency();
  const { formatDate } = useTimezone();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<RevenueMetrics[]>([]);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (result.success) {
          setProperties(result.data);
          if (result.data.length > 0) {
            setSelectedProperty(result.data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, []);

  // Calculate metrics from bookings
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!selectedProperty) return;
      setIsLoading(true);

      try {
        const property = properties.find(p => p.id === selectedProperty);
        const totalRooms = property?.totalRooms || 100;

        // Fetch bookings
        const response = await fetch(`/api/bookings?propertyId=${selectedProperty}`);
        const result = await response.json();

        if (result.success) {
          const bookings = result.data || [];
          const today = new Date();
          
          // Calculate metrics based on period
          let days = 1;
          if (period === 'week') days = 7;
          if (period === 'month') days = 30;

          const metricsData: RevenueMetrics[] = [];
          
          for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = toLocalDateString(date);

            // Filter bookings for this date
            const dayBookings = bookings.filter((b: any) => {
              const checkIn = new Date(b.checkIn);
              const checkOut = new Date(b.checkOut);
              return date >= checkIn && date < checkOut;
            });

            const roomsSold = dayBookings.length;
            const revenue = dayBookings.reduce((sum: number, b: any) => sum + (b.roomRate || 0), 0);
            const occupancy = totalRooms > 0 ? (roomsSold / totalRooms) * 100 : 0;
            const adr = roomsSold > 0 ? revenue / roomsSold : 0;
            const revpar = totalRooms > 0 ? revenue / totalRooms : 0;

            metricsData.push({
              date: dateStr,
              revenue,
              occupancy,
              roomsSold,
              availableRooms: totalRooms,
              adr,
              revpar,
            });
          }

          setMetrics(metricsData);
        }
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [selectedProperty, period, properties]);

  // Calculate summary stats
  const totalRevenue = metrics.reduce((sum, m) => sum + m.revenue, 0);
  const avgOccupancy = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.occupancy, 0) / metrics.length 
    : 0;
  const avgADR = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.adr, 0) / metrics.length 
    : 0;
  const avgRevPAR = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.revpar, 0) / metrics.length 
    : 0;
  const totalRoomsSold = metrics.reduce((sum, m) => sum + m.roomsSold, 0);

  // Calculate change percentages by comparing second half vs first half of the period
  const calculateChange = (key: 'revenue' | 'occupancy' | 'adr' | 'revpar' | 'roomsSold') => {
    if (metrics.length < 2) return 0;
    const mid = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, mid);
    const secondHalf = metrics.slice(mid);
    const firstHalfAvg = firstHalf.reduce((sum, m) => sum + (m[key] as number), 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, m) => sum + (m[key] as number), 0) / secondHalf.length;
    if (firstHalfAvg === 0) return secondHalfAvg > 0 ? 100 : 0;
    return Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 1000) / 10;
  };

  const kpiCards: KPICard[] = [
    {
      title: 'Total Revenue',
      value: formatCurrency(totalRevenue),
      change: calculateChange('revenue'),
      icon: <IndianRupee className="h-5 w-5" />,
      description: `Last ${period === 'today' ? '24 hours' : period === 'week' ? '7 days' : '30 days'}`,
    },
    {
      title: 'Occupancy Rate',
      value: `${avgOccupancy.toFixed(1)}%`,
      change: calculateChange('occupancy'),
      icon: <Bed className="h-5 w-5" />,
      description: 'Average occupancy',
    },
    {
      title: 'ADR',
      value: formatCurrency(avgADR),
      change: calculateChange('adr'),
      icon: <DollarSign className="h-5 w-5" />,
      description: 'Average Daily Rate',
    },
    {
      title: 'RevPAR',
      value: formatCurrency(avgRevPAR),
      change: calculateChange('revpar'),
      icon: <BarChart3 className="h-5 w-5" />,
      description: 'Revenue per Available Room',
    },
    {
      title: 'Rooms Sold',
      value: totalRoomsSold.toString(),
      change: calculateChange('roomsSold'),
      icon: <Target className="h-5 w-5" />,
      description: 'Total room nights',
    },
    {
      title: 'Avg Daily Guests',
      value: Math.round(totalRoomsSold / (metrics.length || 1)).toString(),
      change: metrics.length >= 2 ? calculateChange('roomsSold') : 0,
      icon: <Users className="h-5 w-5" />,
      description: 'Average guests per day',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Revenue Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            RevPAR, ADR, and occupancy metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedProperty} onValueChange={setSelectedProperty}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((kpi, idx) => (
          <Card key={idx} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-xs font-medium">
                  {kpi.title}
                </span>
                <div className="text-primary/60">{kpi.icon}</div>
              </div>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="flex items-center gap-1 mt-1">
                {kpi.change >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500 dark:text-green-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500 dark:text-red-400" />
                )}
                <span className={cn(
                  "text-xs font-medium",
                  kpi.change >= 0 ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400"
                )}>
                  {kpi.change >= 0 ? '+' : ''}{kpi.change}%
                </span>
                <span className="text-xs text-muted-foreground ml-1">vs prev</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : (
              <div className="space-y-2">
                {/* Simple bar chart representation */}
                <div className="flex items-end gap-1 h-48">
                  {metrics.slice(-14).map((m, idx) => {
                    const maxRevenue = Math.max(...metrics.map(x => x.revenue), 1);
                    const height = (m.revenue / maxRevenue) * 100;
                    return (
                      <div
                        key={idx}
                        className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors cursor-pointer relative group"
                        style={{ height: `${Math.max(height, 5)}%` }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-popover text-popover-foreground text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                          {formatDate(new Date(m.date))}: {formatCurrency(m.revenue)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground pt-2">
                  <span>{metrics[0]?.date ? formatDate(new Date(metrics[0].date)) : ''}</span>
                  <span>{metrics[metrics.length - 1]?.date ? formatDate(new Date(metrics[metrics.length - 1].date)) : ''}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Occupancy Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Occupancy Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-end gap-1 h-48">
                  {metrics.slice(-14).map((m, idx) => {
                    const height = m.occupancy;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex-1 rounded-t transition-colors cursor-pointer relative group",
                          height > 80 ? "bg-green-500/60" :
                          height > 60 ? "bg-green-500/40" :
                          height > 40 ? "bg-yellow-500/40" : "bg-red-500/40"
                        )}
                        style={{ height: `${Math.max(height, 5)}%` }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-popover text-popover-foreground text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                          {formatDate(new Date(m.date))}: {m.occupancy.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground pt-2">
                  <span>{metrics[0]?.date ? formatDate(new Date(metrics[0].date)) : ''}</span>
                  <span>{metrics[metrics.length - 1]?.date ? formatDate(new Date(metrics[metrics.length - 1].date)) : ''}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Date</th>
                    <th className="text-right p-2 font-medium">Revenue</th>
                    <th className="text-right p-2 font-medium">Rooms</th>
                    <th className="text-right p-2 font-medium">Occupancy</th>
                    <th className="text-right p-2 font-medium">ADR</th>
                    <th className="text-right p-2 font-medium">RevPAR</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.slice().reverse().slice(0, 14).map((m, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        {formatDate(new Date(m.date))}
                      </td>
                      <td className="p-2 text-right font-medium">{formatCurrency(m.revenue)}</td>
                      <td className="p-2 text-right">{m.roomsSold}/{m.availableRooms}</td>
                      <td className="p-2 text-right">
                        <span className={cn(
                          "font-medium",
                          m.occupancy > 80 ? "text-green-600 dark:text-green-400" :
                          m.occupancy > 60 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"
                        )}>
                          {m.occupancy.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-2 text-right">{formatCurrency(m.adr)}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(m.revpar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulas Explained */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">Key Metrics Explained</h3>
          <div className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">ADR (Average Daily Rate)</p>
              <p>Total Room Revenue ÷ Number of Rooms Sold</p>
            </div>
            <div>
              <p className="font-medium text-foreground">RevPAR (Revenue Per Available Room)</p>
              <p>Total Room Revenue ÷ Total Available Rooms</p>
              <p className="text-xs mt-1">Or: ADR × Occupancy Rate</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Occupancy Rate</p>
              <p>(Rooms Sold ÷ Total Available Rooms) × 100</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
