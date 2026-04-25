'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2,
  Package,
  Wrench,
  Users,
  Bed,
  Bell,
  BellOff,
  Loader2,
  ArrowRight,
  X,
  Clock,
  Sparkles,
  Wifi
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Alert {
  id: string;
  type: 'inventory' | 'service' | 'room' | 'guest' | 'system';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  isRead?: boolean;
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    color: 'text-red-600 bg-red-100 dark:bg-red-900/40 dark:text-red-400',
    border: 'border-l-red-500',
    hoverBorder: 'hover:border-l-red-600',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    hoverBg: 'hover:bg-red-50 dark:hover:bg-red-950/50',
    glow: 'shadow-red-500/10',
  },
  warning: {
    icon: AlertCircle,
    color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400',
    border: 'border-l-amber-500',
    hoverBorder: 'hover:border-l-amber-600',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-950/50',
    glow: 'shadow-amber-500/10',
  },
  info: {
    icon: Info,
    color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/40 dark:text-cyan-400',
    border: 'border-l-cyan-500',
    hoverBorder: 'hover:border-l-cyan-600',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400',
    hoverBg: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/50',
    glow: 'shadow-cyan-500/10',
  },
};

const typeConfig = {
  inventory: { icon: Package, label: 'Inventory' },
  service: { icon: Sparkles, label: 'Service' },
  room: { icon: Bed, label: 'Room' },
  guest: { icon: Users, label: 'Guest' },
  system: { icon: Wifi, label: 'System' },
};

function EmptyAlertState({ message = 'All caught up!', subMessage = 'No active alerts at the moment' }: { message?: string; subMessage?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-center">
      <div className="relative mb-4">
        <div className="rounded-full bg-emerald-50 dark:bg-emerald-900/40 p-4 ring-4 ring-emerald-100 dark:ring-emerald-400/50 shadow-sm">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 dark:text-emerald-400" />
        </div>
        {/* Animated ping ring */}
        <div className="absolute inset-[-4px] rounded-full border-2 border-emerald-300 dark:border-emerald-700 animate-ping opacity-20" />
      </div>
      <p className="text-sm font-semibold text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">{subMessage}</p>
    </div>
  );
}

function AlertItem({ alert, onDismiss }: { alert: Alert; onDismiss?: (id: string) => void }) {
  const severity = severityConfig[alert.severity];
  const type = typeConfig[alert.type];
  const Icon = severity.icon;

  return (
    <div 
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border-l-4 cursor-pointer group",
        "transition-all duration-200",
        severity.border,
        severity.hoverBorder,
        "hover:shadow-md hover:-translate-y-0.5 hover:border-l-[6px]",
        alert.isRead 
          ? "bg-muted/50" 
          : cn("bg-background", severity.hoverBg, severity.glow)
      )}
    >
      <div className={cn("rounded-lg p-2 flex-shrink-0 transition-transform duration-200 group-hover:scale-110", severity.color)}>
        <Icon className="h-4 w-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{alert.title}</p>
          <Badge variant="secondary" className={cn("text-[10px] h-4 px-1.5 flex-shrink-0", severity.badge)}>
            {alert.severity}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alert.message}</p>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <type.icon className="h-3 w-3" />
            <span>{type.label}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">•</span>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{(() => { try { const d = new Date(alert.timestamp); return isNaN(d.getTime()) ? 'just now' : formatDistanceToNow(d, { addSuffix: true }); } catch { return 'just now'; } })()}</span>
          </div>
        </div>
      </div>

      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(alert.id);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function AlertSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AlertsPanel() {
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        const result = await response.json();
        if (result.success) {
          setAlerts(result.data.alerts);
        } else {
          setError(result.error?.message || 'Failed to load alerts');
        }
      } catch (err) {
        setError('Failed to fetch alerts data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const dismissAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const infoAlerts = alerts.filter(a => a.severity === 'info');

  return (
    <>
      {/* Embedded keyframes for critical pulse animation */}
      <style>{`
        @keyframes criticalPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.15); }
          50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.05); }
        }
        .alert-critical-pulse {
          animation: criticalPulse 2s ease-in-out infinite;
        }
      `}</style>
      <div className="space-y-4">
        {/* Alert Summary Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="border border-border/50 shadow-sm border-l-4 border-l-red-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{criticalAlerts.length}</p>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm border-l-4 border-l-amber-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{warningAlerts.length}</p>
                  <p className="text-xs text-muted-foreground">Warnings</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm border-l-4 border-l-cyan-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/40">
                  <Info className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">{infoAlerts.length}</p>
                  <p className="text-xs text-muted-foreground">Info</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts List */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 shadow-sm">
                  <Bell className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Active Alerts</CardTitle>
                  <CardDescription className="text-xs">{alerts.length} notifications</CardDescription>
                </div>
              </div>
              {alerts.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs gap-1 hover:bg-destructive/10 hover:text-destructive transition-colors"
                  onClick={() => setAlerts([])}
                >
                  <BellOff className="h-3 w-3" />
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <AlertSkeleton />
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-center">
                <div className="rounded-full bg-destructive/10 p-3 mb-3 ring-4 ring-destructive/5">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            ) : alerts.length === 0 ? (
              <EmptyAlertState />
            ) : (
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-9">
                  <TabsTrigger value="all" className="text-xs">
                    All ({alerts.length})
                  </TabsTrigger>
                  <TabsTrigger value="critical" className="text-xs">
                    Critical ({criticalAlerts.length})
                  </TabsTrigger>
                  <TabsTrigger value="warning" className="text-xs">
                    Warning ({warningAlerts.length})
                  </TabsTrigger>
                  <TabsTrigger value="info" className="text-xs">
                    Info ({infoAlerts.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-4">
                  <ScrollArea className="h-[400px] pr-3 -mr-3">
                    <div className="space-y-3">
                      {alerts.map((alert) => (
                        <AlertItem key={alert.id} alert={alert} onDismiss={dismissAlert} />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="critical" className="mt-4">
                  <ScrollArea className="h-[400px] pr-3 -mr-3">
                    {criticalAlerts.length === 0 ? (
                      <EmptyAlertState message="No critical alerts" subMessage="Everything looks stable right now" />
                    ) : (
                      <div className="space-y-3">
                        {criticalAlerts.map((alert) => (
                          <AlertItem key={alert.id} alert={alert} onDismiss={dismissAlert} />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="warning" className="mt-4">
                  <ScrollArea className="h-[400px] pr-3 -mr-3">
                    {warningAlerts.length === 0 ? (
                      <EmptyAlertState message="No warning alerts" subMessage="No warnings to review" />
                    ) : (
                      <div className="space-y-3">
                        {warningAlerts.map((alert) => (
                          <AlertItem key={alert.id} alert={alert} onDismiss={dismissAlert} />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="info" className="mt-4">
                  <ScrollArea className="h-[400px] pr-3 -mr-3">
                    {infoAlerts.length === 0 ? (
                      <EmptyAlertState message="No info alerts" subMessage="No informational notices" />
                    ) : (
                      <div className="space-y-3">
                        {infoAlerts.map((alert) => (
                          <AlertItem key={alert.id} alert={alert} onDismiss={dismissAlert} />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
