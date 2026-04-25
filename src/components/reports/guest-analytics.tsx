'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Download,
  Calendar,
  Users,
  Star,
  MapPin,
  Mail,
  Phone,
  Crown,
  Gift,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/export-utils';

interface GuestAnalytics {
  totalGuests: number;
  newGuests: number;
  returningGuests: number;
  vipGuests: number;
  avgStayLength: number;
  loyaltyDistribution: { tier: string; count: number }[];
  sourceDistribution: { source: string; count: number }[];
  topNationalities: { country: string; count: number }[];
  ageDistribution: { range: string; count: number }[];
  recentGuests: {
    id: string;
    name: string;
    email: string;
    loyaltyTier: string;
    totalStays: number;
    totalSpent: number;
  }[];
}

const chartConfig = {
  count: {
    label: 'Count',
    color: '#10b981',
  },
} satisfies ChartConfig;

const chartColors = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f43f5e', // rose
];

const tierColors: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  silver: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  gold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  platinum: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
};

const countryFlags: Record<string, string> = {
  'United States': '🇺🇸',
  'United Kingdom': '🇬🇧',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Japan': '🇯🇵',
  'China': '🇨🇳',
  'India': '🇮🇳',
  'Australia': '🇦🇺',
  'Canada': '🇨🇦',
  'Brazil': '🇧🇷',
  'Italy': '🇮🇹',
  'Spain': '🇪🇸',
  'Mexico': '🇲🇽',
  'South Korea': '🇰🇷',
  'Netherlands': '🇳🇱',
  'Switzerland': '🇨🇭',
  'Singapore': '🇸🇬',
  'UAE': '🇦🇪',
  'Saudi Arabia': '🇸🇦',
  'Russia': '🇷🇺',
};

const sourceGradientColors: Record<string, string> = {
  direct: 'bg-gradient-to-r from-blue-500 to-blue-400',
  booking_com: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
  expedia: 'bg-gradient-to-r from-amber-500 to-amber-400',
  airbnb: 'bg-gradient-to-r from-violet-500 to-violet-400',
  walk_in: 'bg-gradient-to-r from-teal-500 to-teal-400',
  corporate: 'bg-gradient-to-r from-cyan-500 to-cyan-400',
  group: 'bg-gradient-to-r from-rose-500 to-rose-400',
  online: 'bg-gradient-to-r from-indigo-500 to-indigo-400',
  referral: 'bg-gradient-to-r from-pink-500 to-pink-400',
};

export function GuestAnalytics() {
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<GuestAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/guests/analytics?dateRange=${dateRange}`);
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError('Failed to load guest analytics');
        }
      } catch (err) {
        console.error('Failed to fetch guest analytics:', err);
        setError('Failed to load guest analytics');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => {
            // Toggle dateRange to a different value and back to force re-fetch
            const current = dateRange;
            setDateRange('');
            setTimeout(() => setDateRange(current), 0);
          }}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const returningRate = data.totalGuests > 0 ? (data.returningGuests / data.totalGuests) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Guest Analytics</h2>
          <p className="text-muted-foreground">Understanding your guest demographics and behavior</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCSV(
            data.recentGuests.map(g => ({
              name: g.name,
              email: g.email,
              loyaltyTier: g.loyaltyTier,
              totalStays: g.totalStays,
              totalSpent: g.totalSpent,
            })),
            `guest-analytics-${dateRange}d`,
            [
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
              { key: 'loyaltyTier', label: 'Loyalty Tier' },
              { key: 'totalStays', label: 'Total Stays' },
              { key: 'totalSpent', label: 'Total Spent ($)' },
            ]
          )}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Guests</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-teal-500 bg-clip-text text-transparent dark:from-emerald-300 dark:to-teal-200">{data.totalGuests}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  {data.newGuests} new this period
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <Users className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Returning Rate</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-amber-700 to-amber-500 bg-clip-text text-transparent dark:from-amber-300 dark:to-amber-200">{returningRate.toFixed(1)}%</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {data.returningGuests} repeat guests
                </p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <TrendingUp className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">VIP Guests</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-violet-700 to-violet-500 bg-clip-text text-transparent dark:from-violet-300 dark:to-violet-200">{data.vipGuests}</p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                  Premium tier members
                </p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <Crown className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Avg Stay Length</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-cyan-700 to-cyan-500 bg-clip-text text-transparent dark:from-cyan-300 dark:to-cyan-200">{data.avgStayLength.toFixed(1)} nights</p>
                <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                  Per booking
                </p>
              </div>
              <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                <Star className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Loyalty Distribution */}
        <Card className="border-0 shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle className="text-lg">Loyalty Tier Distribution</CardTitle>
            <CardDescription>Guests by membership level</CardDescription>
          </CardHeader>
          <CardContent>
            {data.loyaltyDistribution.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <PieChart>
                  <Pie
                    data={data.loyaltyDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="count"
                    nameKey="tier"
                    paddingAngle={2}
                  >
                    {data.loyaltyDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {data.loyaltyDistribution.map((item, index) => (
                <Badge key={item.tier} className={tierColors[item.tier] || ''}>
                  {item.tier.charAt(0).toUpperCase() + item.tier.slice(1)}: {item.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Booking Source Distribution */}
        <Card className="border-0 shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle className="text-lg">Booking Sources</CardTitle>
            <CardDescription>Where guests come from</CardDescription>
          </CardHeader>
          <CardContent>
            {data.sourceDistribution.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <BarChart data={data.sourceDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                  <XAxis dataKey="source" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis className="text-xs" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.sourceDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Nationalities */}
        <Card className="border-0 shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              <CardTitle className="text-lg">Top Nationalities</CardTitle>
            </div>
            <CardDescription>Guest origin countries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.topNationalities.length > 0 ? data.topNationalities.map((item, index) => {
              const maxCount = data.topNationalities[0]?.count || 1;
              const percentage = (item.count / maxCount) * 100;
              return (
                <div key={item.country} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2">
                      {countryFlags[item.country] || '🌍'} {item.country}
                    </span>
                    <span className="text-muted-foreground">{item.count}</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            }) : (
              <div className="h-[150px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Age Distribution */}
        <Card className="border-0 shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              <CardTitle className="text-lg">Age Distribution</CardTitle>
            </div>
            <CardDescription>Guest age groups</CardDescription>
          </CardHeader>
          <CardContent>
            {data.ageDistribution.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[180px] w-full">
                <BarChart data={data.ageDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" horizontal vertical={false} />
                  <XAxis type="number" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="range"
                    type="category"
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    width={50}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {data.ageDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Guests */}
      <Card className="border-0 shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-violet-500 dark:text-violet-400" />
            <CardTitle className="text-lg">Top Guests</CardTitle>
          </div>
          <CardDescription>Highest value guests by total spend</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentGuests.length > 0 ? (
            <div className="space-y-4">
              {data.recentGuests.map((guest, index) => (
                <div
                  key={guest.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                      {index + 1}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                        {guest.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{guest.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {guest.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={tierColors[guest.loyaltyTier] || ''}>
                      {guest.loyaltyTier.charAt(0).toUpperCase() + guest.loyaltyTier.slice(1)}
                    </Badge>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(guest.totalSpent)}</p>
                      <p className="text-xs text-muted-foreground">{guest.totalStays} stays</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No guest data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
