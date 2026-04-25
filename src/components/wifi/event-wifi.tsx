'use client';

/**
 * Event WiFi Component
 *
 * Event/Conference WiFi management. Create events, bulk-generate user credentials,
 * manage event users, print credential cards, generate QR codes.
 * Fetch from: /api/wifi/radius?action=event-users
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  CalendarDays,
  Plus,
  Loader2,
  RefreshCw,
  Search,
  Copy,
  Printer,
  Users,
  Wifi,
  Shield,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  UserPlus,
  HardDrive,
  Gauge,
  Timer,
  Trash2,
  Building2,
  Mail,
  User,
  Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import PrintCard, { PrintCardHandle } from './print-card';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface EventWifiPlan {
  id: string;
  name: string;
  description?: string;
  downloadSpeed?: number;
  uploadSpeed?: number;
  dataLimit?: number;
  validityDays?: number;
  sessionLimit?: number;
}

interface EventUser {
  id: string;
  eventId: string;
  username: string;
  password: string;
  guestName: string;
  email?: string;
  company?: string;
  status: 'active' | 'revoked' | 'expired';
  validUntil?: string;
  createdAt?: string;
}

interface EventWifiEvent {
  id: string;
  name: string;
  planId?: string;
  bandwidth?: number;
  dataLimit?: number;
  validHours?: number;
  userCount: number;
  status: 'active' | 'ended' | 'upcoming';
  createdAt?: string;
  organizerName?: string;
  organizerEmail?: string;
  organizerCompany?: string;
}

// ─── Smart Credentials Table ────────────────────────────────────────────────────
// Dynamically shows/hides columns based on whether data exists

interface SmartTableProps {
  users: EventUser[];
  onPrint: (user: EventUser) => void;
  onRevoke: (id: string) => void;
  onCopy: (text: string, label: string) => void;
}

function SmartCredentialsTable({ users, onPrint, onRevoke, onCopy }: SmartTableProps) {
  // Determine which columns to show based on data
  const hasGuestName = users.some(u => u.guestName);
  const hasEmail = users.some(u => u.email);
  const hasCompany = users.some(u => u.company);
  const hasMixedStatus = users.some(u => u.status !== 'active');
  const showGuestCols = hasGuestName || hasEmail || hasCompany;

  return (
    <div className="max-h-[500px] overflow-y-auto">
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            {showGuestCols && hasGuestName && <TableHead className="w-[130px]">Guest Name</TableHead>}
            <TableHead className="w-[140px]">Username</TableHead>
            <TableHead className="w-[130px]">Password</TableHead>
            {showGuestCols && hasEmail && <TableHead className="w-[150px]">Email</TableHead>}
            {showGuestCols && hasCompany && <TableHead className="w-[120px]">Company</TableHead>}
            {hasMixedStatus && <TableHead className="w-[80px]">Status</TableHead>}
            <TableHead className="w-[90px]">Valid Until</TableHead>
            <TableHead className="text-right w-[70px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              {showGuestCols && hasGuestName && (
                <TableCell className="truncate">
                  <p className="font-medium text-sm truncate">{user.guestName || '—'}</p>
                </TableCell>
              )}
              <TableCell className="truncate">
                <p className="font-mono text-sm font-medium whitespace-nowrap">{user.username}</p>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <span className="font-mono text-sm">{user.password}</span>
                  <button
                    onClick={() => onCopy(user.password, 'Password')}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </TableCell>
              {showGuestCols && hasEmail && (
                <TableCell>
                  <p className="text-xs text-muted-foreground">{user.email || '—'}</p>
                </TableCell>
              )}
              {showGuestCols && hasCompany && (
                <TableCell>
                  <p className="text-xs text-muted-foreground">{user.company || '—'}</p>
                </TableCell>
              )}
              {hasMixedStatus && (
                <TableCell>
                  {user.status === 'active' && (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">Active</Badge>
                  )}
                  {user.status === 'revoked' && (
                    <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">Revoked</Badge>
                  )}
                  {user.status === 'expired' && (
                    <Badge className="bg-gray-500 hover:bg-gray-600 text-white border-0 text-xs">Expired</Badge>
                  )}
                </TableCell>
              )}
              <TableCell>
                <span className="text-xs text-muted-foreground">
                  {user.validUntil ? new Date(user.validUntil).toLocaleDateString() : '—'}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPrint(user)}
                    title="Print credentials"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  {user.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevoke(user.id)}
                      title="Revoke credentials"
                    >
                      <Ban className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function EventWifi() {
  const { toast } = useToast();
  const [events, setEvents] = useState<EventWifiEvent[]>([]);
  const [users, setUsers] = useState<EventUser[]>([]);
  const [plans, setPlans] = useState<EventWifiPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Event creation
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventForm, setEventForm] = useState({
    name: '',
    planId: '',
    bandwidth: 10,
    dataLimit: 0,
    validHours: 24,
    organizerName: '',
    organizerEmail: '',
    organizerCompany: '',
  });

  // Add Attendee
  const [attendeeDialogOpen, setAttendeeDialogOpen] = useState(false);
  const [creatingAttendee, setCreatingAttendee] = useState(false);
  const [attendeeForm, setAttendeeForm] = useState({
    eventId: '',
    guestName: '',
    guestEmail: '',
    guestCompany: '',
  });

  // Bulk generation
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkForm, setBulkForm] = useState({
    eventId: '',
    count: 10,
  });

  // Print card
  const [printUser, setPrintUser] = useState<EventUser | null>(null);
  const printCardRef = useRef<PrintCardHandle>(null);

  // Delete / Revoke
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [revokeUserId, setRevokeUserId] = useState<string | null>(null);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch WiFi plans from the local API
      const plansRes = await fetch('/api/wifi/plans?status=active');
      const plansData = await plansRes.json();
      if (plansData.success && Array.isArray(plansData.data)) {
        setPlans(plansData.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          downloadSpeed: p.downloadSpeed,
          uploadSpeed: p.uploadSpeed,
          dataLimit: p.dataLimit,
          validityDays: p.validityDays,
          sessionLimit: p.sessionLimit,
        })));
      }

      // 2. Fetch event users from the RADIUS service proxy
      const res = await fetch('/api/wifi/radius?action=event-users');
      const data = await res.json();
      if (data.success && data.data) {
        const nested = data.data;
        const isStructured = nested && typeof nested === 'object' && !Array.isArray(nested);
        const rawUsers: Record<string, unknown>[] = isStructured
          ? (Array.isArray(nested.users) ? nested.users : [])
          : (Array.isArray(nested) ? nested : []);

        const rawEvents: Record<string, unknown>[] = isStructured && Array.isArray(nested.events)
          ? nested.events
          : [];

        // Map raw rows to EventUser interface
        const mappedUsers: EventUser[] = rawUsers.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          eventId: row.eventId as string,
          username: row.username as string,
          password: row.password as string,
          guestName: (row.guestName as string) || '',
          email: (row.guestEmail as string) || '',
          company: (row.guestCompany as string) || '',
          status: (row.status as string) || 'active',
          validUntil: (row.validUntil as string) || '',
          createdAt: (row.createdAt as string) || '',
        }));
        setUsers(mappedUsers);

        // 3. Build events list
        const eventMap = new Map<string, EventWifiEvent>();

        // From explicit events array
        for (const evt of rawEvents) {
          const eid = evt.id as string;
          if (eid) {
            eventMap.set(eid, {
              id: eid,
              name: (evt.name as string) || eid,
              planId: (evt.planId as string) || '',
              bandwidth: (evt.bandwidthDown as number) || (evt.bandwidth as number) || 0,
              dataLimit: (evt.dataLimitMb as number) || (evt.dataLimit as number) || 0,
              validHours: (evt.validHours as number) ?? 24,
              userCount: 0,
              status: (evt.status as string) || 'active',
              createdAt: (evt.createdAt as string) || '',
              organizerName: (evt.organizerName as string) || '',
              organizerEmail: (evt.organizerEmail as string) || '',
              organizerCompany: (evt.organizerCompany as string) || '',
            });
          }
        }

        // Extract unique events from user rows
        for (const row of rawUsers) {
          const eid = row.eventId as string;
          if (eid && !eventMap.has(eid)) {
            eventMap.set(eid, {
              id: eid,
              name: (row.eventName as string) || eid,
              planId: (row.planId as string) || '',
              bandwidth: (row.bandwidthDown as number) || 0,
              dataLimit: (row.dataLimitMb as number) || 0,
              validHours: 24,
              userCount: 0,
              status: 'active',
              createdAt: (row.createdAt as string) || '',
            });
          }
        }
        // Count users per event
        for (const user of mappedUsers) {
          const evt = eventMap.get(user.eventId);
          if (evt) evt.userCount++;
        }
        setEvents(Array.from(eventMap.values()));
      }
    } catch (error) {
      console.error('Failed to fetch event WiFi data:', error);
      toast({ title: 'Error', description: 'Failed to load event WiFi data. Is the RADIUS service running?', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // ─── Create Event ───────────────────────────────────────────────────────────

  const handleCreateEvent = async () => {
    if (!eventForm.name.trim()) {
      toast({ title: 'Error', description: 'Event name is required', variant: 'destructive' });
      return;
    }
    setCreatingEvent(true);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-event',
          name: eventForm.name,
          planId: eventForm.planId || undefined,
          bandwidthDown: eventForm.bandwidth,
          bandwidthUp: Math.round(eventForm.bandwidth * 0.4),
          dataLimitMb: eventForm.dataLimit,
          validHours: eventForm.validHours,
          organizerName: eventForm.organizerName || undefined,
          organizerEmail: eventForm.organizerEmail || undefined,
          organizerCompany: eventForm.organizerCompany || undefined,
        }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        toast({ title: 'Event Created', description: `"${eventForm.name}" created successfully. Add attendees or generate credentials next.` });
        setCreateEventOpen(false);
        setEventForm({ name: '', planId: '', bandwidth: 10, dataLimit: 0, validHours: 24, organizerName: '', organizerEmail: '', organizerCompany: '' });
        fetchEvents();
      } else {
        toast({
          title: 'Error',
          description: typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to create event',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create event. Check RADIUS service.', variant: 'destructive' });
    } finally {
      setCreatingEvent(false);
    }
  };

  // ─── Add Attendee ───────────────────────────────────────────────────────────

  const handleAddAttendee = async () => {
    if (!attendeeForm.eventId || !attendeeForm.guestName.trim()) {
      toast({ title: 'Error', description: 'Event and Guest Name are required', variant: 'destructive' });
      return;
    }
    setCreatingAttendee(true);
    try {
      const selectedEvent = events.find(e => e.id === attendeeForm.eventId);
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-event-attendee',
          eventId: attendeeForm.eventId,
          eventName: selectedEvent?.name,
          guestName: attendeeForm.guestName,
          guestEmail: attendeeForm.guestEmail || undefined,
          guestCompany: attendeeForm.guestCompany || undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Attendee Added', description: `${attendeeForm.guestName} added to event` });
        setAttendeeDialogOpen(false);
        setAttendeeForm({ eventId: '', guestName: '', guestEmail: '', guestCompany: '' });
        fetchEvents();
      } else {
        toast({
          title: 'Error',
          description: typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to add attendee',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add attendee', variant: 'destructive' });
    } finally {
      setCreatingAttendee(false);
    }
  };

  // ─── Bulk Generate Users ────────────────────────────────────────────────────

  const handleBulkGenerate = async () => {
    if (!bulkForm.eventId) {
      toast({ title: 'Error', description: 'Select an event', variant: 'destructive' });
      return;
    }
    const selectedEvent = events.find(e => e.id === bulkForm.eventId);
    if (!selectedEvent) {
      toast({ title: 'Error', description: 'Selected event not found', variant: 'destructive' });
      return;
    }

    setBulkGenerating(true);
    setBulkProgress(0);

    const progressInterval = setInterval(() => {
      setBulkProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 200);

    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-event-users',
          eventId: bulkForm.eventId,
          eventName: selectedEvent.name,
          count: bulkForm.count,
          bandwidthDown: selectedEvent.bandwidth ?? 10,
          bandwidthUp: Math.round(((selectedEvent.bandwidth ?? 10) * 0.4)),
          dataLimitMb: selectedEvent.dataLimit ?? 0,
          validHours: selectedEvent.validHours ?? 24,
        }),
      });
      const data = await res.json();
      clearInterval(progressInterval);
      setBulkProgress(100);

      if (data.success) {
        toast({ title: 'Users Generated', description: `Generated ${data.data?.created || bulkForm.count} event WiFi credentials` });
        setTimeout(() => {
          setBulkDialogOpen(false);
          setBulkProgress(0);
          fetchEvents();
        }, 500);
      } else {
        toast({ title: 'Error', description: typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to generate users', variant: 'destructive' });
        setBulkProgress(0);
      }
    } catch {
      clearInterval(progressInterval);
      toast({ title: 'Error', description: 'Failed to generate users', variant: 'destructive' });
      setBulkProgress(0);
    } finally {
      setBulkGenerating(false);
    }
  };

  // ─── Delete Event ───────────────────────────────────────────────────────────

  const handleDeleteEvent = async () => {
    if (!deleteEventId) return;
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-event', eventId: deleteEventId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Event Deleted', description: `Event and ${data.data?.deleted || 0} associated users removed` });
        fetchEvents();
      } else {
        toast({ title: 'Error', description: typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to delete event', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete event', variant: 'destructive' });
    } finally {
      setDeleteEventId(null);
    }
  };

  // ─── Revoke User ────────────────────────────────────────────────────────────

  const handleRevoke = async () => {
    if (!revokeUserId) return;
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke-event-user', id: revokeUserId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'User Revoked', description: 'WiFi credentials have been revoked' });
        fetchEvents();
      } else {
        toast({ title: 'Error', description: typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to revoke', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to revoke user', variant: 'destructive' });
    } finally {
      setRevokeUserId(null);
    }
  };

  // ─── Copy password ──────────────────────────────────────────────────────────

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copied', description: `${label} copied to clipboard` });
    }).catch(() => {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    });
  };

  // ─── Filtering ──────────────────────────────────────────────────────────────

  const filteredUsers = users.filter(u => {
    if (selectedEventId !== 'all' && u.eventId !== selectedEventId) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return u.username.toLowerCase().includes(q) ||
        u.guestName.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.company || '').toLowerCase().includes(q);
    }
    return true;
  });

  const activeEvents = events.filter(e => e.status === 'active');
  const activeUsers = users.filter(u => u.status === 'active');

  // ─── Helper: get plan name by id ────────────────────────────────────────────

  const getPlanName = (planId?: string) => {
    if (!planId) return 'Default';
    const plan = plans.find(p => p.id === planId);
    return plan?.name || planId;
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Event WiFi
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage event/conference WiFi credentials with bulk generation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchEvents} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateEventOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <CalendarDays className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{events.length}</div>
              <div className="text-xs text-muted-foreground">Total Events</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{activeEvents.length}</div>
              <div className="text-xs text-muted-foreground">Active Events</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Users className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{users.length}</div>
              <div className="text-xs text-muted-foreground">Total Credentials</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <Wifi className="h-4 w-4 text-teal-500 dark:text-teal-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-teal-600 dark:text-teal-400">{activeUsers.length}</div>
              <div className="text-xs text-muted-foreground">Active Users</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Events List Section */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted/50 p-4 mb-3">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">No events yet</h3>
            <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
              Create your first event to start managing WiFi credentials
            </p>
            <Button size="sm" onClick={() => setCreateEventOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Events ({events.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <Card key={event.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  {/* Event header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">{event.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge
                          className={`text-[10px] px-1.5 py-0 border-0 ${
                            event.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : event.status === 'ended'
                              ? 'bg-gray-500/10 text-gray-500'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {event.status === 'active' && <CheckCircle className="h-2.5 w-2.5 mr-1" />}
                          {event.status === 'ended' && <XCircle className="h-2.5 w-2.5 mr-1" />}
                          {event.status === 'upcoming' && <Clock className="h-2.5 w-2.5 mr-1" />}
                          {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                        </Badge>
                        {event.createdAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/10 shrink-0 ml-2">
                      <CalendarDays className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                    </div>
                  </div>

                  {/* Organizer info */}
                  {event.organizerName && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 px-2 py-1.5 rounded-md bg-muted/30">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{event.organizerName}</span>
                      {event.organizerCompany && (
                        <>
                          <span className="text-muted-foreground/50">·</span>
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{event.organizerCompany}</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Event details grid */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Gauge className="h-3 w-3 shrink-0" />
                      <span className="truncate">{event.bandwidth || 0} Mbps</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <HardDrive className="h-3 w-3 shrink-0" />
                      <span className="truncate">{event.dataLimit || 0} MB</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Timer className="h-3 w-3 shrink-0" />
                      <span className="truncate">{event.validHours || 24}h valid</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Shield className="h-3 w-3 shrink-0" />
                      <span className="truncate">{getPlanName(event.planId)}</span>
                    </div>
                  </div>

                  {/* User count + action buttons */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">{event.userCount}</span>
                      <span className="text-xs text-muted-foreground">credentials</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setAttendeeForm({ eventId: event.id, guestName: '', guestEmail: '', guestCompany: '' });
                          setAttendeeDialogOpen(true);
                        }}
                        title="Add single attendee"
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setBulkForm({ eventId: event.id, count: 10 });
                          setBulkDialogOpen(true);
                        }}
                        title="Bulk generate credentials"
                      >
                        <Users className="h-3 w-3 mr-1" />
                        Bulk
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteEventId(event.id)}
                        title="Delete event and all its credentials"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Credentials Table Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Section header + filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Credentials ({filteredUsers.length})
              {selectedEventId !== 'all' && (
                <Badge variant="outline" className="ml-2 text-xs font-normal">
                  {events.find(e => e.id === selectedEventId)?.name || selectedEventId}
                  <button
                    onClick={() => setSelectedEventId('all')}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </Badge>
              )}
            </h3>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search username, guest name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="w-full sm:w-48 h-9">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  {events.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Users className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">
                {events.length > 0 ? 'No credentials generated yet' : 'No event users found'}
              </h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {events.length > 0
                  ? 'Click "Bulk" on an event card above to generate WiFi credentials'
                  : 'Create an event first to start managing WiFi credentials'}
              </p>
            </div>
          ) : (
            <SmartCredentialsTable
              users={filteredUsers}
              onPrint={setPrintUser}
              onRevoke={setRevokeUserId}
              onCopy={copyToClipboard}
            />
          )}
        </CardContent>
      </Card>

      {/* Create Event Dialog */}
      <Dialog open={createEventOpen} onOpenChange={setCreateEventOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>
              Set up a new event or conference with dedicated WiFi credentials
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Event details */}
            <div className="space-y-2">
              <Label>Event Name *</Label>
              <Input
                value={eventForm.name}
                onChange={(e) => setEventForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Tech Conference 2025"
              />
            </div>

            {/* Organizer info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  Organizer Name
                </Label>
                <Input
                  value={eventForm.organizerName}
                  onChange={(e) => setEventForm(prev => ({ ...prev, organizerName: e.target.value }))}
                  placeholder="Organizer name"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3" />
                  Email
                </Label>
                <Input
                  type="email"
                  value={eventForm.organizerEmail}
                  onChange={(e) => setEventForm(prev => ({ ...prev, organizerEmail: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  Company
                </Label>
                <Input
                  value={eventForm.organizerCompany}
                  onChange={(e) => setEventForm(prev => ({ ...prev, organizerCompany: e.target.value }))}
                  placeholder="Company name"
                />
              </div>
            </div>

            {/* WiFi Plan */}
            <div className="space-y-2">
              <Label>WiFi Plan</Label>
              <Select value={eventForm.planId} onValueChange={(v) => {
                const selectedPlan = plans.find(p => p.id === v);
                if (selectedPlan) {
                  setEventForm(prev => ({
                    ...prev,
                    planId: v,
                    bandwidth: selectedPlan.downloadSpeed || prev.bandwidth,
                    dataLimit: selectedPlan.dataLimit ?? prev.dataLimit,
                    validHours: selectedPlan.validityDays
                      ? selectedPlan.validityDays * 24
                      : prev.validHours,
                  }));
                } else {
                  setEventForm(prev => ({ ...prev, planId: v }));
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.downloadSpeed ? ` (${p.downloadSpeed}↓/${p.uploadSpeed || Math.round(p.downloadSpeed * 0.4)}↑ Mbps)` : ''}
                      {p.dataLimit ? ` · ${p.dataLimit >= 1024 ? `${(p.dataLimit / 1024).toFixed(1)}GB` : `${p.dataLimit}MB`} limit` : ' · Unlimited'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* WiFi Settings */}
            {eventForm.planId && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                Auto-filled from selected plan. You can override below.
              </p>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Download (Mbps)</Label>
                <Input
                  type="number"
                  value={eventForm.bandwidth}
                  onChange={(e) => setEventForm(prev => ({ ...prev, bandwidth: parseInt(e.target.value) ?? 10 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Limit (MB) <span className="text-muted-foreground font-normal">0 = unlimited</span></Label>
                <Input
                  type="number"
                  value={eventForm.dataLimit}
                  onChange={(e) => setEventForm(prev => ({ ...prev, dataLimit: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Hours</Label>
                <Input
                  type="number"
                  value={eventForm.validHours}
                  onChange={(e) => setEventForm(prev => ({ ...prev, validHours: parseInt(e.target.value) ?? 24 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateEventOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateEvent} disabled={creatingEvent}>
              {creatingEvent && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Attendee Dialog */}
      <Dialog open={attendeeDialogOpen} onOpenChange={setAttendeeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Attendee</DialogTitle>
            <DialogDescription>
              Register a single attendee for this event with WiFi credentials
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Event</Label>
              <Select value={attendeeForm.eventId} onValueChange={(v) => setAttendeeForm(prev => ({ ...prev, eventId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <User className="h-3 w-3" />
                Guest Name *
              </Label>
              <Input
                value={attendeeForm.guestName}
                onChange={(e) => setAttendeeForm(prev => ({ ...prev, guestName: e.target.value }))}
                placeholder="Attendee's full name"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                Email
              </Label>
              <Input
                type="email"
                value={attendeeForm.guestEmail}
                onChange={(e) => setAttendeeForm(prev => ({ ...prev, guestEmail: e.target.value }))}
                placeholder="attendee@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                Company
              </Label>
              <Input
                value={attendeeForm.guestCompany}
                onChange={(e) => setAttendeeForm(prev => ({ ...prev, guestCompany: e.target.value }))}
                placeholder="Company / Organization"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttendeeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAttendee} disabled={creatingAttendee}>
              {creatingAttendee && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Attendee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Generate Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Generate Credentials</DialogTitle>
            <DialogDescription>
              Generate multiple anonymous WiFi credentials for an event
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Event *</Label>
              <Select value={bulkForm.eventId} onValueChange={(v) => setBulkForm(prev => ({ ...prev, eventId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Number of Credentials</Label>
              <Input
                type="number"
                value={bulkForm.count}
                onChange={(e) => setBulkForm(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
                min={1}
                max={500}
              />
            </div>
            {bulkGenerating && (
              <div className="space-y-2">
                <Label className="text-sm">Generating...</Label>
                <Progress value={bulkProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">{Math.round(bulkProgress)}%</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)} disabled={bulkGenerating}>Cancel</Button>
            <Button onClick={handleBulkGenerate} disabled={bulkGenerating}>
              {bulkGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Card Dialog */}
      <Dialog open={!!printUser} onOpenChange={(open) => { if (!open) setPrintUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>WiFi Credential Card</DialogTitle>
            <DialogDescription>
              Print this card for the event attendee
            </DialogDescription>
          </DialogHeader>
          {printUser && (
            <PrintCard
              ref={printCardRef}
              username={printUser.username}
              password={printUser.password}
              guestName={printUser.guestName}
              validUntil={printUser.validUntil}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Event Confirmation */}
      <AlertDialog open={!!deleteEventId} onOpenChange={(open) => { if (!open) setDeleteEventId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this event and all its associated WiFi credentials. Users will lose access immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Confirmation */}
      <AlertDialog open={!!revokeUserId} onOpenChange={(open) => { if (!open) setRevokeUserId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke WiFi Credentials</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately revoke the user&apos;s WiFi access. They will be disconnected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
