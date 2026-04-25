'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import {
  RefreshCw,
  Plus,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Calendar,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Settings,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface Competitor {
  id: string;
  name: string;
  type: 'direct' | 'indirect';
  rating: number;
  distance: number; // in km
  priceIndex: number; // percentage relative to our price
  avgPrice: number;
  lastUpdated: string;
  url?: string;
}

interface CompetitorPriceData {
  date: string;
  ourPrice: number;
  marketAverage: number;
  minPrice: number;
  maxPrice: number;
}

interface CompetitorPricing {
  competitors: Competitor[];
  priceHistory: CompetitorPriceData[];
  ourPrice: number;
  marketPosition: 'above' | 'below' | 'at';
  priceDifference: number;
  recommendedAction: string;
}

const chartConfig = {
  ourPrice: {
    label: 'Our Price',
    color: '#10b981',
  },
  marketAverage: {
    label: 'Market Average',
    color: '#f59e0b',
  },
  minPrice: {
    label: 'Min Price',
    color: '#ec4899',
  },
  maxPrice: {
    label: 'Max Price',
    color: '#8b5cf6',
  },
} satisfies ChartConfig;

export default function CompetitorPricing() {
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<CompetitorPricing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roomType, setRoomType] = useState('standard');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState({ name: '', url: '', price: '' });
  const [isAdding, setIsAdding] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        roomType,
        date,
      });
      
      const response = await fetch(`/api/revenue/competitor-pricing?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        toast.error('Failed to load competitor pricing');
      }
    } catch (error) {
      console.error('Error fetching competitor pricing:', error);
      toast.error('Failed to load competitor pricing');
    } finally {
      setIsLoading(false);
    }
  }, [roomType, date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
      toast.success('Competitor prices updated');
    } catch (error) {
      toast.error('Failed to refresh prices');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddCompetitor = async () => {
    if (!newCompetitor.name.trim()) {
      toast.error('Please enter a competitor name');
      return;
    }
    setIsAdding(true);
    try {
      const response = await fetch('/api/revenue/competitor-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitorName: newCompetitor.name.trim(),
          competitorUrl: newCompetitor.url.trim() || undefined,
          competitorType: 'direct',
          date: new Date().toISOString().split('T')[0],
          price: parseFloat(newCompetitor.price) || 0,
          source: 'manual',
        }),
      });
      const result = await response.json();

      if (result.success) {
        toast.success(`Competitor "${newCompetitor.name}" added successfully`);
        setIsAddDialogOpen(false);
        setNewCompetitor({ name: '', url: '', price: '' });
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to add competitor');
      }
    } catch {
      toast.error('Failed to connect to server');
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
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

  const marketAvg = data.competitors.reduce((sum, c) => sum + c.avgPrice, 0) / data.competitors.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Competitor Pricing</h2>
          <p className="text-muted-foreground">Monitor and analyze competitor rates</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={roomType} onValueChange={setRoomType}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="deluxe">Deluxe</SelectItem>
              <SelectItem value="suite">Suite</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-36"
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Our Price</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{formatCurrency(data.ourPrice)}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  For {roomType} room
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <DollarSign className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Market Average</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{formatCurrency(marketAvg)}</p>
                <div className="flex items-center gap-1 mt-1">
                  {data.marketPosition === 'above' ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-red-500 dark:text-red-400" />
                      <span className="text-xs text-red-500 dark:text-red-400">{data.priceDifference}% above</span>
                    </>
                  ) : data.marketPosition === 'below' ? (
                    <>
                      <TrendingDown className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                      <span className="text-xs text-emerald-500 dark:text-emerald-400">{Math.abs(data.priceDifference)}% below</span>
                    </>
                  ) : (
                    <>
                      <Minus className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">At market</span>
                    </>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <Building2 className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Competitors Tracked</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{data.competitors.length}</p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                  {data.competitors.filter(c => c.type === 'direct').length} direct competitors
                </p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <Building2 className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Market Position</p>
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100 capitalize">{data.marketPosition}</p>
                <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                  Average position
                </p>
              </div>
              <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                {data.marketPosition === 'above' ? (
                  <TrendingUp className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
                ) : data.marketPosition === 'below' ? (
                  <TrendingDown className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
                ) : (
                  <Minus className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Price History Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Price History Comparison</CardTitle>
          <CardDescription>Your rates vs market average over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <LineChart data={data.priceHistory}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => format(new Date(v), 'MMM dd')}
                className="text-xs"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                className="text-xs"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrency(v)}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="ourPrice"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="marketAverage"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Competitor List and Recommendation */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Competitor List */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Competitor Rates</CardTitle>
              <CardDescription>Current pricing from tracked competitors</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Competitor
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.competitors.map((competitor) => {
                const diff = ((data.ourPrice - competitor.avgPrice) / competitor.avgPrice) * 100;
                return (
                  <div
                    key={competitor.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{competitor.name}</p>
                          <Badge
                            variant="secondary"
                            className={
                              competitor.type === 'direct'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                : 'bg-muted'
                            }
                          >
                            {competitor.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Rating: {competitor.rating}</span>
                          <span>•</span>
                          <span>{competitor.distance}km away</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(competitor.avgPrice)}</p>
                        <div className="flex items-center gap-1">
                          {diff > 0 ? (
                            <>
                              <TrendingUp className="h-3 w-3 text-red-500 dark:text-red-400" />
                              <span className="text-xs text-red-500 dark:text-red-400">+{diff.toFixed(1)}%</span>
                            </>
                          ) : diff < 0 ? (
                            <>
                              <TrendingDown className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                              <span className="text-xs text-emerald-500 dark:text-emerald-400">{diff.toFixed(1)}%</span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Same</span>
                          )}
                        </div>
                      </div>
                      <div className="w-20">
                        <Progress
                          value={competitor.priceIndex}
                          className="h-2"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recommendation */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              <CardTitle className="text-lg">Recommendation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`p-4 rounded-lg ${
              data.marketPosition === 'above'
                ? 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'
                : data.marketPosition === 'below'
                ? 'bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800'
                : 'bg-muted/50 border'
            }`}>
              <div className="flex items-start gap-3">
                {data.marketPosition === 'above' ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400 mt-0.5" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-emerald-500 dark:text-emerald-400 mt-0.5" />
                )}
                <div>
                  <h4 className="font-medium text-sm mb-1">
                    {data.marketPosition === 'above' ? 'Price Optimization Suggested' : 'Competitive Position'}
                  </h4>
                  <p className="text-sm text-muted-foreground">{data.recommendedAction}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Price Position Analysis</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Our Price</span>
                  <span className="font-medium">{formatCurrency(data.ourPrice)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Market Low</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(Math.min(...data.competitors.map(c => c.avgPrice)))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Market High</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {formatCurrency(Math.max(...data.competitors.map(c => c.avgPrice)))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Market Avg</span>
                  <span className="font-medium">{formatCurrency(marketAvg)}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Last updated: {format(new Date(), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Competitor Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Competitor</DialogTitle>
            <DialogDescription>
              Add a competitor to track their pricing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Competitor Name *</label>
              <Input
                placeholder="e.g. Hilton Downtown"
                value={newCompetitor.name}
                onChange={(e) => setNewCompetitor(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Website URL (optional)</label>
              <Input
                placeholder="https://example.com"
                value={newCompetitor.url}
                onChange={(e) => setNewCompetitor(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Price (optional)</label>
              <Input
                type="number"
                placeholder="0"
                value={newCompetitor.price}
                onChange={(e) => setNewCompetitor(prev => ({ ...prev, price: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddCompetitor}
              disabled={isAdding || !newCompetitor.name.trim()}
            >
              {isAdding ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
