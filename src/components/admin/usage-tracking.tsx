'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SectionGuard } from '@/components/common/section-guard';
import { Loader2, Cpu, Database, HardDrive, Activity, BarChart3, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface UsageData {
  overview: {
    apiCalls: { used: number; limit: number; unit: string };
    storage: { used: number; limit: number; unit: string };
    messages: { used: number; limit: number; unit: string };
    users: { used: number; limit: number; unit: string };
    properties: { used: number; limit: number; unit: string };
    rooms: { used: number; limit: number; unit: string };
  };
  daily: Array<{ date: string; apiCalls: number; messages: number; storage: number }>;
  breakdown: Record<string, { apiCalls: number; percentage: number }>;
  alerts: Array<{ type: string; message: string; createdAt: string }>;
}

export function UsageTracking() {
  const { user } = useAuth();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (user?.tenantId) {
        params.set('tenantId', user.tenantId);
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`/api/admin/usage${query}`);
      const data = await response.json();
      if (data.success && data.data) {
        setUsageData(data.data);
      } else {
        setError(data.error || 'Failed to load usage data');
      }
    } catch (err) {
      console.error('Failed to fetch usage data:', err);
      setError('Network error while fetching usage data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !usageData) {
    return (
      <SectionGuard permission="admin.usage">
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/20">
            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold">Unable to Load Usage Data</h2>
            <p className="text-sm text-muted-foreground">{error || 'No usage data available'}</p>
          </div>
          <button
            onClick={fetchUsage}
            className="px-4 py-2 border rounded-md text-sm hover:bg-accent"
          >
            Retry
          </button>
        </div>
      </SectionGuard>
    );
  }

  return (
    <SectionGuard permission="admin.usage">
      <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Usage Tracking</h2>
        <p className="text-muted-foreground">Monitor resource usage and limits</p>
      </div>

      {/* Usage Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>API Calls</CardDescription>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {usageData.overview.apiCalls.used.toLocaleString()} / {usageData.overview.apiCalls.limit.toLocaleString()}
            </div>
            <Progress 
              value={(usageData.overview.apiCalls.used / usageData.overview.apiCalls.limit) * 100} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {((usageData.overview.apiCalls.used / usageData.overview.apiCalls.limit) * 100).toFixed(1)}% used this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Storage</CardDescription>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {usageData.overview.storage.used} MB / {usageData.overview.storage.limit} MB
            </div>
            <Progress 
              value={(usageData.overview.storage.used / usageData.overview.storage.limit) * 100} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {((usageData.overview.storage.used / usageData.overview.storage.limit) * 100).toFixed(1)}% used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Messages</CardDescription>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {usageData.overview.messages.used.toLocaleString()} / {usageData.overview.messages.limit.toLocaleString()}
            </div>
            <Progress 
              value={(usageData.overview.messages.used / usageData.overview.messages.limit) * 100} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {((usageData.overview.messages.used / usageData.overview.messages.limit) * 100).toFixed(1)}% used this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Limits Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Account Limits</CardTitle>
          <CardDescription>Current plan limits and usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Properties</p>
                <p className="text-xl font-bold">{usageData.overview.properties.used} / {usageData.overview.properties.limit}</p>
              </div>
              <Progress 
                value={(usageData.overview.properties.used / usageData.overview.properties.limit) * 100} 
                className="w-20 h-2"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Users</p>
                <p className="text-xl font-bold">{usageData.overview.users.used} / {usageData.overview.users.limit}</p>
              </div>
              <Progress 
                value={(usageData.overview.users.used / usageData.overview.users.limit) * 100} 
                className="w-20 h-2"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Rooms</p>
                <p className="text-xl font-bold">{usageData.overview.rooms.used} / {usageData.overview.rooms.limit}</p>
              </div>
              <Progress 
                value={(usageData.overview.rooms.used / usageData.overview.rooms.limit) * 100} 
                className="w-20 h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            API Usage Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(usageData.breakdown).map(([category, data]) => (
              <div key={category} className="flex items-center gap-4">
                <div className="w-32 text-sm capitalize">{category}</div>
                <div className="flex-1">
                  <Progress value={data.percentage} className="h-2" />
                </div>
                <div className="w-24 text-sm text-right">
                  {data.apiCalls.toLocaleString()} ({data.percentage}%)
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {usageData.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {usageData.alerts.map((alert, index) => (
                <div key={index} className={`flex items-center gap-2 p-3 rounded-lg ${alert.type === 'warning' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-muted'}`}>
                  <Activity className="h-4 w-4" />
                  <span className="text-sm">{alert.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </SectionGuard>
  );
}

export default UsageTracking;
