'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useGuestApp } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Star,
  Award,
  ChevronRight,
  Settings,
  Bell,
  Shield,
  LogOut,
  Globe,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const router = useRouter();
  const { data: guestData, isLoading } = useGuestApp();

  if (isLoading || !guestData) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const { guest, booking, property } = guestData;

  // Loyalty tier colors
  const tierColors: Record<string, string> = {
    bronze: 'from-amber-600 to-amber-800',
    silver: 'from-slate-400 to-slate-600',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-violet-400 to-violet-600',
  };

  return (
    <div className="p-4 space-y-6">
      {/* Profile Header */}
      <Card className="overflow-hidden">
        <div className={cn(
          'h-24 bg-gradient-to-r',
          tierColors[guest.loyaltyTier] || 'from-sky-500 to-indigo-600'
        )} />
        <CardContent className="pt-0">
          <div className="flex items-end gap-4 -mt-10">
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-2xl font-bold border-4 border-white dark:border-slate-900">
              {guest.firstName.charAt(0)}{guest.lastName.charAt(0)}
            </div>
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {guest.firstName} {guest.lastName}
                </h2>
                {guest.isVip && (
                  <Badge className="bg-amber-500 text-[10px]">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    VIP
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {guest.email || guest.phone || 'No contact info'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loyalty Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white',
                tierColors[guest.loyaltyTier] || 'from-slate-400 to-slate-600'
              )}>
                <Award className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold capitalize">{guest.loyaltyTier} Member</p>
                <p className="text-sm text-muted-foreground">
                  {guest.loyaltyPoints.toLocaleString()} points
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              View Rewards
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="font-medium">{guest.firstName} {guest.lastName}</p>
              </div>
            </div>

            {guest.email && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{guest.email}</p>
                </div>
              </div>
            )}

            {guest.phone && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-slate-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium">{guest.phone}</p>
                </div>
              </div>
            )}

            {guest.nationality && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-slate-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Nationality</p>
                  <p className="font-medium">{guest.nationality}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stay Details */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Current Stay</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-sky-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Stay Dates</p>
                <p className="font-medium">
                  {format(new Date(booking.checkIn), 'MMM d')} - {format(new Date(booking.checkOut), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Property</p>
                <p className="font-medium">{property.name}</p>
                <p className="text-xs text-muted-foreground">{property.city}, {property.country}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardContent className="p-0">
          <button
            onClick={() => router.push(`/guest/${window.location.pathname.split('/')[2]}/bill`)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
              <span className="font-medium">View Bill</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          <Separator />

          <button
            onClick={() => router.push(`/guest/${window.location.pathname.split('/')[2]}/feedback`)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Award className="h-5 w-5 text-violet-600" />
              </div>
              <span className="font-medium">Leave Feedback</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardContent className="p-0">
          <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Bell className="h-5 w-5 text-slate-500" />
              </div>
              <span className="font-medium">Notifications</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          <Separator />

          <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Shield className="h-5 w-5 text-slate-500" />
              </div>
              <span className="font-medium">Privacy & Security</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          <Separator />

          <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Settings className="h-5 w-5 text-slate-500" />
              </div>
              <span className="font-medium">Settings</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground py-4">
        <p>Powered by StaySuite HospitalityOS</p>
        <p className="mt-1">Version 1.0.0</p>
      </div>
    </div>
  );
}
