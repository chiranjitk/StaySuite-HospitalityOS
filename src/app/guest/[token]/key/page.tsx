'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useGuestApp } from '../layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Key,
  Lock,
  Loader2,
  Unlock,
  RefreshCw,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Wifi,
  Battery,
  Copy,
  QrCode,
  Shield,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function KeyPage() {
  const { data: guestData } = useGuestApp();
  const { toast } = useToast();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [keyData, setKeyData] = useState<{
    enabled: boolean;
    secret?: string;
    lastAccess?: string;
    accessCount: number;
  } | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  // Initialize key data from guest data
  useEffect(() => {
    if (guestData?.room) {
      setKeyData({
        enabled: guestData.room.digitalKeyEnabled,
        secret: guestData.room.digitalKeySecret,
      lastAccess: undefined,
        accessCount: 0,
      });
    }
  }, [guestData]);

  // Generate real QR code from key secret + room number
  const generateQRCode = useCallback(async (secret: string, roomNumber: string) => {
    try {
      const QRCode = await import('qrcode');
      const payload = JSON.stringify({ room: roomNumber, key: secret });
      const url = await QRCode.toDataURL(payload, { width: 200, margin: 1, color: { dark: '#1e3a5f', light: '#ffffff' } });
      setQrCodeUrl(url);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }, []);

  useEffect(() => {
    if (keyData?.secret && guestData?.room) {
      generateQRCode(keyData.secret, guestData.room.number);
    } else {
    setQrCodeUrl(null);
  }
  }, [keyData?.secret, guestData?.room, generateQRCode]);

  // Regenerate key
  const handleRegenerateKey = async () => {
    if (!guestData?.room) return;

    setIsRefreshing(true);
    try {
      const response = await fetch('/api/digital-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: guestData.room.id,
          action: 'regenerate',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setKeyData(prev => prev ? {
          ...prev,
          secret: result.data.keySecret,
        } : null);
        toast({
          title: 'Key Regenerated',
          description: 'Your new digital key has been generated',
        });
      } else {
        throw new Error(result.error?.message || 'Failed to regenerate key');
      }
    } catch (error) {
      console.error('Error regenerating key:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate key',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Copy key code
  const handleCopyKey = () => {
    if (keyData?.secret) {
      navigator.clipboard.writeText(keyData.secret);
      toast({
        title: 'Copied',
        description: 'Key code copied to clipboard',
      });
    }
  };

  // Loading state
  if (!guestData) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const { room, roomType, booking, property } = guestData;

  // No room assigned
  if (!room) {
    return (
      <div className="p-4">
        <Card className="bg-slate-50 dark:bg-slate-800/50 border-dashed">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
              <Key className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No Room Assigned</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your room has not been assigned yet. Please check with the front desk.
            </p>
            <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-300">
              <Clock className="h-3 w-3 mr-1" />
              Pending Assignment
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Key not enabled
  if (!keyData?.enabled) {
    return (
      <div className="p-4">
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-semibold mb-2">Digital Key Not Active</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your digital key is not yet activated. Please complete check-in at the front desk.
            </p>
            <Badge className="bg-amber-500">
              <Lock className="h-3 w-3 mr-1" />
              Key Disabled
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Key Card */}
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-sky-500 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Badge className="bg-white/20 text-white border-0">
              <Unlock className="h-3 w-3 mr-1" />
              Active
            </Badge>
            <div className="flex items-center gap-1 text-xs text-sky-100">
              <Shield className="h-3 w-3" />
              Secure Access
            </div>
          </div>

          <div className="text-center mb-4">
            <p className="text-sky-100 text-sm mb-1">Room</p>
            <h2 className="text-4xl font-bold">{room.number}</h2>
            <p className="text-sky-100 text-sm mt-1">{roomType.name}</p>
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-xl p-6 max-w-[200px] mx-auto">
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="Room QR Code"
                className="w-full h-full rounded-lg"
              />
            ) : (
              <div className="aspect-square flex items-center justify-center bg-slate-100 rounded-lg">
                <QrCode className="h-12 w-12 text-slate-300" />
              </div>
            )}
          </div>
        </div>

        <CardContent className="p-4">
          {/* Key Code */}
          {keyData.secret && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Key Code</p>
                  <code className="text-lg font-mono font-bold">{keyData.secret}</code>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyKey}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
            </div>
          )}

          {/* Room Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Floor {room.floor}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Key className="h-4 w-4" />
              <span>{roomType.name}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Valid until check-out</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span>{keyData.accessCount} unlocks</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3">How to Use</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400 text-xs font-medium shrink-0">
                1
              </div>
              <p className="text-sm text-muted-foreground">
                Hold your phone near the door lock sensor
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400 text-xs font-medium shrink-0">
                2
              </div>
              <p className="text-sm text-muted-foreground">
                The lock will automatically recognize your digital key
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400 text-xs font-medium shrink-0">
                3
              </div>
              <p className="text-sm text-muted-foreground">
                Wait for the green light and unlock sound
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={handleRegenerateKey}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Regenerate
        </Button>
        <Button variant="outline">
          <Shield className="h-4 w-4 mr-2" />
          Report Issue
        </Button>
      </div>

      {/* Validity Info */}
      <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-emerald-900 dark:text-emerald-100">Key Valid</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Expires {format(new Date(booking.checkOut), 'MMM d, yyyy')} at {booking.checkOutTime}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tech Requirements */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        <p className="text-xs text-muted-foreground text-center mb-3">
          Requirements for digital key access
        </p>
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <Wifi className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            <span>NFC/Bluetooth</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Battery className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            <span>Active Phone</span>
          </div>
        </div>
      </div>
    </div>
  );
}


