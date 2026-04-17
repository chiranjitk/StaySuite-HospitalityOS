'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  Activity,
  Database,
  MessageSquare,
  Users,
  Home,
  RefreshCw,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Zap,
  Clock,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format as formatDayOfWeek, subDays } from 'date-fns'; // Keep for day-of-week formatting and date calculations

interface UsageMetric {
  used: number;
  limit: number;
  unit: string;
}

interface UsageOverview {
  apiCalls: UsageMetric;
  storage: UsageMetric;
  messages: UsageMetric;
  users: UsageMetric;
  properties: UsageMetric;
  rooms: UsageMetric;
}

interface DailyUsage {
  date: string;
  apiCalls: number;
  messages: number;
  storage: number;
}

interface UsageBreakdown {
  bookings: { apiCalls: number; percentage: number };
  guests: { apiCalls: number; percentage: number };
  billing: { apiCalls: number; percentage: number };
  reports: { apiCalls: number; percentage: number };
  integrations: { apiCalls: number; percentage: number };
  other: { apiCalls: number; percentage: number };
}

interface UsageAlert {
  type: string;
  message: string;
  createdAt: string;
}

interface UsageData {
  tenantId: string;
  period: string;
  overview: UsageOverview;
  daily: DailyUsage[];
  breakdown: UsageBreakdown;
  alerts: UsageAlert[];
}

interface BillingCalculation {
  basePlan: string;
  basePrice: number;
  currency: string;
  usageCharges: {
    apiCalls: number;
    storage: number;
    messages: number;
    total: number;
  };
  overageCharges: number;
  totalAmount: number;
  billingPeriod: string;
  rates: {
    apiCallOveragePerUnit: number;
    storageOveragePerMb: number;
    messageOveragePerUnit: number;
  };
}

const periodOptions = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
];

export default function UsageBilling() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate, formatTime, formatDateTime, settings } = useTimezone();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [billingData, setBillingData] = useState<BillingCalculation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Fetch usage data
  const fetchUsageData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/usage?period=${period}`);
      const result = await response.json();

      if (result.success) {
        setUsageData(result.data);
      }

      // Fetch billing data from server (not calculated client-side)
      try {
        const billingRes = await fetch(`/api/admin/usage-billing?period=${period}`);
        const billingResult = await billingRes.json();
        if (billingResult.success) {
          setBillingData(billingResult.data);
        }
      } catch (billingErr) {
        console.error('Error fetching billing data:', billingErr);
        toast({
          title: 'Billing Warning',
          description: 'Billing data could not be loaded from server',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching usage data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch usage data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
  }, [period]);

  // NOTE: Billing calculation removed from client-side.
  // All billing is now calculated server-side via /api/admin/usage-billing
  // and fetched in fetchUsageData(). This prevents tampering with prices/overage rates.

  const getUsagePercent = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'text-red-500';
    if (percent >= 75) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 75) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const viewMetricDetail = (metricKey: string) => {
    setSelectedMetric(metricKey);
    setIsDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!usageData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mb-4" />
        <p>No usage data available</p>
      </div>
    );
  }

  const { overview, daily, breakdown, alerts } = usageData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Usage & Billing
          </h2>
          <p className="text-sm text-muted-foreground">
            Track usage metrics and billing calculations
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchUsageData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Billing Summary */}
      {billingData && (
        <Card className="border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Billing Estimate</p>
                <p className="text-3xl font-bold">{formatCurrency(billingData.totalAmount)}</p>
                <p className="text-sm text-muted-foreground">{billingData.billingPeriod} billing cycle</p>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Base Plan</p>
                  <p className="font-medium">{formatCurrency(billingData.basePrice)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Usage</p>
                  <p className="font-medium">
                    {formatCurrency(billingData.usageCharges.total)}
                  </p>
                </div>
                {billingData.overageCharges > 0 && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Overage</p>
                    <p className="font-medium text-red-500">+{formatCurrency(billingData.overageCharges)}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-amber-700">Usage Alerts</h4>
                <div className="mt-2 space-y-2">
                  {alerts.map((alert, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-amber-700">{alert.message}</span>
                      <Badge variant="outline" className={alert.type === 'critical' ? 'border-red-500 text-red-500' : 'border-amber-500 text-amber-500'}>
                        {alert.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Overview Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => viewMetricDetail('apiCalls')}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Activity className="h-4 w-4 text-violet-500" />
            </div>
            <span className="text-xs text-muted-foreground">API Calls</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className={cn('text-xl font-bold', getUsageColor(getUsagePercent(overview.apiCalls.used, overview.apiCalls.limit)))}>
                {overview.apiCalls.used.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">/ {overview.apiCalls.limit.toLocaleString()}</span>
            </div>
            <Progress 
              value={getUsagePercent(overview.apiCalls.used, overview.apiCalls.limit)} 
              className="h-1.5"
            />
          </div>
        </Card>

        <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => viewMetricDetail('storage')}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Database className="h-4 w-4 text-cyan-500" />
            </div>
            <span className="text-xs text-muted-foreground">Storage</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className={cn('text-xl font-bold', getUsageColor(getUsagePercent(overview.storage.used, overview.storage.limit)))}>
                {overview.storage.used}
              </span>
              <span className="text-xs text-muted-foreground">/ {overview.storage.limit} MB</span>
            </div>
            <Progress 
              value={getUsagePercent(overview.storage.used, overview.storage.limit)} 
              className="h-1.5"
            />
          </div>
        </Card>

        <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => viewMetricDetail('messages')}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <MessageSquare className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-xs text-muted-foreground">Messages</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className={cn('text-xl font-bold', getUsageColor(getUsagePercent(overview.messages.used, overview.messages.limit)))}>
                {overview.messages.used.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">/ {overview.messages.limit.toLocaleString()}</span>
            </div>
            <Progress 
              value={getUsagePercent(overview.messages.used, overview.messages.limit)} 
              className="h-1.5"
            />
          </div>
        </Card>

        <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => viewMetricDetail('users')}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Users className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-xs text-muted-foreground">Users</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold">{overview.users.used}</span>
              <span className="text-xs text-muted-foreground">/ {overview.users.limit}</span>
            </div>
            <Progress 
              value={getUsagePercent(overview.users.used, overview.users.limit)} 
              className="h-1.5"
            />
          </div>
        </Card>

        <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => viewMetricDetail('properties')}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-pink-500/10">
              <Home className="h-4 w-4 text-pink-500" />
            </div>
            <span className="text-xs text-muted-foreground">Properties</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold">{overview.properties.used}</span>
              <span className="text-xs text-muted-foreground">/ {overview.properties.limit}</span>
            </div>
            <Progress 
              value={getUsagePercent(overview.properties.used, overview.properties.limit)} 
              className="h-1.5"
            />
          </div>
        </Card>

        <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => viewMetricDetail('rooms')}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-indigo-500/10">
              <Activity className="h-4 w-4 text-indigo-500" />
            </div>
            <span className="text-xs text-muted-foreground">Rooms</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold">{overview.rooms.used}</span>
              <span className="text-xs text-muted-foreground">/ {overview.rooms.limit}</span>
            </div>
            <Progress 
              value={getUsagePercent(overview.rooms.used, overview.rooms.limit)} 
              className="h-1.5"
            />
          </div>
        </Card>
      </div>

      {/* Detailed Sections */}
      <Tabs defaultValue="breakdown" className="space-y-4">
        <TabsList>
          <TabsTrigger value="breakdown">API Breakdown</TabsTrigger>
          <TabsTrigger value="daily">Daily Usage</TabsTrigger>
          <TabsTrigger value="billing">Billing Details</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Usage by Category</CardTitle>
              <CardDescription>Distribution of API calls across different modules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(breakdown).map(([key, data]) => (
                  <Card key={key} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium capitalize">{key}</span>
                      <Badge variant="outline">{data.percentage}%</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{data.apiCalls.toLocaleString()} calls</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                    <Progress value={data.percentage} className="h-1.5 mt-2" />
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Usage Trends</CardTitle>
              <CardDescription>Last 7 days usage activity</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>API Calls</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Storage (MB)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daily.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{formatDate(day.date)}</p>
                            <p className="text-xs text-muted-foreground">{formatDayOfWeek(new Date(day.date), 'EEEE')}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-violet-500" />
                            <span>{day.apiCalls.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-emerald-500" />
                            <span>{day.messages.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-cyan-500" />
                            <span>{day.storage}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          {billingData && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Current Charges</CardTitle>
                  <CardDescription>Breakdown of current billing cycle</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">Base Plan: {billingData.basePlan}</p>
                        <p className="text-sm text-muted-foreground">Monthly subscription</p>
                      </div>
                      <span className="font-bold">{formatCurrency(billingData.basePrice)}</span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Usage Charges</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-violet-500" />
                            API Calls
                          </span>
                          <span>{formatCurrency(billingData.usageCharges.apiCalls)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-cyan-500" />
                            Storage
                          </span>
                          <span>{formatCurrency(billingData.usageCharges.storage)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-emerald-500" />
                            Messages
                          </span>
                          <span>{formatCurrency(billingData.usageCharges.messages)}</span>
                        </div>
                      </div>
                    </div>

                    {billingData.overageCharges > 0 && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-red-700">Overage Charges</p>
                            <p className="text-sm text-red-600">Exceeded plan limits</p>
                          </div>
                          <span className="font-bold text-red-600">+{formatCurrency(billingData.overageCharges)}</span>
                        </div>
                      </div>
                    )}

                    <Separator />

                    <div className="flex items-center justify-between p-3 rounded-lg bg-violet-500/10">
                      <span className="font-medium">Total Amount</span>
                      <span className="text-xl font-bold">{formatCurrency(billingData.totalAmount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Rate Card</CardTitle>
                  <CardDescription>Usage-based pricing rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-violet-500" />
                        <span className="font-medium">API Calls</span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Included: Based on plan</p>
                        <p>Overage: {billingData?.rates ? formatCurrency(billingData.rates.apiCallOveragePerUnit) : formatCurrency(0.001)} per call</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="h-4 w-4 text-cyan-500" />
                        <span className="font-medium">Storage</span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Included: Based on plan</p>
                        <p>Overage: {billingData?.rates ? formatCurrency(billingData.rates.storageOveragePerMb) : formatCurrency(0.10)} per MB</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="h-4 w-4 text-emerald-500" />
                        <span className="font-medium">Messages</span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Included: Based on plan</p>
                        <p>Overage: {billingData?.rates ? formatCurrency(billingData.rates.messageOveragePerUnit) : formatCurrency(0.01)} per message</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium text-amber-700">Upgrade to save on overage charges</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Metric Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {selectedMetric?.charAt(0).toUpperCase()}{selectedMetric?.slice(1)} Details
            </DialogTitle>
          </DialogHeader>
          {selectedMetric && overview[selectedMetric as keyof UsageOverview] && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {overview[selectedMetric as keyof UsageOverview].used.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    of {overview[selectedMetric as keyof UsageOverview].limit.toLocaleString()} {overview[selectedMetric as keyof UsageOverview].unit}
                  </p>
                </div>
                <Progress 
                  value={getUsagePercent(
                    overview[selectedMetric as keyof UsageOverview].used, 
                    overview[selectedMetric as keyof UsageOverview].limit
                  )} 
                  className="h-3 mt-4"
                />
              </Card>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-medium">
                    {overview[selectedMetric as keyof UsageOverview].used.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-medium">
                    {Math.max(0, overview[selectedMetric as keyof UsageOverview].limit - overview[selectedMetric as keyof UsageOverview].used).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usage %</span>
                  <span className={cn(
                    'font-medium',
                    getUsageColor(getUsagePercent(overview[selectedMetric as keyof UsageOverview].used, overview[selectedMetric as keyof UsageOverview].limit))
                  )}>
                    {getUsagePercent(overview[selectedMetric as keyof UsageOverview].used, overview[selectedMetric as keyof UsageOverview].limit).toFixed(1)}%
                  </span>
                </div>
              </div>

              {getUsagePercent(overview[selectedMetric as keyof UsageOverview].used, overview[selectedMetric as keyof UsageOverview].limit) >= 75 && (
                <Card className="p-4 bg-amber-500/10 border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="font-medium text-amber-700">Warning</p>
                      <p className="text-sm text-amber-600">
                        You&apos;re approaching your {selectedMetric} limit. Consider upgrading your plan.
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
