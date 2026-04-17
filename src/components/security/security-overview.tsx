'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Monitor,
  Smartphone,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SectionGuard } from '@/components/common/section-guard';
import { formatDistanceToNow } from 'date-fns';

interface SecurityStatus {
  twoFactorEnabled: boolean;
  activeSessions: number;
  lastLogin: string | null;
  lastLoginIp: string | null;
  passwordLastChanged: string | null;
  accountLocked: boolean;
  failedAttempts: number;
}

interface SecurityOverviewProps {
  onNavigate?: (section: string) => void;
}

export default function SecurityOverview({ onNavigate }: SecurityOverviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);

  useEffect(() => {
    fetchSecurityStatus();
  }, []);

  const fetchSecurityStatus = async () => {
    try {
      // Fetch security events stats for the security overview
      const eventsResponse = await fetch('/api/security/events?stats=true');
      const eventsData = await eventsResponse.json();

      // Fetch 2FA status
      const twoFAResponse = await fetch('/api/auth/2fa/setup');
      const twoFAData = await twoFAResponse.json();

      // Fetch active sessions from auth endpoint for session count
      const sessionsResponse = await fetch('/api/auth/sessions');
      const sessionsData = await sessionsResponse.json();

      if (eventsData.success && twoFAData.success && sessionsData.success) {
        const stats = eventsData.data;
        const currentSession = sessionsData.sessions?.find((s: { isCurrent: boolean }) => s.isCurrent);

        setSecurityStatus({
          twoFactorEnabled: twoFAData.enabled || false,
          activeSessions: sessionsData.total || 1,
          lastLogin: currentSession?.createdAt || null,
          lastLoginIp: currentSession?.ipAddress || null,
          passwordLastChanged: null, // We don't track this yet
          accountLocked: false,
          failedAttempts: stats.unacknowledgedCount || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching security status:', error);
      toast.error('Failed to fetch security status');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSecurityScore = () => {
    if (!securityStatus) return 0;

    let score = 50; // Base score

    // 2FA enabled
    if (securityStatus.twoFactorEnabled) {
      score += 30;
    }

    // Few active sessions
    if (securityStatus.activeSessions <= 1) {
      score += 10;
    } else if (securityStatus.activeSessions <= 3) {
      score += 5;
    }

    // Account not locked
    if (!securityStatus.accountLocked) {
      score += 10;
    }

    return Math.min(100, score);
  };

  const getSecurityLevel = (score: number) => {
    if (score >= 80) return { label: 'Strong', color: 'text-green-600 dark:text-green-400' };
    if (score >= 60) return { label: 'Moderate', color: 'text-yellow-600 dark:text-yellow-400' };
    return { label: 'Weak', color: 'text-red-600 dark:text-red-400' };
  };

  const securityChecks = [
    {
      label: 'Two-Factor Authentication',
      status: securityStatus?.twoFactorEnabled,
      icon: Key,
      action: 'security-2fa',
      description: securityStatus?.twoFactorEnabled
        ? 'Your account is protected with 2FA'
        : 'Enable 2FA for extra security',
    },
    {
      label: 'Active Sessions',
      status: (securityStatus?.activeSessions ?? 0) <= 3,
      icon: Monitor,
      action: 'security-sessions',
      description: `${securityStatus?.activeSessions || 0} active session${(securityStatus?.activeSessions || 0) !== 1 ? 's' : ''}`,
    },
    {
      label: 'Account Lock Status',
      status: !securityStatus?.accountLocked,
      icon: Lock,
      description: securityStatus?.accountLocked
        ? 'Account is currently locked'
        : 'Account is in good standing',
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </CardContent>
      </Card>
    );
  }

  const securityScore = calculateSecurityScore();
  const securityLevel = getSecurityLevel(securityScore);

  return (
    <SectionGuard permission="security.view">
      <div className="space-y-6">
      {/* Security Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Overview
          </CardTitle>
          <CardDescription>
            Your account security status and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Security Score */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Security Score</span>
                <span className={`text-sm font-bold ${securityLevel.color}`}>
                  {securityScore}% - {securityLevel.label}
                </span>
              </div>
              <Progress
                value={securityScore}
                className="h-3"
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {securityScore >= 80 ? (
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                ) : securityScore >= 60 ? (
                  <ShieldAlert className="h-4 w-4 text-yellow-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span>
                  {securityScore >= 80
                    ? 'Your account is well protected'
                    : securityScore >= 60
                    ? 'Consider improving your security settings'
                    : 'Take action to improve your account security'}
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Active Sessions</span>
                </div>
                <p className="text-2xl font-bold">{securityStatus?.activeSessions || 0}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Last Login</span>
                </div>
                <p className="text-sm font-medium">
                  {securityStatus?.lastLogin
                    ? formatDistanceToNow(new Date(securityStatus.lastLogin), { addSuffix: true })
                    : 'Unknown'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security Checklist</CardTitle>
          <CardDescription>
            Complete these items to improve your account security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {securityChecks.map((check, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`rounded-full p-2 ${
                      check.status
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-red-100 dark:bg-red-900/30'
                    }`}
                  >
                    {check.status ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{check.label}</div>
                    <div className="text-sm text-muted-foreground">{check.description}</div>
                  </div>
                </div>
                {check.action && !check.status && onNavigate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate(check.action!)}
                  >
                    Fix Now
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent Security Activity</CardTitle>
              <CardDescription>
                Recent login and security events
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate?.('security-sessions')}>
              View All Sessions
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2">
                <LogOut className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Current Session Started</div>
                <div className="text-xs text-muted-foreground">
                  {securityStatus?.lastLogin
                    ? formatDistanceToNow(new Date(securityStatus.lastLogin), { addSuffix: true })
                    : 'Unknown'}{' '}
                  from {securityStatus?.lastLoginIp || 'Unknown IP'}
                </div>
              </div>
              <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                Current
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:border-teal-500 transition-colors" onClick={() => onNavigate?.('security-2fa')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-teal-100 dark:bg-teal-900/30 p-2">
                <Key className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <div className="font-medium">Manage 2FA</div>
                <div className="text-xs text-muted-foreground">
                  {securityStatus?.twoFactorEnabled ? '2FA is enabled' : 'Enable 2FA'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-teal-500 transition-colors" onClick={() => onNavigate?.('security-sessions')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2">
                <Monitor className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-medium">Device Sessions</div>
                <div className="text-xs text-muted-foreground">
                  {securityStatus?.activeSessions || 0} active
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-teal-500 transition-colors" onClick={() => onNavigate?.('security-sso')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-2">
                <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="font-medium">SSO Settings</div>
                <div className="text-xs text-muted-foreground">
                  Configure SSO
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </SectionGuard>
  );
}
