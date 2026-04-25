'use client';

import React from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import { 
  ArrowRight, 
  Clock, 
  LogIn, 
  LogOut,
  AlertCircle,
  CheckCircle2,
  Star,
  Loader2
} from 'lucide-react';

interface Arrival {
  id: string;
  confirmationCode: string;
  guestName: string;
  roomType: string;
  roomNumber: string | null;
  nights: number;
  status: string;
  time: string;
}

interface Departure {
  id: string;
  confirmationCode: string;
  guestName: string;
  roomType: string;
  roomNumber: string | null;
  balance: number;
  status: string;
  time: string;
}

const arrivalStatusConfig: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: CheckCircle2 },
  vip: { label: 'VIP', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', icon: Star },
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: Clock },
  early: { label: 'Early', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400', icon: Clock },
  late: { label: 'Late', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400', icon: AlertCircle },
  checked_in: { label: 'Checked In', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400', icon: CheckCircle2 },
};

const departureStatusConfig: Record<string, { label: string; className: string }> = {
  on_time: { label: 'On Time', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  extended: { label: 'Extended', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
};

export function UpcomingArrivals() {
  const { formatCurrency } = useCurrency();
  const { formatTime } = useTimezone();
  const [arrivals, setArrivals] = React.useState<Arrival[]>([]);
  const [departures, setDepartures] = React.useState<Departure[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        const result = await response.json();
        if (result.success) {
          setArrivals(result.data.arrivalsToday || []);
          setDepartures(result.data.departuresToday || []);
        }
      } catch (err) {
        console.error('Failed to fetch arrivals/departures:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Arrivals */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/40">
                <LogIn className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Arrivals Today</CardTitle>
                <CardDescription className="text-xs">{arrivals.length} expected</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => useUIStore.getState().setActiveSection('bookings-calendar')}>
              View All
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-[200px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : arrivals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-center">
              <div className="rounded-full bg-muted p-3 mb-2">
                <LogIn className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No arrivals today</p>
              <p className="text-xs text-muted-foreground">All guests have checked in</p>
            </div>
          ) : (
            <ScrollArea className="h-[280px]">
              <div className="space-y-2">
                {arrivals.map((arrival) => {
                  const statusConfig = arrivalStatusConfig[arrival.status] || arrivalStatusConfig.confirmed;
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <div
                      key={arrival.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                    >
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                          {getInitials(arrival.guestName)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{arrival.guestName}</p>
                          <Badge variant="secondary" className={cn("text-[10px] h-4 px-1.5 gap-0.5", statusConfig.className)}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{arrival.roomType}</span>
                          {arrival.roomNumber && (
                            <>
                              <span className="text-[10px] text-muted-foreground">•</span>
                              <Badge variant="outline" className="text-[10px] h-4 px-1">#{arrival.roomNumber}</Badge>
                            </>
                          )}
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{arrival.nights} night{arrival.nights > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium">{formatTime(arrival.time)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Departures */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <LogOut className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Departures Today</CardTitle>
                <CardDescription className="text-xs">{departures.length} scheduled</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => useUIStore.getState().setActiveSection('bookings-calendar')}>
              View All
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-[200px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : departures.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-center">
              <div className="rounded-full bg-muted p-3 mb-2">
                <LogOut className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No departures today</p>
              <p className="text-xs text-muted-foreground">All guests are staying over</p>
            </div>
          ) : (
            <ScrollArea className="h-[280px]">
              <div className="space-y-2">
                {departures.map((departure) => {
                  const statusConfig = departureStatusConfig[departure.status] || departureStatusConfig.on_time;
                  
                  return (
                    <div
                      key={departure.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                    >
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                          {getInitials(departure.guestName)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{departure.guestName}</p>
                          {departure.roomNumber && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                              #{departure.roomNumber}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{departure.roomType}</span>
                        </div>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium">{formatTime(departure.time)}</p>
                        <p className={cn(
                          "text-xs font-medium",
                          departure.balance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                        )}>
                          {departure.balance > 0 ? `${formatCurrency(departure.balance)} due` : 'Settled'}
                        </p>
                      </div>
                      
                      <Badge variant="secondary" className={cn("text-[10px] h-4 px-1.5", statusConfig.className)}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
