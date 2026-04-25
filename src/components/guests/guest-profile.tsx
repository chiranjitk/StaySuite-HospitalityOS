'use client';

import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Star,
  Crown,
  Shield,
  Heart,
  Clock,
  Gift,
  Loader2,
  Building,
  CreditCard,
  Edit,
  Route,
  Wifi,
} from 'lucide-react';
import { KYCDocuments } from './kyc-documents';
import { GuestPreferences } from './guest-preferences';
import { StayHistory } from './stay-history';
import { LoyaltyPoints } from './loyalty-points';
import { GuestJourney } from './guest-journey';

// Lazy load WiFi session history (heavy — fetches from RADIUS service)
const WifiSessionHistory = lazy(() => import('./wifi-session-history'));
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { cn } from '@/lib/utils';

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  nationality?: string;
  dateOfBirth?: Date | null;
  gender?: string;
  country?: string;
  city?: string;
  state?: string;
  address?: string;
  postalCode?: string;
  loyaltyTier: string;
  loyaltyPoints: number;
  totalStays: number;
  totalSpent: number;
  isVip: boolean;
  vipLevel?: string;
  source: string;
  kycStatus: string;
  kycVerifiedAt?: Date | null;
  createdAt: string;
  notes?: string;
  preferences?: Record<string, unknown>;
  tags?: string[];
  bookings?: Array<{
    id: string;
    confirmationCode: string;
    checkIn: string;
    checkOut: string;
    status: string;
    room?: { number: string };
    roomType?: { name: string };
    property?: { name: string };
  }>;
  documents?: Array<{
    id: string;
    type: string;
    name: string;
    status: string;
  }>;
}

interface GuestProfileProps {
  guestId: string | null;
  onBack: () => void;
}

const loyaltyTiers = [
  { value: 'bronze', label: 'Bronze', color: 'bg-amber-700' },
  { value: 'silver', label: 'Silver', color: 'bg-gray-400' },
  { value: 'gold', label: 'Gold', color: 'bg-yellow-500' },
  { value: 'platinum', label: 'Platinum', color: 'bg-slate-600' },
];

const kycStatusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:text-amber-200',
  verified: 'bg-emerald-100 text-emerald-800 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-800 dark:text-red-200',
};

export function GuestProfile({ guestId, onBack }: GuestProfileProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate } = useTimezone();
  const [guest, setGuest] = useState<Guest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (guestId) {
      fetchGuest();
    }
  }, [guestId]);

  const fetchGuest = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/guests/${guestId}`);
      const result = await response.json();
      
      if (result.success) {
        setGuest(result.data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch guest details',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching guest:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch guest details',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const getLoyaltyBadge = (tier: string) => {
    const option = loyaltyTiers.find(o => o.value === tier);
    return (
      <Badge variant="secondary" className={cn('text-white', option?.color)}>
        {option?.label || tier}
      </Badge>
    );
  };

  if (!guestId) {
    return (
      <Card className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-center text-muted-foreground">
          <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a guest to view their profile</p>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!guest) {
    return (
      <Card className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-center text-muted-foreground">
          <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Guest not found</p>
          <Button variant="outline" className="mt-4" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl">
                  {getInitials(guest.firstName, guest.lastName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">
                    {guest.firstName} {guest.lastName}
                  </h1>
                  {guest.isVip && (
                    <Crown className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {getLoyaltyBadge(guest.loyaltyTier)}
                  <Badge className={kycStatusColors[guest.kycStatus]}>
                    <Shield className="h-3 w-3 mr-1" />
                    KYC: {guest.kycStatus}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Stays</span>
          </div>
          <div className="text-2xl font-bold mt-1">{guest.totalStays}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Spent</span>
          </div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(guest.totalSpent)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loyalty Points</span>
          </div>
          <div className="text-2xl font-bold mt-1">{guest.loyaltyPoints.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Points Value</span>
          </div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(guest.loyaltyPoints * 0.01)}</div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="journey">Journey</TabsTrigger>
          <TabsTrigger value="documents">KYC</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
          <TabsTrigger value="wifi" className="gap-1.5">
            <Wifi className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">WiFi</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {guest.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{guest.email}</p>
                    </div>
                  </div>
                )}
                {guest.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{guest.phone}</p>
                    </div>
                  </div>
                )}
                {guest.alternatePhone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Alternate Phone</p>
                      <p className="font-medium">{guest.alternatePhone}</p>
                    </div>
                  </div>
                )}
                {(guest.address || guest.city) && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">
                        {[guest.address, guest.city, guest.state, guest.country, guest.postalCode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Personal Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {guest.nationality && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Nationality</span>
                    <span className="font-medium">{guest.nationality}</span>
                  </div>
                )}
                {guest.dateOfBirth && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Date of Birth</span>
                    <span className="font-medium">
                      {formatDate(guest.dateOfBirth)}
                    </span>
                  </div>
                )}
                {guest.gender && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Gender</span>
                    <span className="font-medium capitalize">{guest.gender}</span>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <Badge variant="outline">{guest.source}</Badge>
                </div>
                {guest.isVip && guest.vipLevel && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">VIP Level</span>
                    <Badge className="bg-amber-500">{guest.vipLevel}</Badge>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Guest Since</span>
                  <span className="font-medium">
                    {formatDate(guest.createdAt)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Recent Bookings */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Recent Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                {guest.bookings && guest.bookings.length > 0 ? (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      {guest.bookings.slice(0, 5).map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div>
                            <p className="font-medium">{booking.confirmationCode}</p>
                            <p className="text-sm text-muted-foreground">
                              {booking.property?.name} - {booking.roomType?.name}
                              {booking.room && ` (Room ${booking.room.number})`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">
                              {new Date(booking.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                              {new Date(booking.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <Badge
                              variant={
                                booking.status === 'checked_in'
                                  ? 'default'
                                  : booking.status === 'checked_out'
                                  ? 'secondary'
                                  : 'outline'
                              }
                            >
                              {booking.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No bookings found</p>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {guest.notes && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{guest.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="journey" className="mt-4">
          <GuestJourney guestId={guestId} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <KYCDocuments guestId={guestId} />
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <GuestPreferences guestId={guestId} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <StayHistory guestId={guestId} />
        </TabsContent>

        <TabsContent value="loyalty" className="mt-4">
          <LoyaltyPoints guestId={guestId} />
        </TabsContent>

        <TabsContent value="wifi" className="mt-4">
          <Suspense fallback={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }>
            <WifiSessionHistory guestId={guestId} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
