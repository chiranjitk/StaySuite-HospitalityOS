'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SectionGuard } from '@/components/common/section-guard';
import { Loader2, Zap, Database, Cpu, HardDrive, Activity, RefreshCw, AlertTriangle, Check } from 'lucide-react';

interface SystemHealthData {
  status: string;
  lastUpdated: string;
  server: {
    cpu: { value: number; unit: string; status: string };
    memory: { value: number; unit: string; total: number; status: string };
    uptime: { value: number; unit: string; status: string };
  };
  database: {
    connections: { active: number; limit: number; status: string };
    queries: { perSecond: number; avgLatency: number; status: string };
    size: { used: number; unit: string; limit: number; status: string };
  };
  services: Array<{ name: string; status: string; latency: string; uptime: string }>;
  alerts: Array<{ id: number; severity: string; message: string; time: string }>;
}

export function SystemHealth() {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    
    try {
      const response = await fetch('/api/admin/system-health');
      const data = await response.json();
      if (data.success) {
        setHealthData(data.data);
      }
    } catch {
      console.error('Failed to fetch system health');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-emerald-500';
      case 'warning': return 'text-amber-500';
      case 'critical': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-emerald-500';
      case 'warning': return 'bg-amber-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  if (loading || !healthData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SectionGuard permission="admin.health">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Health</h2>
          <p className="text-muted-foreground">Monitor platform performance and service status</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Last updated: {new Date(healthData.lastUpdated).toLocaleTimeString()}
          </span>
          <Button variant="outline" onClick={() => fetchHealth(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>CPU Usage</CardDescription>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">{healthData.server.cpu.value}{healthData.server.cpu.unit}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Progress value={healthData.server.cpu.value} className="h-2" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Memory Usage</CardDescription>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">{healthData.server.memory.value} {healthData.server.memory.unit}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Progress value={(healthData.server.memory.value / healthData.server.memory.total) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">of {healthData.server.memory.total} GB total</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>System Uptime</CardDescription>
              <Database className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">{healthData.server.uptime.value}{healthData.server.uptime.unit}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-emerald-500">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Service Status
          </CardTitle>
          <CardDescription>Real-time status of all platform services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {healthData.services.map((service) => (
              <div key={service.name} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className={`h-3 w-3 rounded-full ${getStatusBg(service.status)} animate-pulse`} />
                <div className="flex-1">
                  <p className="font-medium text-sm">{service.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{service.latency}</span>
                    <span>•</span>
                    <span>{service.uptime}</span>
                  </div>
                </div>
                {service.status === 'healthy' ? (
                  <Check className={`h-4 w-4 ${getStatusColor(service.status)}`} />
                ) : (
                  <AlertTriangle className={`h-4 w-4 ${getStatusColor(service.status)}`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Database & Storage */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active Connections</span>
              <span className="font-bold">{healthData.database.connections.active}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Queries/sec</span>
              <span className="font-bold">{healthData.database.queries.perSecond.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg Latency</span>
              <span className="font-bold">{healthData.database.queries.avgLatency} ms</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Connection Pool</span>
                <span className="text-sm">{healthData.database.connections.active} / {healthData.database.connections.limit}</span>
              </div>
              <Progress value={(healthData.database.connections.active / healthData.database.connections.limit) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Storage Used</span>
              <span className="font-bold">{healthData.database.size.used} {healthData.database.size.unit}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Disk Usage</span>
                <span className="text-sm">{healthData.database.size.used} GB / {healthData.database.size.limit} GB</span>
              </div>
              <Progress value={(healthData.database.size.used / healthData.database.size.limit) * 100} className="h-2" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Available</span>
              <span className="font-bold text-emerald-500">{healthData.database.size.limit - healthData.database.size.used} GB</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Recent Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthData.alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Check className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              <p>No active alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {healthData.alerts.map((alert) => (
                <div key={alert.id} className={`flex items-center gap-3 p-3 rounded-lg ${alert.severity === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-muted'}`}>
                  <AlertTriangle className={`h-4 w-4 ${alert.severity === 'warning' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  <div className="flex-1">
                    <p className="text-sm">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">{alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </SectionGuard>
  );
}

export default SystemHealth;
