'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  Smartphone,
  Key,
  Check,
  Copy,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface TwoFactorSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TwoFactorSetupModal({ open, onOpenChange, onSuccess }: TwoFactorSetupModalProps) {
  const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    if (open && step === 'setup') {
      fetchSetupData();
    }
  }, [open, step]);

  const fetchSetupData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/setup');
      const data = await response.json();

      if (data.success) {
        if (data.enabled) {
          // Already enabled
          toast.info('Two-factor authentication is already enabled');
          onOpenChange(false);
          return;
        }
        setQrCode(data.qrCode);
        setSecret(data.manualEntryKey);
        setBackupCodes(data.backupCodes || []);
      } else {
        toast.error(data.error || 'Failed to setup 2FA');
      }
    } catch (error) {
      console.error('Error fetching 2FA setup:', error);
      toast.error('Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length < 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode, enableSetup: true }),
      });

      const data = await response.json();

      if (data.success) {
        setStep('backup');
        toast.success('Two-factor authentication enabled!');
      } else {
        toast.error(data.error || 'Invalid verification code');
      }
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      toast.error('Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    toast.success('Secret key copied to clipboard');
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast.success('Backup codes copied to clipboard');
  };

  const handleFinish = () => {
    onSuccess();
    onOpenChange(false);
    // Reset state
    setStep('setup');
    setVerifyCode('');
    setQrCode(null);
    setSecret('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication Setup
          </DialogTitle>
          <DialogDescription>
            {step === 'setup' && 'Scan the QR code with your authenticator app'}
            {step === 'verify' && 'Enter the verification code from your authenticator app'}
            {step === 'backup' && 'Save these backup codes in a secure location'}
          </DialogDescription>
        </DialogHeader>

        {step === 'setup' && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : qrCode ? (
              <>
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-lg">
                    <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Manual Entry Key
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={secret}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={handleCopySecret}>
                      {copiedSecret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Alert>
                  <Smartphone className="h-4 w-4" />
                  <AlertDescription>
                    Use Google Authenticator, Authy, or any TOTP-compatible app to scan the QR code.
                  </AlertDescription>
                </Alert>

                <Button className="w-full" onClick={() => setStep('verify')}>
                  I've scanned the code
                </Button>
              </>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to generate QR code. Please try again.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verifyCode">Verification Code</Label>
              <Input
                id="verifyCode"
                type="text"
                placeholder="Enter 6-digit code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest font-mono"
                maxLength={6}
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Enter the 6-digit code shown in your authenticator app.
              </AlertDescription>
            </Alert>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setStep('setup')}>
                Back
              </Button>
              <Button onClick={handleVerify} disabled={loading || verifyCode.length !== 6}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verify & Enable
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'backup' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Store these backup codes securely. Each code can be used once if you lose access to your authenticator.
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <span>{code}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleCopyBackupCodes}>
              <Copy className="h-4 w-4 mr-2" />
              Copy All Backup Codes
            </Button>

            <Button className="w-full" onClick={handleFinish}>
              <Check className="h-4 w-4 mr-2" />
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
