'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import {
  AlertTriangle,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { SectionGuard } from '@/components/common/section-guard';
import { format, formatDistanceToNow } from 'date-fns';

interface Incident {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string | null;
  location: string;
  reportedBy: string | null;
  assignedTo: string | null;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  cameraId: string | null;
}

interface IncidentStats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  closed: number;
  critical: number;
  resolvedToday: number;
  byStatus: {
    open: number;
    investigating: number;
    resolved: number;
    closed: number;
  };
  bySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

const incidentTypes = [
  { value: 'theft', label: 'Theft', color: 'text-red-500' },
  { value: 'unauthorized', label: 'Unauthorized Access', color: 'text-amber-500' },
  { value: 'accident', label: 'Accident', color: 'text-orange-500' },
  { value: 'disturbance', label: 'Disturbance', color: 'text-yellow-500' },
  { value: 'fire', label: 'Fire/Safety', color: 'text-red-600' },
  { value: 'other', label: 'Other', color: 'text-gray-500' },
];

const severityLevels = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
];

const statusOptions = [
  { value: 'open', label: 'Open', color: 'bg-red-500' },
  { value: 'investigating', label: 'Investigating', color: 'bg-amber-500' },
  { value: 'resolved', label: 'Resolved', color: 'bg-emerald-500' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-500' },
];

export default function Incidents() {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats>({
    total: 0,
    open: 0,
    investigating: 0,
    resolved: 0,
    closed: 0,
    critical: 0,
    resolvedToday: 0,
    byStatus: { open: 0, investigating: 0, resolved: 0, closed: 0 },
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    type: 'other',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    title: '',
    description: '',
    location: '',
    cameraId: '',
  });

  useEffect(() => {
    fetchIncidents();
  }, [statusFilter, severityFilter]);

  const fetchIncidents = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (severityFilter && severityFilter !== 'all') params.append('severity', severityFilter);

      const response = await fetch(`/api/security/incidents?${params}`);
      const data = await response.json();

      if (data.success) {
        setIncidents(data.data.incidents);
        setStats(data.data.stats);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch incidents',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching incidents:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch incidents',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredIncidents = incidents.filter(i => {
    if (searchQuery) {
      return (
        i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.description && i.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    return true;
  });

  const handleCreateIncident = async () => {
    if (!formData.title || !formData.location) {
      toast({
        title: 'Validation Error',
        description: 'Title and location are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/security/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          reportedBy: 'Security Staff',
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Incident Logged',
          description: 'New security incident has been recorded',
        });
        setIsCreateOpen(false);
        setFormData({
          type: 'other',
          severity: 'medium',
          title: '',
          description: '',
          location: '',
          cameraId: '',
        });
        fetchIncidents();
      } else {
        toast({
          title: 'Error',
          description: data.error?.message || 'Failed to create incident',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating incident:', error);
      toast({
        title: 'Error',
        description: 'Failed to create incident',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string, resolution?: string) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/security/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status,
          resolution,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Status Updated',
          description: `Incident marked as ${status}`,
        });
        setIsDetailOpen(false);
        fetchIncidents();
      } else {
        toast({
          title: 'Error',
          description: data.error?.message || 'Failed to update incident',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating incident:', error);
      toast({
        title: 'Error',
        description: 'Failed to update incident',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const option = severityLevels.find(o => o.value === severity);
    return (
      <Badge variant="secondary" className={cn('text-white', option?.color)}>
        {option?.label || severity}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const option = statusOptions.find(o => o.value === status);
    return (
      <Badge variant="outline" className={cn('capitalize', `border-${status === 'open' ? 'red' : status === 'investigating' ? 'amber' : status === 'resolved' ? 'emerald' : 'gray'}-500`)}>
        {option?.label || status}
      </Badge>
    );
  };

  // Calculate derived stats for display
  const openCount = stats.byStatus.open + stats.byStatus.investigating;
  const criticalCount = stats.bySeverity.critical;
  const resolvedToday = stats.resolvedToday;

  return (
    <SectionGuard permission="surveillance.incidents">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Incident Logs
          </h2>
          <p className="text-sm text-muted-foreground">
            Track and manage security incidents
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchIncidents} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Incident
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{openCount}</div>
              <div className="text-xs text-muted-foreground">Open</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{criticalCount}</div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{resolvedToday}</div>
              <div className="text-xs text-muted-foreground">Resolved Today</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Clock className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search incidents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                {severityLevels.map(level => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statusOptions.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Incidents Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mb-4" />
              <p>No incidents found</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Incident</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Reported</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{incident.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {incident.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {incident.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{incident.location}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">
                            {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(incident.createdAt), 'MMM d, HH:mm')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(incident.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedIncident(incident);
                            setIsDetailOpen(true);
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Incident Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Security Incident</DialogTitle>
            <DialogDescription>
              Record a new security incident
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Brief description of the incident"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {incidentTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, severity: value as 'low' | 'medium' | 'high' | 'critical' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {severityLevels.map(level => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location *</Label>
              <Input
                placeholder="Where did this occur?"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Detailed description of the incident..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateIncident} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Log Incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incident Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Incident Details
            </DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-lg">{selectedIncident.title}</h3>
                {getSeverityBadge(selectedIncident.severity)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <Badge variant="outline" className="capitalize mt-1">
                    {selectedIncident.type}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedIncident.status)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {selectedIncident.location}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reported By</p>
                  <p className="flex items-center gap-1 mt-1">
                    <User className="h-3 w-3" />
                    {selectedIncident.reportedBy || 'System'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reported</p>
                  <p className="mt-1">
                    {format(new Date(selectedIncident.createdAt), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
                {selectedIncident.assignedTo && (
                  <div>
                    <p className="text-muted-foreground">Assigned To</p>
                    <p className="mt-1">{selectedIncident.assignedTo}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-muted-foreground text-sm">Description</p>
                <p className="mt-1 text-sm">{selectedIncident.description || 'No description'}</p>
              </div>

              {selectedIncident.resolution && (
                <div className="p-4 bg-emerald-500/10 rounded-lg">
                  <p className="text-sm font-medium text-emerald-700">Resolution</p>
                  <p className="text-sm mt-1">{selectedIncident.resolution}</p>
                  {selectedIncident.resolvedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Resolved: {format(new Date(selectedIncident.resolvedAt), 'MMM d, yyyy HH:mm')}
                    </p>
                  )}
                </div>
              )}

              {(selectedIncident.status === 'open' || selectedIncident.status === 'investigating') && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      handleUpdateStatus(selectedIncident.id, 'investigating');
                      setSelectedIncident(prev => prev ? { ...prev, status: 'investigating' } : null);
                    }}
                    disabled={isSaving}
                  >
                    Mark Investigating
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      handleUpdateStatus(selectedIncident.id, 'resolved', 'Issue has been resolved.');
                      setIsDetailOpen(false);
                    }}
                    disabled={isSaving}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Resolve
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </SectionGuard>
  );
}
