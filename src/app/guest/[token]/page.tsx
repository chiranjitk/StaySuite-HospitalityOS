'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGuestApp } from './layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  Calendar,
  Users,
  ConciergeBell,
  MessageCircle,
  Key,
  Star,
  ChevronRight,
  Bell,
  UtensilsCrossed,
  Sparkles,
  Car,
  Dumbbell,
  Waves,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Copy,
  MapPin,
  CircleDot,
  LogOut,
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Quick action items
const quickActions = [
  { id: 'room-service', label: 'Room Service', icon: UtensilsCrossed, color: 'bg-amber-500' },
  { id: 'housekeeping', label: 'Housekeeping', icon: Sparkles, color: 'bg-cyan-500' },
  { id: 'valet', label: 'Valet', icon: Car, color: 'bg-violet-500' },
  { id: 'spa', label: 'Spa & Wellness', icon: Dumbbell, color: 'bg-pink-500' },
  { id: 'pool', label: 'Pool', icon: Waves, color: 'bg-sky-500' },
  { id: 'concierge', label: 'Concierge', icon: Coffee, color: 'bg-emerald-500' },
];

interface WifiCredential {
  id: string;
  username: string;
  password: string;
  validFrom: string;
  validUntil: string;
  status: string;
  plan?: {
    id: string;
    name: string;
    downloadSpeed?: number;
    uploadSpeed?: number;
    dataLimit?: number;
  };
}

interface VehicleInfo {
  id: string;
  licensePlate: string;
  make?: string;
  model?: string;
  color?: string;
  status: string;
  entryTime: string;
  parkingFee: number;
  isPaid: boolean;
  slot?: {
    id: string;
    number: string;
    floor: number;
  };
}

export default function GuestHomePage() {
  const router = useRouter();
  const { data, isLoading } = useGuestApp();
  const { toast } = useToast();

  // WiFi credentials state
  const [wifiCred, setWifiCred] = useState<WifiCredential | null>(null);
  const [wifiLoading, setWifiLoading] = useState(true);

  // Parking info state
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [parkingLoading, setParkingLoading] = useState(true);

  // Fetch WiFi credentials
  useEffect(() => {
    if (!data?.booking) return;
    const fetchWifi = async () => {
      setWifiLoading(true);
      try {
        const res = await fetch(`/api/wifi/users?bookingId=${data.booking.id}`);
        const result = await res.json();
        if (result.success && result.data && result.data.length > 0) {
          setWifiCred(result.data[0]);
        }
      } catch (e) {
        console.error('Error fetching WiFi:', e);
      } finally {
        setWifiLoading(false);
      }
    };
    fetchWifi();
  }, [data?.booking]);

  // Fetch parking info
  useEffect(() => {
    if (!data?.guest) return;
    const fetchParking = async () => {
      setParkingLoading(true);
      try {
        const res = await fetch(`/api/vehicles?guestId=${data.guest.id}&status=parked`);
        const result = await res.json();
        if (result.success && result.data && result.data.length > 0) {
          setVehicle(result.data[0]);
        }
      } catch (e) {
        console.error('Error fetching parking:', e);
      } finally {
        setParkingLoading(false);
      }
    };
    fetchParking();
  }, [data?.guest]);

  const handleCopyWifiPassword = () => {
    if (wifiCred?.password) {
      navigator.clipboard.writeText(wifiCred.password);
      toast({ title: 'Copied', description: 'WiFi password copied to clipboard' });
    }
  };

  const handleRequestExit = async () => {
    if (!vehicle) return;
    try {
      toast({ title: 'Request Sent', description: 'Your exit request has been submitted to the front desk' });
    } catch {
      toast({ title: 'Error', description: 'Failed to submit request', variant: 'destructive' });
    }
  };

  if (isLoading || !data) {
    return <HomeSkeleton />;
  }

  const { booking, guest, room, roomType, property, bill, recentRequests } = data;

  // Calculate stay progress
  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);
  const now = new Date();
  const totalDays = differenceInDays(checkOut, checkIn);
  const daysPassed = Math.max(0, differenceInDays(now, checkIn));
  const progressPercent = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));

  // Get greeting based on time
  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleQuickAction = (actionId: string) => {
    router.push(`/guest/${data ? (window.location.pathname.split('/')[2]) : ''}/services?action=${actionId}`);
  };

  const token = typeof window !== 'undefined' ? window.location.pathname.split('/')[2] : '';

  return (
    <div className="p-4 space-y-6">
      {/* Welcome Card */}
      <div className="bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sky-100 text-sm">{getGreeting()},</p>
            <h2 className="text-2xl font-bold">{guest.firstName}!</h2>
          </div>
          {guest.isVip && (
            <Badge className="bg-amber-400 text-amber-900 border-0 dark:bg-amber-900/30 dark:text-amber-400">
              <Star className="h-3 w-3 mr-1 fill-current" />
              VIP
            </Badge>
          )}
        </div>

        {/* Room Info */}
        <div className="bg-white/20 backdrop-blur rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sky-100 text-xs">Your Room</p>
                <p className="text-lg font-bold">
                  {room ? `Room ${room.number}` : 'Not Assigned'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sky-100 text-xs">{roomType.name}</p>
              <p className="text-sm">Floor {room?.floor || '-'}</p>
            </div>
          </div>

          {/* Stay Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-sky-100">
              <span>Day {Math.min(daysPassed + 1, totalDays)} of {totalDays}</span>
              <span>{booking.nightsRemaining} nights remaining</span>
            </div>
            <Progress value={progressPercent} className="h-2 bg-white/20 [&>div]:bg-white" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.id)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', action.color)}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-xs text-muted-foreground">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stay Timeline */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Your Stay
          </h3>
          <div className="flex items-stretch gap-4">
            {/* Check-in */}
            <div className="flex-1 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Check-in</span>
              </div>
              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                {format(checkIn, 'MMM d')}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {booking.checkInTime}
              </p>
            </div>

            {/* Duration */}
            <div className="flex flex-col items-center justify-center px-2">
              <div className="flex-1 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-1 py-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{totalDays} nights</span>
              </div>
              <div className="flex-1 w-px bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Check-out */}
            <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-slate-400 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Check-out</span>
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {format(checkOut, 'MMM d')}
              </p>
              <p className="text-xs text-muted-foreground">
                {booking.checkOutTime}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WiFi Credentials */}
      {!wifiLoading && wifiCred && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              WiFi Access
            </h3>
            <div className="bg-sky-50 dark:bg-sky-950/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center">
                  <Wifi className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sky-900 dark:text-sky-100">Connected</p>
                  <p className="text-xs text-sky-600 dark:text-sky-400">StaySuite Guest WiFi</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-mono text-xs bg-white dark:bg-slate-800 px-2 py-1 rounded">{wifiCred.username}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Password</span>
                  <div className="flex items-center gap-2">
                    <code className="font-mono">•••••••••</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={handleCopyWifiPassword}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {wifiCred.password}
                    </Button>
                  </div>
                </div>
                {wifiCred.plan && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium">{wifiCred.plan.name}</span>
                  </div>
                )}
                {wifiCred.plan?.dataLimit && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Data Limit</span>
                    <span className="font-medium">{(wifiCred.plan.dataLimit / 1000000).toFixed(1)} GB</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valid Until</span>
                  <span className="font-medium">{format(new Date(wifiCred.validUntil), 'MMM d, HH:mm')}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parking Info */}
      {!parkingLoading && vehicle && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Parking
            </h3>
            <div className="bg-violet-50 dark:bg-violet-950/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center">
                  <Car className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-violet-900 dark:text-violet-100">{vehicle.licensePlate}</p>
                  <p className="text-xs text-violet-600 dark:text-violet-400">
                    {vehicle.make} {vehicle.model}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <MapPin className="h-3 w-3" />
                    Slot
                  </div>
                  <p className="font-semibold text-sm">
                    {vehicle.slot ? `${vehicle.slot.number} (F${vehicle.slot.floor})` : 'Not assigned'}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <CircleDot className="h-3 w-3" />
                    Entry
                  </div>
                  <p className="font-semibold text-sm">
                    {format(new Date(vehicle.entryTime), 'HH:mm')}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Current Fee</p>
                  <p className="text-lg font-bold text-violet-900 dark:text-violet-100">
                    {property.currency} {vehicle.parkingFee.toFixed(2)}
                  </p>
                </div>
                <Badge variant={vehicle.isPaid ? 'outline' : 'default'} className={cn(!vehicle.isPaid && 'bg-amber-500')}>
                  {vehicle.isPaid ? 'Paid' : 'Unpaid'}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400"
                onClick={handleRequestExit}
              >
                <LogOut className="h-3 w-3 mr-1" />
                Request Exit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bill Summary */}
      {bill.balanceDue > 0 && (
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    Outstanding Balance
                  </p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                    {property.currency} {bill.balanceDue.toFixed(2)}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 dark:border-amber-700"
                onClick={() => router.push(`/guest/${token}/bill`)}
              >
                View Bill
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Requests */}
      {recentRequests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Recent Requests
          </h3>
          <div className="space-y-2">
            {recentRequests.slice(0, 3).map((request) => (
              <Card key={request.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                        <ConciergeBell className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{request.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        request.status === 'completed' && 'border-emerald-500 text-emerald-600 dark:text-emerald-400',
                        request.status === 'in_progress' && 'border-amber-500 text-amber-600 dark:text-amber-400',
                        request.status === 'pending' && 'border-slate-400 text-slate-600'
                      )}
                    >
                      {request.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Property Info */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Property Info
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Guests:</span>
              <span className="font-medium">
                {booking.adults} adult{booking.adults !== 1 ? 's' : ''}
                {booking.children > 0 && `, ${booking.children} child${booking.children !== 1 ? 'ren' : ''}`}
              </span>
            </div>
            {property.phone && (
              <a
                href={`tel:${property.phone}`}
                className="flex items-center gap-3 text-sm text-sky-600 dark:text-sky-400"
              >
                <Bell className="h-4 w-4" />
                <span>Front Desk: {property.phone}</span>
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
