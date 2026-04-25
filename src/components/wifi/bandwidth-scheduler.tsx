'use client';

/**
 * BandwidthScheduler — Manage scheduled bandwidth policies.
 *
 * Time-of-day bandwidth limits that apply to RADIUS users automatically.
 * Schedules define day(s) of week, time range, and speed caps.
 *
 * Business Logic:
 *   - Create a schedule with day(s), time window, download/upload limits
 *   - The freeradius-service background enforcer (every 60s) checks all enabled schedules
 *   - When a schedule becomes active: CoA is sent to apply the bandwidth to matching users
 *   - When a schedule expires: CoA is sent to revert users back to their plan's default bandwidth
 *   - "Enforce Now" triggers a one-time manual enforcement check
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Clock,
  Plus,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  Calendar,
  Zap,
  ShieldCheck,
  ShieldBan,
  Users,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BandwidthSchedule {
  id: string;
  propertyId?: string;
  name: string;
  daysOfWeek: string;      // Comma-separated: "1,2,3,4,5,6,7" (1=Mon, 7=Sun)
  dayOfWeek: number;       // First day in JS format (0=Sun..6=Sat) — for backward compat
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  startTime: string;       // "HH:MM"
  endTime: string;         // "HH:MM"
  downloadMbps: number;
  uploadMbps: number;
  applyTo: string;         // "all" | "guest" | "staff" | "specific_plan"
  planId?: string | null;  // applyToPlanId
  action: string;          // "limit" | "allow" | "deny"
  enabled: boolean;
  description?: string | null;
  createdAt?: string;
}

interface WifiPlan {
  id: string;
  name: string;
  downloadSpeed: number;
  uploadSpeed: number;
  validityDays?: number;
  dataLimit?: number;
  status: string;
}

interface ScheduleFormData {
  name: string;
  daysOfWeek: number[];    // Schedule format: 1=Mon..7=Sun
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
  downloadMbps: string;
  uploadMbps: string;
  applyTo: string;
  applyToPlanId: string;
  action: string;
  description: string;
  enabled: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// Day index to schedule day: JS 0=Sun → schedule 7, JS 1=Mon → schedule 1, etc.
const JS_TO_SCHEDULE_DAY: Record<number, number> = {
  0: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6,
};

const EMPTY_FORM: ScheduleFormData = {
  name: '',
  daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
  startHour: '09',
  startMinute: '00',
  endHour: '17',
  endMinute: '00',
  downloadMbps: '5',
  uploadMbps: '2',
  applyTo: 'all',
  applyToPlanId: '',
  action: 'limit',
  description: '',
  enabled: true,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatTimeRange(
  startH: number,
  startM: number,
  endH: number,
  endM: number,
): string {
  return `${formatTime(startH, startM)} – ${formatTime(endH, endM)}`;
}

function parseDaysOfWeek(daysStr: string): number[] {
  return String(daysStr || '1,2,3,4,5,6,7')
    .split(',')
    .map(d => parseInt(d.trim(), 10))
    .filter(d => d >= 1 && d <= 7);
}

function daysOfWeekToDaysStr(days: number[]): string {
  return days.sort((a, b) => a - b).join(',');
}

function daysOfWeekToLabel(days: number[]): string {
  if (days.length === 7) return 'Every Day';
  if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) return 'Weekdays';
  if (days.length === 2 && days.includes(6) && days.includes(7)) return 'Weekends';
  return days
    .map(d => {
      // Convert schedule day (1=Mon..7=Sun) to JS day index for DAY_SHORT lookup
      const jsDay = d === 7 ? 0 : d;
      return DAY_SHORT[jsDay];
    })
    .join(', ');
}

function isScheduleActiveNow(schedule: BandwidthSchedule): boolean {
  if (!schedule.enabled) return false;

  const now = new Date();
  const currentJsDay = now.getDay();
  const currentScheduleDay = JS_TO_SCHEDULE_DAY[currentJsDay];
  const days = parseDaysOfWeek(schedule.daysOfWeek);
  if (!days.includes(currentScheduleDay)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = schedule.startHour * 60 + schedule.startMinute;
  const endMinutes = schedule.endHour * 60 + schedule.endMinute;

  // Handle overnight schedules (e.g., 22:00 – 06:00)
  if (endMinutes <= startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Find the next upcoming schedule that will become active.
 */
function findNextSchedule(schedules: BandwidthSchedule[]): BandwidthSchedule | null {
  const now = new Date();
  const todayScheduleDay = JS_TO_SCHEDULE_DAY[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const enabledSchedules = schedules.filter((s) => s.enabled);
  if (enabledSchedules.length === 0) return null;

  // Check each day from today through next 7 days
  for (let offset = 0; offset < 7; offset++) {
    const targetScheduleDay = (todayScheduleDay + offset - 1 + 7) % 7 + 1;

    for (const schedule of enabledSchedules) {
      const days = parseDaysOfWeek(schedule.daysOfWeek);
      if (!days.includes(targetScheduleDay)) continue;

      const startMinutes = schedule.startHour * 60 + schedule.startMinute;

      if (offset === 0) {
        // Today — only consider schedules that haven't started yet
        if (startMinutes > currentMinutes) {
          return schedule;
        }
      } else {
        // Future days — any schedule is "next"
        return schedule;
      }
    }
  }

  return null;
}

function getNextScheduleLabel(
  schedules: BandwidthSchedule[],
): { text: string; dayLabel: string } {
  const next = findNextSchedule(schedules);
  if (!next) return { text: '—', dayLabel: '' };

  const now = new Date();
  const todayScheduleDay = JS_TO_SCHEDULE_DAY[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = next.startHour * 60 + next.startMinute;

  const nextScheduleDay = parseDaysOfWeek(next.daysOfWeek)[0];
  const todayJsDay = now.getDay();
  const nextJsDay = nextScheduleDay === 7 ? 0 : nextScheduleDay;

  const dayLabel =
    nextScheduleDay === todayScheduleDay
      ? 'Today'
      : nextScheduleDay === (todayScheduleDay % 7) + 1
        ? 'Tomorrow'
        : DAY_NAMES[nextJsDay];

  let timeLabel: string;
  if (nextScheduleDay === todayScheduleDay && startMinutes > currentMinutes) {
    const diff = startMinutes - currentMinutes;
    if (diff < 60) timeLabel = `in ${diff}m`;
    else timeLabel = `in ${Math.floor(diff / 60)}h ${diff % 60}m`;
  } else {
    timeLabel = formatTime(next.startHour, next.startMinute);
  }

  return { text: timeLabel, dayLabel };
}

function getActionBadge(action: string): { label: string; variant: 'destructive' | 'success' | 'secondary' | 'default' | 'outline' } {
  switch (action) {
    case 'limit': return { label: 'Limit', variant: 'secondary' };
    case 'deny': return { label: 'Deny', variant: 'destructive' };
    case 'allow': return { label: 'Allow', variant: 'success' };
    default: return { label: action, variant: 'outline' };
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function BandwidthScheduler() {
  const { toast } = useToast();

  const [schedules, setSchedules] = useState<BandwidthSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<BandwidthSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Enforce Now state
  const [enforcing, setEnforcing] = useState(false);

  // WiFi Plans list (for Specific Plan selector)
  const [wifiPlans, setWifiPlans] = useState<WifiPlan[]>([]);

  // Form state — stored as strings for input binding
  const [form, setForm] = useState<ScheduleFormData>(EMPTY_FORM);

  // ─── Computed values ───────────────────────────────────────────────────

  const activeNowCount = useMemo(
    () => schedules.filter(isScheduleActiveNow).length,
    [schedules],
  );

  const activeScheduleIds = useMemo(
    () => new Set(schedules.filter(isScheduleActiveNow).map((s) => s.id)),
    [schedules],
  );

  const nextScheduleInfo = useMemo(
    () => getNextScheduleLabel(schedules),
    [schedules],
  );

  // ─── Fetch ────────────────────────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        '/api/wifi/radius?action=bandwidth-schedules',
      );
      const data = await res.json();
      if (data.success && data.data) {
        const list = Array.isArray(data.data) ? data.data : [];
        setSchedules(list);
        setTotal(data.total ?? list.length);
      }
    } catch (error) {
      console.error('Failed to fetch bandwidth schedules:', error);
      toast({
        title: 'Error',
        description: 'Failed to load bandwidth schedules',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch WiFi plans for the Specific Plan selector
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch('/api/wifi/plans?status=active');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setWifiPlans(data.data.filter((p: WifiPlan) => p.status === 'active'));
        }
      } catch (e) {
        console.error('Failed to fetch WiFi plans:', e);
      }
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Refresh active-now counters every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Force a re-render for "active now" badge
      setSchedules((prev) => [...prev]);
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // ─── Form helpers ─────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingSchedule(null);
  }, []);

  const openCreate = useCallback(() => {
    resetForm();
    setDialogOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((schedule: BandwidthSchedule) => {
    setEditingSchedule(schedule);
    const days = parseDaysOfWeek(schedule.daysOfWeek);
    setForm({
      name: schedule.name,
      daysOfWeek: days,
      startHour: String(schedule.startHour).padStart(2, '0'),
      startMinute: String(schedule.startMinute).padStart(2, '0'),
      endHour: String(schedule.endHour).padStart(2, '0'),
      endMinute: String(schedule.endMinute).padStart(2, '0'),
      downloadMbps: String(schedule.downloadMbps),
      uploadMbps: String(schedule.uploadMbps),
      applyTo: schedule.applyTo || 'all',
      applyToPlanId: schedule.planId || '',
      action: schedule.action || 'limit',
      description: schedule.description || '',
      enabled: schedule.enabled,
    });
    setDialogOpen(true);
  }, []);

  const updateField = useCallback(
    <K extends keyof ScheduleFormData>(key: K, value: ScheduleFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleDay = useCallback((day: number) => {
    setForm((prev) => {
      const days = [...prev.daysOfWeek];
      const idx = days.indexOf(day);
      if (idx >= 0) {
        days.splice(idx, 1);
      } else {
        days.push(day);
      }
      return { ...prev, daysOfWeek: days };
    });
  }, []);

  const selectAllDays = useCallback(() => {
    setForm((prev) => ({ ...prev, daysOfWeek: [1, 2, 3, 4, 5, 6, 7] }));
  }, []);

  const selectWeekdays = useCallback(() => {
    setForm((prev) => ({ ...prev, daysOfWeek: [1, 2, 3, 4, 5] }));
  }, []);

  const selectWeekends = useCallback(() => {
    setForm((prev) => ({ ...prev, daysOfWeek: [6, 7] }));
  }, []);

  const clearDays = useCallback(() => {
    setForm((prev) => ({ ...prev, daysOfWeek: [] }));
  }, []);

  // ─── CRUD ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Schedule name is required.',
        variant: 'destructive',
      });
      return;
    }

    if (form.daysOfWeek.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Select at least one day of the week.',
        variant: 'destructive',
      });
      return;
    }

    if (form.action === 'limit') {
      const downloadMbps = Number(form.downloadMbps);
      const uploadMbps = Number(form.uploadMbps);
      if (isNaN(downloadMbps) || downloadMbps <= 0) {
        toast({
          title: 'Validation Error',
          description: 'Download speed must be a positive number.',
          variant: 'destructive',
        });
        return;
      }
      if (isNaN(uploadMbps) || uploadMbps <= 0) {
        toast({
          title: 'Validation Error',
          description: 'Upload speed must be a positive number.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (form.applyTo === 'specific_plan' && !form.applyToPlanId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a WiFi plan when "Specific Plan" is chosen.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const daysOfWeekStr = daysOfWeekToDaysStr(form.daysOfWeek);

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        daysOfWeek: daysOfWeekStr,
        startHour: Number(form.startHour),
        startMinute: Number(form.startMinute),
        endHour: Number(form.endHour),
        endMinute: Number(form.endMinute),
        downloadMbps: Number(form.downloadMbps) || 0,
        uploadMbps: Number(form.uploadMbps) || 0,
        applyTo: form.applyTo,
        scheduleAction: form.action,
        description: form.description.trim() || undefined,
        enabled: form.enabled,
      };

      // Always send applyToPlanId — null/empty clears it when switching away from specific_plan
      payload.applyToPlanId = form.applyTo === 'specific_plan' ? form.applyToPlanId : null;

      let res: Response;
      if (editingSchedule) {
        res = await fetch('/api/wifi/radius', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'bandwidth-schedules-update',
            id: editingSchedule.id,
            ...payload,
          }),
        });
      } else {
        res = await fetch('/api/wifi/radius', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'bandwidth-schedules',
            ...payload,
          }),
        });
      }

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: editingSchedule
            ? 'Schedule updated successfully.'
            : 'Schedule created successfully.',
        });
        setDialogOpen(false);
        resetForm();
        fetchSchedules();
      } else {
        toast({
          title: 'Error',
          description:
            data.error ||
            `Failed to ${editingSchedule ? 'update' : 'create'} schedule.`,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: `Failed to ${editingSchedule ? 'update' : 'create'} schedule.`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bandwidth-schedules-delete',
          id: deleteId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Schedule deleted successfully.',
        });
        fetchSchedules();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete schedule.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete schedule.',
        variant: 'destructive',
      });
    } finally {
      setDeleteId(null);
    }
  };

  // ─── Enforce Now ─────────────────────────────────────────────────────

  const handleEnforceNow = async () => {
    setEnforcing(true);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bandwidth-schedules-enforce',
        }),
      });
      const data = await res.json();
      if (data.success) {
        const results = data.data || {};
        toast({
          title: 'Enforcement Complete',
          description: `Applied: ${results.applied || 0}, Reverted: ${results.reverted || 0}, Errors: ${results.errors || 0}`,
        });
        fetchSchedules();
      } else {
        toast({
          title: 'Enforcement Failed',
          description: data.error || 'Failed to enforce schedules',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to trigger enforcement.',
        variant: 'destructive',
      });
    } finally {
      setEnforcing(false);
    }
  };

  // ─── Hour/Minute options ──────────────────────────────────────────────

  const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minuteOptions = ['00', '15', '30', '45'];

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Bandwidth Schedules
          </h2>
          <p className="text-sm text-muted-foreground">
            Time-of-day bandwidth policies applied to RADIUS users automatically via CoA.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleEnforceNow} disabled={enforcing}>
            <Zap className={`h-4 w-4 mr-2 ${enforcing ? 'animate-pulse' : ''}`} />
            {enforcing ? 'Enforcing...' : 'Enforce Now'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchSchedules}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Schedule
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Schedules */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Calendar className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{total}</div>
              <div className="text-xs text-muted-foreground">Total Schedules</div>
            </div>
          </div>
        </Card>

        {/* Active Now */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Clock className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {activeNowCount}
              </div>
              <div className="text-xs text-muted-foreground">Active Now</div>
            </div>
            {activeNowCount > 0 && (
              <Badge variant="success" className="ml-auto text-xs">
                Live
              </Badge>
            )}
          </div>
        </Card>

        {/* Next Schedule */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold tabular-nums truncate">
                {nextScheduleInfo.text}
              </div>
              <div className="text-xs text-muted-foreground">
                {nextScheduleInfo.dayLabel
                  ? `Next schedule — ${nextScheduleInfo.dayLabel}`
                  : 'No upcoming schedules'}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* How It Works info card */}
      <Card className="p-4 border-dashed">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">How Bandwidth Schedules Work</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Create a schedule with day(s), time range, and bandwidth limits</li>
              <li>Choose who to apply to: <strong>All Users</strong>, <strong>Guests</strong>, <strong>Staff</strong>, or a <strong>Specific Plan</strong></li>
              <li>The backend enforcer checks every 60 seconds if a schedule is active</li>
              <li>When active, CoA is sent to apply limits to matching RADIUS sessions</li>
              <li>When expired, CoA reverts users to their plan&apos;s default bandwidth</li>
              <li><strong>Actions:</strong> <span className="text-orange-500">Limit</span> applies caps, <span className="text-red-500">Deny</span> disconnects users, <span className="text-emerald-500">Allow</span> keeps plan defaults</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Schedules Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Calendar className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">
                No bandwidth schedules
              </h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Create a schedule to automatically limit bandwidth by time of day.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={openCreate}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Schedule
              </Button>
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Time Range</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                    <TableHead className="text-right">Upload</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Apply To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => {
                    const isActive = activeScheduleIds.has(schedule.id);
                    const actionBadge = getActionBadge(schedule.action);
                    const days = parseDaysOfWeek(schedule.daysOfWeek);
                    return (
                      <TableRow
                        key={schedule.id}
                        className={
                          isActive
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
                            : undefined
                        }
                      >
                        {/* Name */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isActive && (
                              <span className="relative flex h-2 w-2 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                              </span>
                            )}
                            <span className="font-medium text-sm">
                              {schedule.name}
                            </span>
                          </div>
                        </TableCell>

                        {/* Days */}
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {daysOfWeekToLabel(days)}
                          </span>
                        </TableCell>

                        {/* Time Range */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm font-mono">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatTimeRange(
                              schedule.startHour,
                              schedule.startMinute,
                              schedule.endHour,
                              schedule.endMinute,
                            )}
                          </div>
                        </TableCell>

                        {/* Download */}
                        <TableCell className="text-right">
                          {schedule.action === 'limit' ? (
                            <span className="text-sm font-medium tabular-nums">
                              {schedule.downloadMbps} Mbps
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Upload */}
                        <TableCell className="text-right">
                          {schedule.action === 'limit' ? (
                            <span className="text-sm font-medium tabular-nums">
                              {schedule.uploadMbps} Mbps
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Action */}
                        <TableCell>
                          <Badge variant={actionBadge.variant} className="text-xs">
                            {schedule.action === 'limit' && <ShieldCheck className="h-3 w-3 mr-1" />}
                            {schedule.action === 'deny' && <ShieldBan className="h-3 w-3 mr-1" />}
                            {schedule.action === 'allow' && <Users className="h-3 w-3 mr-1" />}
                            {actionBadge.label}
                          </Badge>
                        </TableCell>

                        {/* Apply To */}
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {schedule.applyTo === 'all' ? 'All Users' :
                             schedule.applyTo === 'guest' ? 'Guests Only' :
                             schedule.applyTo === 'staff' ? 'Staff Only' :
                             schedule.applyTo === 'specific_plan'
                               ? (() => {
                                   const plan = wifiPlans.find(p => p.id === schedule.planId);
                                   return plan ? `Plan: ${plan.name}` : 'Specific Plan';
                                 })()
                             : schedule.applyTo}
                          </span>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {isActive ? (
                            <Badge
                              variant="success"
                              className="text-xs gap-1"
                            >
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                              </span>
                              Active
                            </Badge>
                          ) : schedule.enabled ? (
                            <Badge variant="secondary" className="text-xs">
                              Scheduled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Disabled
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(schedule)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteId(schedule.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Create / Edit Dialog ────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Edit Bandwidth Schedule' : 'New Bandwidth Schedule'}
            </DialogTitle>
            <DialogDescription>
              {editingSchedule
                ? 'Modify the schedule details and bandwidth limits.'
                : 'Define a time-of-day bandwidth policy for RADIUS users.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="schedule-name">Schedule Name *</Label>
              <Input
                id="schedule-name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g. Peak Hours Limit"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="schedule-desc">Description</Label>
              <Input
                id="schedule-desc"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Optional description"
              />
            </div>

            {/* Action Type */}
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={form.action}
                onValueChange={(value) => updateField('action', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="limit">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-orange-500" />
                      Limit — Apply bandwidth caps
                    </span>
                  </SelectItem>
                  <SelectItem value="deny">
                    <span className="flex items-center gap-2">
                      <ShieldBan className="h-4 w-4 text-red-500" />
                      Deny — Disconnect users
                    </span>
                  </SelectItem>
                  <SelectItem value="allow">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-500" />
                      Allow — Keep plan defaults (no change)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Days of Week — Multi-select with checkboxes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Days of Week *</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAllDays}>All</Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectWeekdays}>Weekdays</Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectWeekends}>Weekends</Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearDays}>Clear</Button>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {DAY_NAMES.map((name, jsIdx) => {
                  const scheduleDay = JS_TO_SCHEDULE_DAY[jsIdx];
                  const isSelected = form.daysOfWeek.includes(scheduleDay);
                  return (
                    <button
                      key={scheduleDay}
                      type="button"
                      onClick={() => toggleDay(scheduleDay)}
                      className={`
                        px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border
                        ${isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'}
                      `}
                    >
                      {DAY_SHORT[jsIdx]}
                    </button>
                  );
                })}
              </div>
              {form.daysOfWeek.length === 0 && (
                <p className="text-xs text-destructive">Select at least one day</p>
              )}
            </div>

            {/* Start Time */}
            <div className="space-y-2">
              <Label>Start Time</Label>
              <div className="flex gap-2">
                <Select
                  value={form.startHour}
                  onValueChange={(value) => updateField('startHour', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="HH" />
                  </SelectTrigger>
                  <SelectContent>
                    {hourOptions.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="self-center text-muted-foreground font-mono text-lg">
                  :
                </span>
                <Select
                  value={form.startMinute}
                  onValueChange={(value) =>
                    updateField('startMinute', value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent>
                    {minuteOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* End Time */}
            <div className="space-y-2">
              <Label>End Time</Label>
              <div className="flex gap-2">
                <Select
                  value={form.endHour}
                  onValueChange={(value) => updateField('endHour', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="HH" />
                  </SelectTrigger>
                  <SelectContent>
                    {hourOptions.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="self-center text-muted-foreground font-mono text-lg">
                  :
                </span>
                <Select
                  value={form.endMinute}
                  onValueChange={(value) =>
                    updateField('endMinute', value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent>
                    {minuteOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bandwidth (only shown for "limit" action) */}
            {form.action === 'limit' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="download-mbps">Download (Mbps)</Label>
                  <Input
                    id="download-mbps"
                    type="number"
                    min="0"
                    step="1"
                    value={form.downloadMbps}
                    onChange={(e) =>
                      updateField('downloadMbps', e.target.value)
                    }
                    placeholder="5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload-mbps">Upload (Mbps)</Label>
                  <Input
                    id="upload-mbps"
                    type="number"
                    min="0"
                    step="1"
                    value={form.uploadMbps}
                    onChange={(e) =>
                      updateField('uploadMbps', e.target.value)
                    }
                    placeholder="2"
                  />
                </div>
              </div>
            )}

            {/* Apply To */}
            <div className="space-y-2">
              <Label>Apply To</Label>
              <Select
                value={form.applyTo}
                onValueChange={(value) => {
                  updateField('applyTo', value);
                  if (value !== 'specific_plan') updateField('applyToPlanId', '');
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All RADIUS Users</SelectItem>
                  <SelectItem value="guest">Guest Users</SelectItem>
                  <SelectItem value="staff">Staff Users</SelectItem>
                  <SelectItem value="specific_plan">Specific Plan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Plan selector — only when Apply To = Specific Plan */}
            {form.applyTo === 'specific_plan' && (
              <div className="space-y-2">
                <Label>Select Plan</Label>
                {wifiPlans.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No active WiFi plans found. Create a plan first.</p>
                ) : (
                  <Select
                    value={form.applyToPlanId}
                    onValueChange={(value) => updateField('applyToPlanId', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a WiFi plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {wifiPlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          <span className="flex items-center gap-2">
                            <span>{plan.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {plan.downloadSpeed}↓/{plan.uploadSpeed}↑ Mbps
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Enabled toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Apply this schedule automatically at the configured time.
                </p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) =>
                  updateField('enabled', checked)
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this bandwidth schedule. Users currently
              throttled by this policy will revert to their plan defaults on the
              next enforcement cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
