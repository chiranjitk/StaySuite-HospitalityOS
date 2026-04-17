'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Smartphone,
  Key,
  Copy,
  Check,
  AlertTriangle,
  QrCode,
} from 'lucide-react';
import { toast } from 'sonner';
import { SectionGuard } from '@/components/common/section-guard';

interface TwoFactorSetupData {
  enabled: boolean;
  secret?: string;
  qrCode?: string;
  otpauthUrl?: string;
  backupCodes?: string[];
  manualEntryKey?: string;
}

export default function TwoFactorSetup() {
  const [isLoading, setIsLoading] = useState(true);
  const [setupData, setSetupData] = useState<TwoFactorSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [isDisabling, setIsDisabling] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [step, setStep] = useState<'initial' | 'setup' | 'verify' | 'enabled'>('initial');

  useEffect(() => {
    fetchSetupData();
  }, []);

  const fetchSetupData = async () => {
    try {
      const response = await fetch('/api/auth/2fa/setup');
      const data = await response.json();

      if (data.success) {
        setSetupData(data);
        setStep(data.enabled ? 'enabled' : 'initial');
      } else {
        toast.error(data.error || 'Failed to fetch 2FA status');
      }
    } catch (error) {
      console.error('Error fetching 2FA setup:', error);
      toast.error('Failed to fetch 2FA status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSetup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/setup');
      const data = await response.json();

      if (data.success && !data.enabled) {
        setSetupData(data);
        setStep('setup');
      } else if (data.enabled) {
        setStep('enabled');
      }
    } catch (error) {
      console.error('Error starting 2FA setup:', error);
      toast.error('Failed to start 2FA setup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode, enableSetup: true }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('2FA enabled successfully!');
        setStep('enabled');
        setSetupData({ enabled: true });
        setVerificationCode('');
      } else {
        toast.error(data.error || 'Invalid verification code');
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      toast.error('Failed to verify code');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisable = async () => {
    if (!disableCode && !disablePassword) {
      toast.error('Please enter your verification code or password');
      return;
    }

    setIsDisabling(true);
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: disableCode || undefined, password: disablePassword || undefined }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('2FA disabled successfully');
        setShowDisableDialog(false);
        setStep('initial');
        setSetupData({ enabled: false });
        setDisableCode('');
        setDisablePassword('');
      } else {
        toast.error(data.error || 'Failed to disable 2FA');
      }
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      toast.error('Failed to disable 2FA');
    } finally {
      setIsDisabling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast.success('Copied to clipboard');
  };

  if (isLoading && !setupData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <SectionGuard permission="security.2fa">
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-2 ${step === 'enabled' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                {step === 'enabled' ? (
                  <ShieldCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <Shield className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </div>
            </div>
            <Badge variant={step === 'enabled' ? 'default' : 'secondary'} className={step === 'enabled' ? 'bg-green-600' : ''}>
              {step === 'enabled' ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {step === 'initial' && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Two-factor authentication is not enabled. Enable it to secure your account with an authenticator app.
                </AlertDescription>
              </Alert>
              <Button onClick={handleStartSetup} className="bg-teal-600 hover:bg-teal-700">
                <Key className="mr-2 h-4 w-4" />
                Enable 2FA
              </Button>
            </div>
          )}

          {step === 'setup' && setupData && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Step 1: Scan QR Code</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                    </p>
                    {setupData.qrCode && (
                      <div className="bg-white p-4 rounded-lg inline-block border">
                        <img src={setupData.qrCode} alt="2FA QR Code" className="w-48 h-48" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Or enter code manually</h4>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-3 py-2 rounded text-sm font-mono">
                        {setupData.manualEntryKey}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(setupData.manualEntryKey || '')}
                      >
                        {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Step 2: Save Backup Codes</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Store these backup codes in a safe place. You can use them to access your account if you lose your authenticator.
                    </p>
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                        {setupData.backupCodes?.map((code, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="text-muted-foreground">{index + 1}.</span>
                            <code>{code}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => copyToClipboard(setupData.backupCodes?.join('\n') || '')}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy All Codes
                    </Button>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Step 3: Verify Setup</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Enter the 6-digit code from your authenticator app to complete setup.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="000000"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="text-center text-2xl tracking-widest font-mono"
                        maxLength={6}
                      />
                      <Button onClick={handleVerify} disabled={isVerifying || verificationCode.length < 6}>
                        {isVerifying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Verify'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'enabled' && (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
                <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Two-factor authentication is enabled. You&apos;ll need to enter a code from your authenticator app when signing in.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchSetupData}>
                  <Smartphone className="mr-2 h-4 w-4" />
                  View Recovery Codes
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDisableDialog(true)}
                >
                  <ShieldOff className="mr-2 h-4 w-4" />
                  Disable 2FA
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disable 2FA Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              This will remove the extra security layer from your account. Please verify your identity to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Enter 2FA Code or Password</Label>
              <Input
                placeholder="6-digit code from authenticator"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center font-mono"
                maxLength={6}
              />
              <div className="text-center text-muted-foreground text-sm">or</div>
              <Input
                type="password"
                placeholder="Your password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDisable} disabled={isDisabling}>
              {isDisabling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disabling...
                </>
              ) : (
                'Disable 2FA'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </SectionGuard>
  );
}
