'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Search,
  Loader2,
  Clock,
  User,
  Hash,
  ArrowRight,
  Calendar,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

interface BookingInfo {
  id: string;
  confirmationCode: string;
  primaryGuest?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface AuditLog {
  id: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  notes?: string;
  performedBy?: string;
  performedAt: string;
  booking: BookingInfo;
}

const actionTypes: Record<string, { label: string; color: string }> = {
  created: { label: 'Created', color: 'bg-emerald-500' },
  status_change: { label: 'Status Change', color: 'bg-amber-500' },
  room_change: { label: 'Room Change', color: 'bg-cyan-500' },
  checked_in: { label: 'Checked In', color: 'bg-teal-500' },
  checked_out: { label: 'Checked Out', color: 'bg-violet-500' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500' },
  modified: { label: 'Modified', color: 'bg-slate-500' },
  note_added: { label: 'Note Added', color: 'bg-pink-500' },
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  confirmed: 'bg-emerald-500',
  checked_in: 'bg-teal-500',
  checked_out: 'bg-cyan-500',
  cancelled: 'bg-red-500',
  no_show: 'bg-orange-500',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);

  // Fetch audit logs
  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('bookingId', searchQuery);
      if (actionFilter !== 'all') params.append('action', actionFilter);

      const response = await fetch(`/api/bookings/audit-logs?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setLogs(result.data);
        setTotal(result.pagination.total);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchLogs();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getActionBadge = (action: string) => {
    const actionInfo = actionTypes[action] || { label: action, color: 'bg-gray-500' };
    return (
      <Badge className={cn('text-white', actionInfo.color)}>
        {actionInfo.label}
      </Badge>
    );
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    return (
      <Badge variant="outline" className={cn('text-xs', statusColors[status])}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Trail
          </h2>
          <p className="text-sm text-muted-foreground">
            Complete history of booking changes and actions
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {total} total entries
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by booking ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.entries(actionTypes).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchLogs}>
              <Filter className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeline View */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>No audit logs found</p>
              <p className="text-sm">Activity will appear here as bookings are modified</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="p-3 sm:p-4">
                {logs.map((log, index) => {
                  const isLast = index === logs.length - 1;

                  return (
                    <div key={log.id} className="flex gap-4">
                      {/* Timeline connector */}
                      <div className="flex flex-col items-center">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                        </div>
                        {!isLast && <div className="flex-1 w-0.5 bg-border my-2" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-sm font-medium">
                              {log.booking.confirmationCode}
                            </span>
                          </div>
                          {getActionBadge(log.action)}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.performedAt), { addSuffix: true })}
                          </span>
                        </div>

                        {/* Status change indicator */}
                        {log.oldStatus && log.newStatus && (
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusBadge(log.oldStatus)}
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            {getStatusBadge(log.newStatus)}
                          </div>
                        )}

                        {/* Guest info */}
                        {log.booking.primaryGuest && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <User className="h-3 w-3" />
                            <span>
                              {log.booking.primaryGuest.firstName} {log.booking.primaryGuest.lastName}
                            </span>
                          </div>
                        )}

                        {/* Notes */}
                        {log.notes && (
                          <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2 mt-2">
                            {log.notes}
                          </p>
                        )}

                        {/* Timestamp */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(log.performedAt), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Action Legend */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Action Types</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex flex-wrap gap-3">
            {Object.entries(actionTypes).map(([key, { label, color }]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={cn('w-3 h-3 rounded', color)} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
