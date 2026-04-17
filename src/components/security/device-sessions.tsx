'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  LogOut,
  Loader2,
  AlertTriangle,
  Chrome,
  Globe2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SectionGuard } from '@/components/common/section-guard';
import { formatDistanceToNow, format } from 'date-fns';

interface Session {
  id: string;
  isCurrent: boolean;
  deviceType: string;
  browser: string;
  os: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  lastActive: string;
}

interface SessionsResponse {
  success: boolean;
  sessions: Session[];
  total: number;
}

export default function DeviceSessions() {
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [revokeSessionId, setRevokeSessionId] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/auth/sessions');
      const data: SessionsResponse = await response.json();

      if (data.success) {
        setSessions(data.sessions);
      } else {
        toast.error('Failed to fetch sessions');
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to fetch sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setIsRevoking(true);
    try {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Session revoked successfully');
        setSessions(sessions.filter((s) => s.id !== sessionId));
      } else {
        toast.error(data.error || 'Failed to revoke session');
      }
    } catch (error) {
      console.error('Error revoking session:', error);
      toast.error('Failed to revoke session');
    } finally {
      setIsRevoking(false);
      setRevokeSessionId(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    setIsRevoking(true);
    try {
      const response = await fetch('/api/auth/sessions', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Revoked ${data.revokedCount} sessions`);
        // Keep only current session
        setSessions(sessions.filter((s) => s.isCurrent));
      } else {
        toast.error(data.error || 'Failed to revoke sessions');
      }
    } catch (error) {
      console.error('Error revoking all sessions:', error);
      toast.error('Failed to revoke sessions');
    } finally {
      setIsRevoking(false);
      setShowRevokeAllDialog(false);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
      case 'tablet':
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  const getBrowserIcon = (browser: string) => {
    switch (browser.toLowerCase()) {
      case 'chrome':
        return <Chrome className="h-4 w-4" />;
      case 'firefox':
        return <Globe className="h-4 w-4" />;
      case 'safari':
        return <Globe2 className="h-4 w-4" />;
      case 'microsoft edge':
        return <Globe2 className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </CardContent>
      </Card>
    );
  }

  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const currentSession = sessions.find((s) => s.isCurrent);

  return (
    <SectionGuard permission="security.sessions">
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Device Sessions</CardTitle>
              <CardDescription>
                Manage your active sessions across all devices
              </CardDescription>
            </div>
            {otherSessions.length > 0 && (
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setShowRevokeAllDialog(true)}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out All Other Devices
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active sessions found
            </div>
          ) : (
            <div className="space-y-4">
              {/* Current Session */}
              {currentSession && (
                <div className="border rounded-lg p-4 bg-teal-50/50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {getDeviceIcon(currentSession.deviceType)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Current Session</span>
                          <Badge variant="default" className="bg-teal-600 text-xs">
                            Active Now
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {getBrowserIcon(currentSession.browser)}
                            {currentSession.browser}
                          </span>
                          <span>•</span>
                          <span>{currentSession.os}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {currentSession.ipAddress || 'Unknown IP'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Expires {formatDistanceToNow(new Date(currentSession.expiresAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Other Sessions */}
              {otherSessions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Other Sessions ({otherSessions.length})
                  </h4>
                  {otherSessions.map((session) => (
                    <div
                      key={session.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="mt-1 text-muted-foreground">
                            {getDeviceIcon(session.deviceType)}
                          </div>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {session.deviceType} - {session.browser}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                {getBrowserIcon(session.browser)}
                                {session.browser}
                              </span>
                              <span>•</span>
                              <span>{session.os}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {session.ipAddress || 'Unknown IP'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Last active {formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}
                              </span>
                              <span>•</span>
                              <span>
                                Expires {format(new Date(session.expiresAt), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setRevokeSessionId(session.id)}
                        >
                          <LogOut className="h-4 w-4 mr-1" />
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {otherSessions.length === 0 && currentSession && (
                <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  <span>No other active sessions</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoke Single Session Dialog */}
      <AlertDialog open={!!revokeSessionId} onOpenChange={() => setRevokeSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this session? The device will be signed out immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => revokeSessionId && handleRevokeSession(revokeSessionId)}
              disabled={isRevoking}
            >
              {isRevoking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke Session'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke All Sessions Dialog */}
      <AlertDialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out All Other Devices</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign out all other devices except your current session. You will need to log in again on those devices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRevokeAllSessions}
              disabled={isRevoking}
            >
              {isRevoking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing Out...
                </>
              ) : (
                'Sign Out All Devices'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </SectionGuard>
  );
}
