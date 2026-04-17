'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Users, 
  LogIn, 
  LogOut, 
  CalendarDays, 
  Bed,
  Clock,
  ArrowRight,
  Phone,
  Mail,
  TrendingUp,
  Timer,
  CheckCircle2,
  AlertCircle,
  Activity,
  Sparkles,
  CreditCard,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';

interface FrontDeskStats {
  arrivalsToday: number;
  departuresToday: number;
  checkedIn: number;
  availableRooms: number;
  totalRooms: number;
  occupancyRate: number;
  avgCheckInTime: number;
  avgCheckOutTime: number;
  checkInsCompleted: number;
  checkOutsCompleted: number;
  arrivals: Array<{
    id: string;
    guestName: string;
    roomType: string;
    checkIn: string;
    status: string;
    phone?: string;
    email?: string;
    vip?: boolean;
    time?: string;
  }>;
  departures: Array<{
    id: string;
    guestName: string;
    roomNumber: string;
    checkOut: string;
    balance: number;
    status?: string;
    time?: string;
  }>;
  pendingActions: number;
}

function StatCard({ title, value, subtitle, icon: Icon, color, onClick, progress, target }: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
  progress?: number;
  target?: number;
}) {
  return (
    <Card 
      className={cn("border-0 shadow-sm", onClick && "cursor-pointer hover:shadow-md transition-shadow")}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl shadow-sm", color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {progress !== undefined && target !== undefined && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span>{progress}/{target}</span>
            </div>
            <Progress value={(progress / target) * 100} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ArrivalCard({ arrival, formatTime }: { arrival: FrontDeskStats['arrivals'][0]; formatTime: (time: string) => string }) {
  const statusColors: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    checked_in: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
    vip: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className={cn(
            "text-xs",
            arrival.vip 
              ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
              : "bg-gradient-to-br from-primary/80 to-primary text-primary-foreground"
          )}>
            {getInitials(arrival.guestName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{arrival.guestName}</p>
            {arrival.vip && (
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{arrival.roomType}</span>
            {arrival.phone && (
              <>
                <span>•</span>
                <Phone className="h-3 w-3" />
                <span>{arrival.phone}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className="text-sm font-medium">
            {arrival.time ? formatTime(arrival.time) : '--:--'}
          </p>
          <Badge className={statusColors[arrival.status] || statusColors.pending} variant="secondary">
            {arrival.status.replace('_', ' ')}
          </Badge>
        </div>
        <Button 
          size="sm" 
          variant="ghost" 
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => useUIStore.getState().setActiveSection('frontdesk-checkin')}
        >
          <LogIn className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function DepartureCard({ departure, formatCurrency, formatTime }: { 
  departure: FrontDeskStats['departures'][0]; 
  formatCurrency: (amount: number) => string;
  formatTime: (time: string) => string;
}) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const balanceColor = departure.balance > 0 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs bg-gradient-to-br from-amber-500 to-orange-600 text-white">
            {getInitials(departure.guestName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-sm">{departure.guestName}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Room {departure.roomNumber}</span>
            <span>•</span>
            <span className={balanceColor}>
              {departure.balance > 0 ? `${formatCurrency(departure.balance)} due` : 'Settled'}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className="text-sm font-medium">
            {departure.time ? formatTime(departure.time) : '--:--'}
          </p>
          <Badge variant="secondary" className={departure.balance > 0 
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
          }>
            {departure.balance > 0 ? 'Payment Due' : 'Ready'}
          </Badge>
        </div>
        <Button 
          size="sm" 
          variant="ghost" 
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => useUIStore.getState().setActiveSection('frontdesk-checkout')}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

const EMPTY_FRONTDESK_STATS: FrontDeskStats = {
  arrivalsToday: 0,
  departuresToday: 0,
  checkedIn: 0,
  availableRooms: 0,
  totalRooms: 0,
  occupancyRate: 0,
  avgCheckInTime: 0,
  avgCheckOutTime: 0,
  checkInsCompleted: 0,
  checkOutsCompleted: 0,
  arrivals: [],
  departures: [],
  pendingActions: 0,
};

export default function FrontDeskDashboard() {
  const [stats, setStats] = React.useState<FrontDeskStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();
  const { formatCurrency } = useCurrency();
  const { formatTime } = useTimezone();

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/frontdesk/dashboard');
        const result = await response.json();
        if (result.success) {
          setStats(result.data);
        } else {
          setError(result.error?.message || 'Failed to load dashboard');
          setStats(EMPTY_FRONTDESK_STATS);
        }
      } catch (err) {
        setError('Failed to fetch dashboard data');
        setStats(EMPTY_FRONTDESK_STATS);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const currentTime = new Date();
  const hour = currentTime.getHours();
  let shift = 'Morning Shift';
  if (hour >= 14 && hour < 22) shift = 'Evening Shift';
  else if (hour >= 22 || hour < 6) shift = 'Night Shift';

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Front Desk Dashboard</h1>
            <p className="text-muted-foreground">
              {shift} • Manage arrivals, departures, and guest services
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(currentTime.toISOString())}
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/?section=frontdesk-room-grid')}
            >
              <Bed className="mr-2 h-4 w-4" />
              Room Grid
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Arrivals Today"
          value={stats.arrivalsToday}
          icon={LogIn}
          color="bg-gradient-to-br from-green-500 to-emerald-600"
          onClick={() => router.push('/?section=frontdesk-checkin')}
          progress={stats.checkInsCompleted}
          target={stats.arrivalsToday}
        />
        <StatCard
          title="Departures Today"
          value={stats.departuresToday}
          icon={LogOut}
          color="bg-gradient-to-br from-orange-500 to-amber-600"
          onClick={() => router.push('/?section=frontdesk-checkout')}
          progress={stats.checkOutsCompleted}
          target={stats.departuresToday}
        />
        <StatCard
          title="In House"
          value={stats.checkedIn}
          subtitle={`of ${stats.totalRooms} rooms`}
          icon={Users}
          color="bg-gradient-to-br from-teal-500 to-cyan-600"
          onClick={() => router.push('/?section=guests-list')}
        />
        <StatCard
          title="Available"
          value={stats.availableRooms}
          subtitle={`${stats.occupancyRate}% occupied`}
          icon={Bed}
          color="bg-gradient-to-br from-violet-500 to-purple-600"
          onClick={() => router.push('/?section=frontdesk-room-grid')}
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                  <Timer className="h-4 w-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Avg Check-in Time</p>
                  <p className="text-xs text-muted-foreground">Today's average</p>
                </div>
              </div>
              <p className="text-xl font-bold">{stats.avgCheckInTime} min</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Timer className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Avg Check-out Time</p>
                  <p className="text-xs text-muted-foreground">Today's average</p>
                </div>
              </div>
              <p className="text-xl font-bold">{stats.avgCheckOutTime} min</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <Activity className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Pending Actions</p>
                  <p className="text-xs text-muted-foreground">Requires attention</p>
                </div>
              </div>
              <p className="text-xl font-bold">{stats.pendingActions}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Arrivals and Departures */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <LogIn className="h-4 w-4 text-green-600" />
                Today's Arrivals
                <Badge variant="secondary" className="ml-1">{stats.arrivals.length}</Badge>
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/?section=frontdesk-checkin')}
              >
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-2">
                {stats.arrivals.slice(0, 5).map((arrival) => (
                  <ArrivalCard key={arrival.id} arrival={arrival} formatTime={formatTime} />
                ))}
                {stats.arrivals.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
                    <p className="text-sm font-medium">All arrivals processed</p>
                    <p className="text-xs text-muted-foreground">No pending check-ins</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <LogOut className="h-4 w-4 text-orange-600" />
                Today's Departures
                <Badge variant="secondary" className="ml-1">{stats.departures.length}</Badge>
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/?section=frontdesk-checkout')}
              >
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-2">
                {stats.departures.slice(0, 5).map((departure) => (
                  <DepartureCard 
                    key={departure.id} 
                    departure={departure} 
                    formatCurrency={formatCurrency}
                    formatTime={formatTime}
                  />
                ))}
                {stats.departures.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
                    <p className="text-sm font-medium">All departures processed</p>
                    <p className="text-xs text-muted-foreground">No pending check-outs</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/?section=frontdesk-checkin')}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Check In
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/?section=frontdesk-checkout')}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Check Out
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/?section=frontdesk-walkin')}
            >
              <Users className="mr-2 h-4 w-4" />
              Walk-in
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/?section=frontdesk-room-grid')}
            >
              <Bed className="mr-2 h-4 w-4" />
              Room Grid
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/?section=bookings-calendar')}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Bookings
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/?section=billing-payments')}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Payments
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
