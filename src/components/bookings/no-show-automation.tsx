'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  UserX,
  DollarSign,
  DoorOpen,
  Play,
  Eye,
  Settings,
  Info,
  AlertTriangle,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

const CRON_SECRET = process.env.NEXT_PUBLIC_CRON_SECRET || '';

interface NoShowSettings {
  noShowBufferHours: number;
  autoProcessNoShows: boolean;
  noShowNotificationEnabled: boolean;
}

interface NoShowBooking {
  id: string;
  confirmationCode: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  totalAmount: number;
  status: string;
}

interface DetectionResult {
  success: boolean;
  message: string;
  data?: {
    processed: number;
    markedNoShow: number;
    penaltiesApplied: number;
    roomsReleased: number;
    dryRun?: boolean;
  };
}

// =====================================================
// COMPONENT
// =====================================================

export default function NoShowAutomation() {
  // --- Settings ---
  const [settings, setSettings] = useState<NoShowSettings>({
    noShowBufferHours: 1,
    autoProcessNoShows: false,
    noShowNotificationEnabled: true,
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);

  // --- Detection ---
  const [runningDetection, setRunningDetection] = useState(false);
  const [runningDryRun, setRunningDryRun] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // --- Table ---
  const [noShowBookings, setNoShowBookings] = useState<NoShowBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // --- Stats ---
  const [stats, setStats] = useState({
    todayNoShows: 0,
    monthNoShows: 0,
    revenueFromPenalties: 0,
    roomsReleased: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // =====================================================
  // FETCH NO-SHOW BOOKINGS (for stats + table)
  // =====================================================

  const fetchNoShowBookings = useCallback(async () => {
    setLoadingStats(true);
    setLoadingBookings(true);
    try {
      // Fetch up to 100 for stats computation
      const res = await fetch('/api/bookings?status=no_show&limit=100');
      if (!res.ok) {
        console.error('Failed to fetch no-show bookings:', res.status);
        return;
      }
      const json = await res.json();
      const allBookings: NoShowBooking[] = (json.data || json.bookings || []).map(
        (b: Record<string, unknown>) => ({
          id: b.id,
          confirmationCode: b.confirmationCode || '',
          guestName: b.primaryGuest
            ? `${(b.primaryGuest as Record<string, unknown>).firstName || ''} ${(b.primaryGuest as Record<string, unknown>).lastName || ''}`.trim()
            : (b.guestName || 'Unknown'),
          roomNumber: b.room
            ? (b.room as Record<string, unknown>).number || 'Unassigned'
            : (b.roomNumber || 'Unassigned'),
          checkIn: b.checkIn || '',
          totalAmount: b.totalAmount || 0,
          status: b.status || 'no_show',
        })
      );

      // Filter today's no-shows
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayNoShows = allBookings.filter(
        (b) => b.checkIn && b.checkIn.slice(0, 10) === todayStr
      );

      // Filter this month's no-shows
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const monthNoShows = allBookings.filter(
        (b) => b.checkIn && b.checkIn.slice(0, 10) >= monthStart
      );

      // Revenue from penalties (totalAmount as proxy)
      const revenue = allBookings.reduce((sum, b) => sum + b.totalAmount, 0);

      // Rooms released (any booking with a room number)
      const rooms = allBookings.filter((b) => b.roomNumber && b.roomNumber !== 'Unassigned').length;

      setStats({
        todayNoShows: todayNoShows.length,
        monthNoShows: monthNoShows.length,
        revenueFromPenalties: revenue,
        roomsReleased: rooms,
      });

      // For table, show up to 20
      setNoShowBookings(allBookings.slice(0, 20));
    } catch (err) {
      console.error('Error fetching no-show bookings:', err);
    } finally {
      setLoadingStats(false);
      setLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    fetchNoShowBookings();
  }, [fetchNoShowBookings]);

  // =====================================================
  // FETCH SETTINGS
  // =====================================================

  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      // Use a generic property lookup — fetch properties first, then settings for the first one
      const propRes = await fetch('/api/properties');
      if (propRes.ok) {
        const propJson = await propRes.json();
        const properties = propJson.data || propJson.properties || [];
        if (Array.isArray(properties) && properties.length > 0) {
          const propId = properties[0].id;
          const settingsRes = await fetch(
            `/api/no-show/settings?propertyId=${propId}`
          );
          if (settingsRes.ok) {
            const settingsJson = await settingsRes.json();
            if (settingsJson.data) {
              setSettings({
                noShowBufferHours: settingsJson.data.noShowBufferHours ?? 1,
                autoProcessNoShows: settingsJson.data.autoProcessNoShows ?? false,
                noShowNotificationEnabled:
                  settingsJson.data.noShowNotificationEnabled ?? true,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // =====================================================
  // SAVE SETTINGS
  // =====================================================

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const propRes = await fetch('/api/properties');
      if (!propRes.ok) {
        toast.error('Failed to fetch properties');
        return;
      }
      const propJson = await propRes.json();
      const properties = propJson.data || propJson.properties || [];
      if (!Array.isArray(properties) || properties.length === 0) {
        toast.error('No properties found');
        return;
      }
      const propId = properties[0].id;

      const res = await fetch(`/api/no-show/settings?propertyId=${propId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success('Settings saved successfully');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error?.message || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Network error saving settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // =====================================================
  // RUN DETECTION
  // =====================================================

  const runDetection = async (dryRun = false) => {
    if (!dryRun) setRunningDetection(true);
    else setRunningDryRun(true);
    setConfirmDialogOpen(false);

    try {
      const res = await fetch('/api/cron/no-show-detection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CRON_SECRET}`,
        },
        body: JSON.stringify({ dryRun }),
      });
      const result: DetectionResult = await res.json();
      setDetectionResult(result);

      if (result.success) {
        toast.success(result.message || (dryRun ? 'Dry run complete' : 'Detection complete'));
        fetchNoShowBookings();
      } else {
        toast.error(result.message || 'Detection failed');
      }
    } catch (err) {
      console.error('Error running detection:', err);
      toast.error('Network error running detection');
    } finally {
      if (!dryRun) setRunningDetection(false);
      else setRunningDryRun(false);
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/30">
          <Clock className="h-5 w-5 text-rose-700 dark:text-rose-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">No-Show Automation</h1>
          <p className="text-muted-foreground text-sm">
            Automatically detect and process guest no-shows, apply penalties, and release rooms
          </p>
        </div>
      </div>

      {!CRON_SECRET && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">
          Cron is not configured. Set <code className="rounded bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5">NEXT_PUBLIC_CRON_SECRET</code> in your environment to enable no-show detection triggers.
        </div>
      )}

      {/* 2. Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingStats ? (
          <div className="col-span-full text-center py-8 text-muted-foreground text-sm">
            Loading stats...
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                    <UserX className="h-5 w-5 text-rose-700 dark:text-rose-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Today&apos;s No-Shows</p>
                    <p className="text-2xl font-bold">{stats.todayNoShows}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Calendar className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">This Month No-Shows</p>
                    <p className="text-2xl font-bold">{stats.monthNoShows}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <DollarSign className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue from Penalties</p>
                    <p className="text-2xl font-bold">
                      ${stats.revenueFromPenalties.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                    <DoorOpen className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rooms Released</p>
                    <p className="text-2xl font-bold">{stats.roomsReleased}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* 3. Settings Card (Collapsible) */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">No-Show Settings</CardTitle>
              {settings.autoProcessNoShows && (
                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                  Auto-Processing
                </Badge>
              )}
            </div>
            <span className="text-muted-foreground text-sm">
              {settingsOpen ? '▲' : '▼'}
            </span>
          </div>
          <CardDescription>
            Configure per-property no-show detection rules and notifications
          </CardDescription>
        </CardHeader>
        {settingsOpen && (
          <CardContent className="space-y-6">
            {loadingSettings ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Loading settings...
              </div>
            ) : (
              <>
                {/* Auto-Process Switch */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-process" className="text-sm font-medium">
                      Auto-Process
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically mark bookings as no-show and apply penalties
                    </p>
                  </div>
                  <Switch
                    id="auto-process"
                    checked={settings.autoProcessNoShows}
                    onCheckedChange={(checked) =>
                      setSettings((s) => ({ ...s, autoProcessNoShows: checked }))
                    }
                  />
                </div>

                <Separator />

                {/* Buffer Hours Input */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="buffer-hours" className="text-sm font-medium">
                      Buffer Hours
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Hours after check-in time before marking as no-show (1-24)
                    </p>
                  </div>
                  <Input
                    id="buffer-hours"
                    type="number"
                    min={1}
                    max={24}
                    value={settings.noShowBufferHours}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1 && val <= 24) {
                        setSettings((s) => ({ ...s, noShowBufferHours: val }));
                      }
                    }}
                    className="w-20 text-center"
                  />
                </div>

                <Separator />

                {/* Notifications Switch */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifications" className="text-sm font-medium">
                      Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Send alerts when no-shows are detected
                    </p>
                  </div>
                  <Switch
                    id="notifications"
                    checked={settings.noShowNotificationEnabled}
                    onCheckedChange={(checked) =>
                      setSettings((s) => ({ ...s, noShowNotificationEnabled: checked }))
                    }
                  />
                </div>

                <Separator />

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button onClick={saveSettings} disabled={savingSettings}>
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* 4. Manual Run Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Run Detection Now */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-rose-100 dark:bg-rose-900/30">
                <AlertTriangle className="h-4 w-4 text-rose-700 dark:text-rose-400" />
              </div>
              <CardTitle className="text-base">Run Detection Now</CardTitle>
            </div>
            <CardDescription>
              Process all confirmed bookings past their check-in deadline
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will scan bookings past the check-in deadline, mark them as no-shows,
              apply penalties, and release rooms. This action cannot be undone.
            </p>
            <Button
              className="w-full"
              onClick={() => setConfirmDialogOpen(true)}
              disabled={runningDetection}
            >
              {runningDetection ? 'Processing...' : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Detection Now
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview (Dry Run) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-sky-100 dark:bg-sky-900/30">
                <Eye className="h-4 w-4 text-sky-700 dark:text-sky-400" />
              </div>
              <CardTitle className="text-base">Preview (Dry Run)</CardTitle>
            </div>
            <CardDescription>
              See what would happen without making actual changes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Run a dry run to preview which bookings would be marked as no-shows,
              penalties that would apply, and rooms that would be released.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => runDetection(true)}
              disabled={runningDryRun}
            >
              {runningDryRun ? 'Previewing...' : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview (Dry Run)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Detection Result */}
      {detectionResult && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Last Execution Result</CardTitle>
              {detectionResult.data?.dryRun && (
                <Badge variant="secondary">Dry Run</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-4">{detectionResult.message}</p>
            {detectionResult.data && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold">{detectionResult.data.processed}</p>
                  <p className="text-xs text-muted-foreground">Bookings Scanned</p>
                </div>
                <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 p-3 text-center">
                  <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                    {detectionResult.data.markedNoShow}
                  </p>
                  <p className="text-xs text-muted-foreground">No-Shows Marked</p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                    {detectionResult.data.penaltiesApplied}
                  </p>
                  <p className="text-xs text-muted-foreground">Penalties Applied</p>
                </div>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {detectionResult.data.roomsReleased}
                  </p>
                  <p className="text-xs text-muted-foreground">Rooms Released</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. Recent No-Shows Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent No-Shows</CardTitle>
              <CardDescription>
                Bookings that have been marked as no-show
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchNoShowBookings}
              disabled={loadingBookings}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBookings ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Loading no-show bookings...
            </div>
          ) : noShowBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserX className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No no-show bookings found</p>
              <p className="text-xs text-muted-foreground mt-1">
                No-shows will appear here once the detection job runs
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Check-in Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {noShowBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-mono text-sm">
                        {booking.confirmationCode}
                      </TableCell>
                      <TableCell className="text-sm">{booking.guestName}</TableCell>
                      <TableCell className="text-sm">
                        {booking.roomNumber}
                      </TableCell>
                      <TableCell className="text-sm">
                        {booking.checkIn
                          ? new Date(booking.checkIn).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        {booking.totalAmount > 0
                          ? `$${booking.totalAmount.toFixed(2)}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="destructive" className="text-xs">
                          No-Show
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. Cron Setup Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Cron Setup</CardTitle>
          </div>
          <CardDescription>
            Configure an external cron scheduler to automatically run no-show detection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recommended Schedule */}
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>Recommended schedule:</strong> Run hourly{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">0 * * * *</code> or
              daily 15 minutes after your check-in time (e.g.,{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">15 15 * * *</code> for
              3:00 PM check-in).
            </AlertDescription>
          </Alert>

          {/* Curl Example */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Curl Command Example</p>
            <div className="rounded-md bg-muted p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`# Run no-show detection (hourly)
0 * * * * curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/cron/no-show-detection \\
  -H "Authorization: Bearer $CRON_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{}'

# Dry run (preview only)
0 * * * * curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/cron/no-show-detection \\
  -H "Authorization: Bearer $CRON_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"dryRun": true}'`}
            </div>
          </div>

          {/* Security Warning */}
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-400 text-sm">
                  Security Note
                </p>
                <p className="text-amber-700 dark:text-amber-500 text-xs mt-0.5">
                  Set the <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">CRON_SECRET</code> environment
                  variable to protect cron endpoints. Properties must have &quot;Auto-Process&quot; enabled
                  in settings for the cron to process them.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Confirm No-Show Detection
            </DialogTitle>
            <DialogDescription>
              This will scan all confirmed bookings past their check-in deadline and
              process them as no-shows. This action cannot be undone.
            </DialogDescription>
            <div className="space-y-3 pt-2">
              <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-muted-foreground" />
                  <span>Bookings will be marked as no-show</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>Penalties will be applied per cancellation policies</span>
                </div>
                <div className="flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-muted-foreground" />
                  <span>Rooms will be released for re-booking</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Consider running a dry run first to preview the impact.
              </p>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmDialogOpen(false);
                runDetection(true);
              }}
            >
              <Eye className="mr-1 h-3 w-3" />
              Dry Run First
            </Button>
            <Button onClick={() => runDetection(false)}>
              <Play className="mr-1 h-3 w-3" />
              Run Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
