'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  CheckCircle2,
  User,
  FileText,
  Settings2,
  FileSignature,
  CreditCard,
  Key,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { GuestDetails } from '@/components/portal/guest-details';
import { DocumentUpload } from '@/components/portal/document-upload';
import { PreferenceSelection } from '@/components/portal/preference-selection';
import { ESignature } from '@/components/portal/e-signature';
import { PaymentSummary } from '@/components/portal/payment-summary';

interface PortalData {
  booking: {
    id: string;
    confirmationCode: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    infants: number;
    roomRate: number;
    totalAmount: number;
    currency: string;
    status: string;
    specialRequests?: string;
    kycRequired: boolean;
    kycCompleted: boolean;
    kycStatus: string;
    eSignedAt?: string;
    preArrivalCompleted: boolean;
  };
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    nationality?: string;
    dateOfBirth?: string;
    gender?: string;
    idType?: string;
    idNumber?: string;
    address?: string;
    city?: string;
    country?: string;
    postalCode?: string;
  };
  documents: Array<{
    id: string;
    type: string;
    name: string;
    status: string;
    expiryDate?: string;
    createdAt: string;
  }>;
  roomType: {
    id: string;
    name: string;
    description?: string;
    property?: {
      id: string;
      name: string;
      address: string;
      city: string;
      checkInTime: string;
      checkOutTime: string;
    } | null;
  };
  room?: {
    id: string;
    number: string;
    floor: number;
    digitalKeyEnabled: boolean;
  };
  payment: {
    totalBilled: number;
    totalPaid: number;
    balanceDue: number;
    currency: string;
  };
  preferences: Record<string, unknown>;
  kycProgress: {
    total: number;
    verified: number;
    pending: number;
    isComplete: boolean;
  };
  steps: {
    guestDetails: boolean;
    kycDocuments: boolean;
    preferences: boolean;
    eSignature: boolean;
    payment: boolean;
  };
}

export default function PortalPage() {
  const params = useParams();
  const token = params.token as string;
  const { toast } = useToast();
  
  const [data, setData] = useState<PortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortalData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/portal/token?token=${token}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || 'Failed to load portal data');
      }
    } catch (err) {
      console.error('Error fetching portal data:', err);
      setError('Failed to load portal data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPortalData();
    }
  }, [token]);

  const calculateProgress = () => {
    if (!data?.steps) return 0;
    const completedSteps = Object.values(data.steps).filter(Boolean).length;
    return Math.round((completedSteps / 5) * 100);
  };

  const steps = [
    {
      id: 'guestDetails',
      label: 'Guest Details',
      icon: User,
      isComplete: data?.steps.guestDetails,
      isRequired: true,
    },
    {
      id: 'kycDocuments',
      label: 'KYC Documents',
      icon: FileText,
      isComplete: data?.steps.kycDocuments,
      isRequired: data?.booking.kycRequired,
    },
    {
      id: 'preferences',
      label: 'Preferences',
      icon: Settings2,
      isComplete: data?.steps.preferences,
      isRequired: false,
    },
    {
      id: 'eSignature',
      label: 'Terms & Signature',
      icon: FileSignature,
      isComplete: data?.steps.eSignature,
      isRequired: true,
    },
    {
      id: 'payment',
      label: 'Payment',
      icon: CreditCard,
      isComplete: data?.steps.payment,
      isRequired: data?.payment?.balanceDue != null ? data.payment.balanceDue > 0 : false,
    },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="grid gap-6">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="rounded-full bg-red-100 w-12 h-12 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold mb-2">
              {error === 'Portal link has expired' ? 'Link Expired' : 'Unable to Access Portal'}
            </h2>
            <p className="text-muted-foreground text-sm mb-4">
              {error || 'The portal link is invalid or has expired. Please contact the property for a new link.'}
            </p>
            <Button variant="outline" onClick={fetchPortalData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">Secure Guest Portal</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">
            Welcome, {data.guest.firstName}!
          </h1>
          <p className="text-muted-foreground">
            Complete your pre-arrival details for your upcoming stay
          </p>
        </div>

        {/* Booking Summary Card */}
        <Card className="mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono">
                    {data.booking.confirmationCode}
                  </Badge>
                  <Badge className={cn(
                    "text-xs",
                    data.booking.status === 'confirmed' && "bg-emerald-100 text-emerald-700",
                    data.booking.status === 'checked_in' && "bg-cyan-100 text-cyan-700",
                    data.booking.status === 'checked_out' && "bg-gray-100 text-gray-700",
                  )}>
                    {data.booking.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <h2 className="text-xl font-semibold">{data.roomType.name}</h2>
                {data.roomType.property && (
                  <p className="text-muted-foreground text-sm">
                    {data.roomType.property.name} • {data.roomType.property.city}
                  </p>
                )}
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Check-in</p>
                  <p className="font-semibold">
                    {format(new Date(data.booking.checkIn), 'MMM dd')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.roomType.property?.checkInTime || '14:00'}
                  </p>
                </div>
                <div className="flex items-center">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Check-out</p>
                  <p className="font-semibold">
                    {format(new Date(data.booking.checkOut), 'MMM dd')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.roomType.property?.checkOutTime || '11:00'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Completion Progress</span>
            <span className="text-sm text-muted-foreground">{calculateProgress()}%</span>
          </div>
          <Progress value={calculateProgress()} className="h-2" />
          <div className="flex justify-between mt-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-1 text-[10px] uppercase tracking-wide",
                  step.isComplete ? "text-emerald-600" : "text-muted-foreground"
                )}
              >
                {step.isComplete ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <step.icon className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Digital Key Status */}
        {data.room?.digitalKeyEnabled && data.steps.eSignature && data.steps.payment && (
          <Card className="mb-6 bg-gradient-to-r from-cyan-50 to-teal-50 border-cyan-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-100">
                    <Key className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="font-medium">Digital Key Ready</p>
                    <p className="text-sm text-muted-foreground">
                      Room {data.room.number} • Floor {data.room.floor}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="border-cyan-300">
                  Access Room
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Portal Sections */}
        <div className="grid gap-6">
          {/* Guest Details */}
          <GuestDetails
            token={token}
            guest={data.guest}
            isComplete={data.steps.guestDetails}
            onUpdate={(guest) => {
              setData(prev => prev ? { ...prev, guest: { ...prev.guest, ...guest } } : null);
            }}
            onComplete={() => {
              setData(prev => prev ? {
                ...prev,
                steps: { ...prev.steps, guestDetails: true }
              } : null);
            }}
          />

          {/* KYC Documents */}
          {data.booking.kycRequired && (
            <DocumentUpload
              token={token}
              documents={data.documents}
              kycComplete={data.kycProgress.isComplete}
              onUpdate={fetchPortalData}
            />
          )}

          {/* Preferences */}
          <PreferenceSelection
            token={token}
            initialPreferences={data.preferences}
            isComplete={data.steps.preferences}
            onUpdate={(preferences) => {
              setData(prev => prev ? { ...prev, preferences: preferences as unknown as Record<string, unknown> } : null);
            }}
            onComplete={() => {
              setData(prev => prev ? {
                ...prev,
                steps: { ...prev.steps, preferences: true }
              } : null);
            }}
          />

          {/* E-Signature */}
          <ESignature
            token={token}
            hasSigned={!!data.booking.eSignedAt}
            signedAt={data.booking.eSignedAt}
            onComplete={() => {
              setData(prev => prev ? {
                ...prev,
                booking: { ...prev.booking, eSignedAt: new Date().toISOString() },
                steps: { ...prev.steps, eSignature: true }
              } : null);
            }}
          />

          {/* Payment Summary */}
          <PaymentSummary
            booking={data.booking}
            roomType={data.roomType}
            payment={data.payment}
            isComplete={data.steps.payment}
            onComplete={() => {
              fetchPortalData();
            }}
          />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>
            Need help? Contact us at{' '}
            <a href="mailto:support@example.com" className="text-primary hover:underline">
              support@example.com
            </a>
          </p>
          <p className="mt-1">
            Powered by StaySuite HospitalityOS
          </p>
        </div>
      </div>
    </div>
  );
}
